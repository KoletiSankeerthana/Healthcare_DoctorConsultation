import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { requireAuth } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("payment_id") || searchParams.get("id") || searchParams.get("order_id");

    if (!paymentId) {
      return NextResponse.json({ error: "payment_id or order_id query param is required." }, { status: 400 });
    }

    const result = callDbBridge("payment_status", [paymentId, user.id]);

    if (!result || !result.success) {
      return NextResponse.json(
        { error: result?.error || "Payment record not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
