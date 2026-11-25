import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = body.identifier || body.email || body.phone || "";
    const password = body.password || "";
    const expected_role = body.expected_role || body.role;

    if (!identifier.trim()) {
      return NextResponse.json(
        { error: "Please enter your registered email address or mobile number." },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: "Please enter your password." },
        { status: 400 }
      );
    }

    const result = callDbBridge("auth_login", [], {
      identifier: identifier.trim(),
      password,
      expected_role
    });

    if (!result || result.error || !result.success) {
      return NextResponse.json(
        { error: result?.error || "Invalid credentials. Please verify your email/phone and password." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: result.user,
      redirect_url: result.redirect_url,
      message: `Welcome back, ${result.user.full_name}!`
    });

    // Set secure HTTP-only cookie with session token
    if (result.session_token) {
      response.cookies.set("mediverse_session", result.session_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 // 7 days
      });
      // Client-accessible role cookie for frontend UI routing
      response.cookies.set("mediverse_role", result.user.role, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60
      });
    }

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error during authentication." },
      { status: 500 }
    );
  }
}
