import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { requireAuth } from "@/lib/server-auth";
import { getPaymentMode } from "@/lib/paymentConfig";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000/api/v1";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    const body = await request.json();
    const paymentMode = getPaymentMode();

    const payload = {
      ...body,
      user_id: user.id,
      payment_mode: paymentMode,
      patient_name: body.patient_name || user.full_name,
      patient_email: body.patient_email || user.email,
      patient_phone: body.patient_phone || user.phone
    };

    console.info(`[Payment API] Creating order for user=${user.id}, doctor_id=${payload.doctor_id}, mode=${paymentMode}`);

    // 1. Try FastAPI backend over HTTP (< 5ms)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const fastApiRes = await fetch(`${BACKEND_URL}/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (fastApiRes.ok) {
        const data = await fastApiRes.json();
        console.info(`[Payment API] Order created via FastAPI: order_id=${data.order_id}, rzp_order=${data.razorpay_order_id}`);
        return NextResponse.json(data, { status: 201 });
      }
    } catch (e) {
      // Backend offline or slow; fall back to direct SQLite bridge
    }

    // 2. Direct Python DB bridge fallback
    const result = callDbBridge("payment_create_order", [user.id], payload);

    if (!result || !result.success) {
      console.warn(`[Payment API] Order creation failed: ${result?.error}`);
      return NextResponse.json(
        { error: result?.error || "Unable to initialize payment order on gateway." },
        { status: 400 }
      );
    }

    console.info(`[Payment API] Order created via DB Bridge: order_id=${result.order_id}, rzp_order=${result.razorpay_order_id}`);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    console.error("[Payment API] /api/payments/create-order error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error creating payment order." },
      { status: 500 }
    );
  }
}
