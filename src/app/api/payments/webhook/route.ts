import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-razorpay-signature") || "";

    let eventData: any = {};
    try {
      eventData = JSON.parse(rawBody);
    } catch (e) {
      // Malformed JSON
    }

    const payload = {
      raw_body: rawBody,
      signature_header: signatureHeader,
      event_data: eventData
    };

    const result = callDbBridge("payment_webhook", [], payload);

    if (!result || !result.success) {
      if (result?.status_code === 400) {
        return NextResponse.json({ error: result.error || "Invalid webhook signature" }, { status: 400 });
      }
    }

    return NextResponse.json(
      { status: "ok", received: true, message: result?.message || "Webhook processed" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return NextResponse.json(
      { error: err.message || "Webhook handling error" },
      { status: 500 }
    );
  }
}
