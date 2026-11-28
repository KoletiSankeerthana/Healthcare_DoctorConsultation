import { NextResponse } from "next/server";
import { getPaymentMode } from "@/lib/paymentConfig";

export async function GET() {
  const mode = getPaymentMode();
  return NextResponse.json({
    payment_mode: mode,
    is_mock: mode === "mock",
    cashfree_env: (process.env.CASHFREE_ENV || "SANDBOX").toLowerCase()
  });
}
