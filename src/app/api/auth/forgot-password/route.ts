import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { sendPasswordResetOtpEmail } from "@/lib/emailService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || body.identifier || "").trim().toLowerCase();
    const role = (body.role || "patient").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Please provide a valid registered email address." },
        { status: 400 }
      );
    }

    if (!["patient", "doctor"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid account type. Please select Patient or Doctor." },
        { status: 400 }
      );
    }

    // 1. Generate OTP in database
    const dbRes = callDbBridge("auth_request_password_reset_otp", [], { email, role });

    if (!dbRes || !dbRes.success) {
      return NextResponse.json(
        { error: dbRes?.error || `No registered ${role} account found with that email address.` },
        { status: 404 }
      );
    }

    // 2. Dispatch OTP via Gmail OAuth
    try {
      await sendPasswordResetOtpEmail({
        email: dbRes.email,
        recipientName: dbRes.user_name,
        role: dbRes.role,
        otp: dbRes.otp,
        expiresInMinutes: dbRes.expires_in_minutes || 10
      });
    } catch (emailErr: any) {
      console.error("[ForgotPassword] Failed to dispatch OTP email:", emailErr);
      return NextResponse.json(
        { error: "Failed to dispatch verification email via Gmail service. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been dispatched to ${dbRes.email}.`,
      email: dbRes.email,
      role: dbRes.role,
      expires_in_minutes: dbRes.expires_in_minutes || 10
    });
  } catch (err: any) {
    console.error("[ForgotPassword] Unhandled exception:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred while requesting password reset." },
      { status: 500 }
    );
  }
}
