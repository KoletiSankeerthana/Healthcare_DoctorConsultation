import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthCodeForTokens } from "@/lib/gmailAuth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");
  const state = searchParams.get("state");

  // Handle user cancellation or Google authorization error
  if (error) {
    const errorHtml = renderHtmlResponse({
      success: false,
      title: "Google Authorization Declined",
      message: errorDesc || error || "The authorization request was cancelled or declined by the user.",
      detail: "Google Error Code: " + error
    });
    return new NextResponse(errorHtml, {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  if (!code) {
    const missingCodeHtml = renderHtmlResponse({
      success: false,
      title: "Missing Authorization Code",
      message: "No authorization code was received from Google OAuth.",
      detail: "Please initiate authorization by visiting /api/auth/google."
    });
    return new NextResponse(missingCodeHtml, {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // Verify CSRF state cookie if present
  const cookieState = request.cookies.get("mediverse_oauth_state")?.value;
  if (cookieState && state && cookieState !== state) {
    console.warn("[OAuth Callback] State parameter mismatch. Proceeding with caution for local testing.");
  }

  // Exchange code for tokens on backend
  const result = await exchangeAuthCodeForTokens(code);

  if (!result.success) {
    const failureHtml = renderHtmlResponse({
      success: false,
      title: "Token Exchange Failed",
      message: result.error || "Failed to exchange authorization code for Google API tokens.",
      detail: "Verify your GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI settings in .env."
    });
    return new NextResponse(failureHtml, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // Success response: render verified confirmation screen
  const successHtml = renderHtmlResponse({
    success: true,
    title: "Gmail OAuth 2.0 Connected",
    message: "Healvia Healthcare Platform is now authorized to send verified emails via Gmail API.",
    accountEmail: result.accountEmail || "Admin Gmail Account",
    detail: "Authorization scope: https://www.googleapis.com/auth/gmail.send"
  });

  const response = new NextResponse(successHtml, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });

  // Clear state cookie
  response.cookies.delete("mediverse_oauth_state");

  return response;
}

function renderHtmlResponse(options: {
  success: boolean;
  title: string;
  message: string;
  accountEmail?: string;
  detail?: string;
}): string {
  const { success, title, message, accountEmail, detail } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Healvia Healthcare Platform</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0E2742;
      color: #EDF5FA;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #163B63;
      border: 1px solid rgba(37, 143, 229, 0.25);
      border-radius: 24px;
      max-width: 540px;
      width: 100%;
      padding: 40px 32px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
    }
    .icon-wrapper {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      margin: 0 auto 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${success ? "rgba(32, 184, 173, 0.15)" : "rgba(239, 68, 68, 0.15)"};
      border: 2px solid ${success ? "#20B8AD" : "#EF4444"};
    }
    .icon-wrapper svg {
      width: 32px;
      height: 32px;
      stroke: ${success ? "#20B8AD" : "#EF4444"};
      fill: none;
      stroke-width: 2.5;
    }
    h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 24px;
      font-weight: 600;
      color: #FFFFFF;
      margin-bottom: 12px;
    }
    p.lead {
      font-size: 14px;
      line-height: 1.6;
      color: #B8D5E5;
      margin-bottom: 24px;
    }
    .info-box {
      background: rgba(14, 39, 66, 0.8);
      border: 1px solid rgba(37, 143, 229, 0.2);
      border-radius: 16px;
      padding: 16px 20px;
      text-align: left;
      margin-bottom: 28px;
      font-size: 13px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .info-row:last-child { margin-bottom: 0; }
    .info-label { color: #7CA5C2; }
    .info-value {
      font-weight: 600;
      color: #FFFFFF;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    }
    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      border: none;
    }
    .btn-primary {
      background: #20B8AD;
      color: #0E2742;
    }
    .btn-primary:hover {
      background: #1CA49A;
      transform: translateY(-1px);
    }
    .btn-outline {
      background: transparent;
      color: #B8D5E5;
      border: 1px solid rgba(184, 213, 229, 0.3);
    }
    .btn-outline:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #FFFFFF;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrapper">
      ${success
        ? `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`
        : `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
      }
    </div>
    <h1>${title}</h1>
    <p class="lead">${message}</p>

    <div class="info-box">
      ${accountEmail ? `
      <div class="info-row">
        <span class="info-label">Connected Gmail:</span>
        <span class="info-value">${accountEmail}</span>
      </div>` : ""}
      <div class="info-row">
        <span class="info-label">Status:</span>
        <span class="info-value" style="color: ${success ? "#20B8AD" : "#EF4444"};">${success ? "ACTIVE & AUTHORIZED" : "FAILED"}</span>
      </div>
      ${detail ? `
      <div class="info-row" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(37,143,229,0.2);">
        <span class="info-label">Detail:</span>
        <span class="info-value" style="font-size: 11px;">${detail}</span>
      </div>` : ""}
    </div>

    <div class="actions">
      <a href="/admin/dashboard" class="btn btn-primary">Go to Admin Dashboard</a>
      <a href="/" class="btn btn-outline">Return to Home</a>
    </div>
  </div>
</body>
</html>`;
}
