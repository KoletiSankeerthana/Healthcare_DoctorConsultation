import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { requireAuth } from "@/lib/server-auth";
import { getPaymentMode, generateDummyTransactionId } from "@/lib/paymentConfig";
import { sendAppointmentConfirmationEmails } from "@/lib/emailService";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000/api/v1";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    const body = await request.json();

    const serverPaymentMode = getPaymentMode();
    const isMock = body.payment_mode === "mock" || (serverPaymentMode === "mock" && !body.cf_payment_id && !body.razorpay_signature);

    if (isMock) {
      if (serverPaymentMode !== "mock") {
        return NextResponse.json(
          { error: "Mock payments are strictly prohibited when server is in cashfree mode or in production." },
          { status: 400 }
        );
      }
      if (!body.order_id && !body.cf_order_id && !body.razorpay_order_id) {
        return NextResponse.json(
          { error: "order_id or cf_order_id is required." },
          { status: 400 }
        );
      }
      if (!body.dummy_transaction_id && !body.cf_payment_id && !body.razorpay_payment_id) {
        body.dummy_transaction_id = generateDummyTransactionId();
      }
      body.payment_mode = "mock";
    } else {
      const activeOrderId = body.cf_order_id || body.order_id || body.razorpay_order_id;
      if (!activeOrderId) {
        console.warn("[Payment API] Missing required Cashfree order identifier in verification request.");
        return NextResponse.json(
          { error: "Missing required Cashfree order identifier." },
          { status: 400 }
        );
      }
    }

    const payload = {
      ...body,
      cf_order_id: body.cf_order_id || body.order_id || body.razorpay_order_id,
      user_id: user.id
    };

    console.info(`[Payment API] Verifying Cashfree payment: mode=${payload.payment_mode || "cashfree"}, order=${payload.cf_order_id}`);

    // 1. Try FastAPI backend over HTTP
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
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
        if (data.appointment) {
          try {
            await sendAppointmentConfirmationEmails(data.appointment);
          } catch (e) {
            console.error("Non-fatal: Email dispatch failed after payment verification:", e);
          }
        }
        return NextResponse.json(data, { status: 200 });
      } else {
        const errData = await fastApiRes.json().catch(() => ({}));
        console.warn(`[Payment API] FastAPI /payments/verify returned ${fastApiRes.status}:`, errData);
      }
    } catch (e: any) {
      console.warn("[Payment API] FastAPI verify call failed or timed out, trying DB bridge fallback:", e.message);
    }

    // 2. Direct Python DB bridge fallback
    const result = callDbBridge("payment_verify", [user.id], payload);

    if (!result || !result.success) {
      console.warn(`[Payment API] Payment verification failed via DB Bridge: ${result?.error}`);
      return NextResponse.json(
        {
          error: result?.error || "Payment verification failed with Cashfree gateway.",
          status: result?.status || "FAILED"
        },
        { status: 400 }
      );
    }

    console.info(`[Payment API] Verified via DB Bridge: payment_id=${result.payment?.id}`);
    if (result.appointment) {
      try {
        await sendAppointmentConfirmationEmails(result.appointment);
      } catch (e) {
        console.error("Non-fatal: Email dispatch failed after payment verification:", e);
      }
    }
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("[Payment API] /api/payments/verify error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error during payment verification." },
      { status: 500 }
    );
  }
}
