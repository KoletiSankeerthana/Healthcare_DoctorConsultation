import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();
    const role = (body.role || "patient").trim().toLowerCase();
    const otp = (body.otp || "").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Email address is required." },
        { status: 400 }
      );
    }

    if (!otp || otp.length !== 6) {
      return NextResponse.json(
        { error: "Please enter the complete 6-digit verification code." },
        { status: 400 }
      );
    }

    const dbRes = callDbBridge("auth_verify_password_reset_otp", [], { email, role, otp });

    if (!dbRes || !dbRes.success) {
      return NextResponse.json(
        { error: dbRes?.error || "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code verified successfully.",
      reset_token: dbRes.reset_token,
      email: dbRes.email,
      role: dbRes.role
    });
  } catch (err: any) {
    console.error("[VerifyOTP] Exception:", err);
    return NextResponse.json(
      { error: err.message || "An error occurred while verifying the code." },
      { status: 500 }
    );
  }
}
