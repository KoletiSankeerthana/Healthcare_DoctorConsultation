import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000/api/v1";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader =
      request.headers.get("x-webhook-signature") ||
      request.headers.get("x-razorpay-signature") ||
      "";
    const timestampHeader = request.headers.get("x-webhook-timestamp") || "";

    let eventData: any = {};
    try {
      eventData = JSON.parse(rawBody);
    } catch (e) {
      // Malformed JSON
    }

    // Try forwarding to FastAPI backend over HTTP first
    try {
      const fastApiRes = await fetch(`${BACKEND_URL}/payments/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": signatureHeader,
          "x-webhook-timestamp": timestampHeader
        },
        body: rawBody
      });
      if (fastApiRes.ok) {
        const data = await fastApiRes.json();
        return NextResponse.json(data, { status: 200 });
      }
    } catch (e) {
      // Fall through to DB bridge
    }

    const payload = {
      raw_body: rawBody,
      signature_header: signatureHeader,
      timestamp_header: timestampHeader,
      event_data: eventData
    };

    const result = callDbBridge("payment_webhook", [], payload);

    if (!result || !result.success) {
      if (result?.status_code === 400) {
        return NextResponse.json({ error: result.error || "Invalid webhook signature" }, { status: 400 });
      }
    }

    return NextResponse.json(
      { status: "ok", received: true, message: result?.message || "Cashfree webhook processed" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[Cashfree Webhook] Processing error:", err);
    return NextResponse.json(
      { error: err.message || "Webhook handling error" },
      { status: 500 }
    );
  }
}
