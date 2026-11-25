import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getGoogleClientId,
  getGoogleRedirectUri,
  getGmailOAuthStatus
} from "@/lib/gmailAuth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // If status query is present, return safe OAuth connection status
  if (searchParams.get("status") === "1" || searchParams.get("format") === "json") {
    const status = getGmailOAuthStatus();
    return NextResponse.json(status);
  }

  const clientId = getGoogleClientId();
  const redirectUri = getGoogleRedirectUri();

  if (!clientId) {
    return NextResponse.json(
      {
        error: "Google OAuth Client ID is not configured.",
        hint: "Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file."
      },
      { status: 500 }
    );
  }

  // Generate cryptographically random state for CSRF protection
  const state = crypto.randomBytes(24).toString("hex");

  // Construct Google OAuth 2.0 authorization URL
  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.send");
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "consent select_account");
  googleAuthUrl.searchParams.set("state", state);

  const loginHint = searchParams.get("login_hint");
  if (loginHint) {
    googleAuthUrl.searchParams.set("login_hint", loginHint);
  }

  // Redirect user to Google OAuth consent page and set state cookie
  const response = NextResponse.redirect(googleAuthUrl.toString());

  response.cookies.set("mediverse_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60 // 10 minutes
  });

  return response;
}
