import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const reset_token = (body.reset_token || body.token || "").trim();
    const new_password = body.new_password || body.password || "";
    const confirm_password = body.confirm_password || body.confirmPassword || "";

    if (!reset_token) {
      return NextResponse.json(
        { error: "Reset session token is missing or expired. Please start over." },
        { status: 400 }
      );
    }

    if (!new_password) {
      return NextResponse.json(
        { error: "Please enter a new password." },
        { status: 400 }
      );
    }

    if (new_password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters in length." },
        { status: 400 }
      );
    }

    if (confirm_password && new_password !== confirm_password) {
      return NextResponse.json(
        { error: "Passwords do not match. Please verify your entries." },
        { status: 400 }
      );
    }

    const dbRes = callDbBridge("auth_reset_password_with_token", [], {
      reset_token,
      new_password
    });

    if (!dbRes || !dbRes.success) {
      return NextResponse.json(
        { error: dbRes?.error || "Failed to reset password. The reset session may have expired." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Your password has been successfully reset. You can now log in with your new credentials.",
      role: dbRes.role,
      email: dbRes.email
    });
  } catch (err: any) {
    console.error("[ResetPassword] Exception:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during password reset." },
      { status: 500 }
    );
  }
}
