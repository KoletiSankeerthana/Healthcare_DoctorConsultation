import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { requireAuth } from "@/lib/server-auth";
import { getPaymentMode, generateDummyTransactionId } from "@/lib/paymentConfig";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000/api/v1";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    const body = await request.json();

    const serverPaymentMode = getPaymentMode();
    const isMock = body.payment_mode === "mock" || (serverPaymentMode === "mock" && !body.razorpay_signature);

    if (isMock) {
      if (serverPaymentMode !== "mock") {
        return NextResponse.json(
          { error: "Mock payments are strictly prohibited when server is in razorpay mode or in production." },
          { status: 400 }
        );
      }
      if (!body.order_id && !body.razorpay_order_id) {
        return NextResponse.json(
          { error: "order_id or razorpay_order_id is required." },
          { status: 400 }
        );
      }
      // Ensure dummy transaction ID has TEST-PAY- prefix
      if (!body.dummy_transaction_id && !body.razorpay_payment_id) {
        body.dummy_transaction_id = generateDummyTransactionId();
      }
      body.payment_mode = "mock";
    } else {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        console.warn("[Payment API] Missing required verification parameters in request body.");
        return NextResponse.json(
          { error: "Missing required Razorpay cryptographic verification parameters." },
          { status: 400 }
        );
      }
    }

    const payload = {
      ...body,
      user_id: user.id
    };

    console.info(`[Payment API] Verifying payment: mode=${payload.payment_mode || "razorpay"}, order=${payload.order_id || payload.razorpay_order_id}`);

    // 1. Try FastAPI backend over HTTP (< 5ms)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const fastApiRes = await fetch(`${BACKEND_URL}/payments/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (fastApiRes.ok) {
        const data = await fastApiRes.json();
        console.info(`[Payment API] Verified via FastAPI: payment_id=${data.payment?.id}`);
        return NextResponse.json(data, { status: 200 });
      }
    } catch (e) {
      // Backend offline; fall back to direct SQLite bridge
    }

    // 2. Direct Python DB bridge fallback
    const result = callDbBridge("payment_verify", [user.id], payload);

    if (!result || !result.success) {
      console.warn(`[Payment API] Signature verification failed: ${result?.error}`);
      return NextResponse.json(
        {
          error: result?.error || "Cryptographic signature verification failed. Payment cannot be verified.",
          status: result?.status || "FAILED"
        },
        { status: 400 }
      );
    }

    console.info(`[Payment API] Verified via DB Bridge: payment_id=${result.payment?.id}`);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("[Payment API] /api/payments/verify error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during payment verification." },
      { status: 500 }
    );
  }
}
