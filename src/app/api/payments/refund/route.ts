import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { requireAuth } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    const body = await request.json();
    const paymentId = body.payment_id || body.paymentId;

    if (!paymentId) {
      return NextResponse.json({ error: "payment_id is required." }, { status: 400 });
    }

    const payload = {
      payment_id: paymentId,
      user_id: user.id,
      amount: body.amount,
      reason: body.reason || "Patient requested refund"
    };

    const result = callDbBridge("payment_refund", [paymentId, user.id], payload);

    if (!result || !result.success) {
      return NextResponse.json(
        { error: result?.error || "Failed to process refund." },
        { status: 400 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
