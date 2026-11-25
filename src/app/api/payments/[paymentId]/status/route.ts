import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { requireAuth } from "@/lib/server-auth";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000/api/v1";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> | { paymentId: string } }
) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    const resolved = await params;
    const paymentId = resolved.paymentId;

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId parameter required" }, { status: 400 });
    }

    // 1. Try FastAPI backend over HTTP (< 5ms)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const fastApiRes = await fetch(`${BACKEND_URL}/payments/${paymentId}/status?user_id=${user.id}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (fastApiRes.ok) {
        const data = await fastApiRes.json();
        return NextResponse.json(data, { status: 200 });
      }
    } catch (e) {}

    // 2. Direct Python DB bridge fallback
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
