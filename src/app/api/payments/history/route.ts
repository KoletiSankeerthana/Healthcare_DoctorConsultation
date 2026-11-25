import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { requireAuth } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = requireAuth(request);
    if (error) return error;
    const result = callDbBridge("payment_history", [user.id, user.role]);

    return NextResponse.json(result || [], { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
