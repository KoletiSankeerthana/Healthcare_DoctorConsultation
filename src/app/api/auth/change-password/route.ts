import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { callDbBridge } from "@/lib/dbBridge";
import { sendNotificationEmail } from "@/lib/emailService";

export async function POST(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);

    if (!user || !user.id) {
      return NextResponse.json(
        { error: "You must be signed in to change your password. Please log in and retry." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const current_password = body.current_password || body.currentPassword || "";
    const new_password = body.new_password || body.newPassword || "";
    const confirm_password = body.confirm_password || body.confirmPassword || "";

    if (!current_password) {
      return NextResponse.json(
        { error: "Please enter your current password." },
        { status: 400 }
      );
    }

    if (!new_password) {
      return NextResponse.json(
        { error: "Please enter your new password." },
        { status: 400 }
      );
    }

    if (new_password.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters in length." },
        { status: 400 }
      );
    }

    if (confirm_password && new_password !== confirm_password) {
      return NextResponse.json(
        { error: "New passwords do not match. Please verify your entries." },
        { status: 400 }
      );
    }

    if (current_password === new_password) {
      return NextResponse.json(
        { error: "New password cannot be identical to your current password." },
        { status: 400 }
      );
    }

    const result = callDbBridge("auth_change_password", [], {
      identifier: user.id,
      current_password,
      new_password
    });

    if (!result || !result.success) {
      return NextResponse.json(
        { error: result?.error || "Failed to update password. Please check your current password." },
        { status: 400 }
      );
    }

    // Optional: Dispatch a security notification email via Gmail OAuth
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      const subject = "Security Alert: Password Changed – Healvia";
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #EDF5FA; margin: 0; padding: 24px; color: #163B63; }
    .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px solid #D5E4EF; overflow: hidden; box-shadow: 0 4px 20px rgba(18, 61, 104, 0.08); }
    .header { background: linear-gradient(135deg, #123D68 0%, #163B63 100%); color: #ffffff; padding: 32px 28px; text-align: left; }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(32, 184, 173, 0.2); border: 1px solid rgba(32, 184, 173, 0.4); color: #20B8AD; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .content { padding: 32px 28px; line-height: 1.6; }
    .footer { padding: 20px 28px; background: #F8FBFE; border-top: 1px solid #DCECF8; font-size: 11px; color: #64748B; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div style="margin-bottom: 12px;">
        <img src="${appUrl}/images/healvia-logo.png" width="44" height="44" alt="HEALVIA" style="border-radius: 50%; vertical-align: middle; background: #ffffff; padding: 2px;" />
      </div>
      <span class="badge">Security Notification</span>
      <h1 style="margin: 12px 0 4px 0; font-size: 24px; font-weight: 500;">Password Successfully Changed</h1>
      <p style="margin: 0; font-size: 13px; opacity: 0.85;">Healvia Account Security Alert</p>
    </div>
    <div class="content">
      <p style="font-size: 15px; margin-top: 0;">Dear <strong>${user.full_name || "Valued User"}</strong>,</p>
      <p style="font-size: 13.5px; color: #526A82;">
        The password for your Healvia account (<strong>${user.email}</strong>) was successfully changed on <strong>${timestamp} (IST)</strong>.
      </p>
      <div style="background: #F1F7FC; border-radius: 12px; padding: 14px 16px; margin: 20px 0; font-size: 12px; color: #475569;">
        <strong>Didn't make this change?</strong> If you did not authorize this password update, please reset your password immediately at <a href="${appUrl}/forgot-password" style="color: #258FE5; font-weight: 600;">${appUrl}/forgot-password</a> and contact our support team at <a href="mailto:care@healvia.com" style="color: #258FE5; font-weight: 600;">care@healvia.com</a>.
      </div>
      <p style="font-size: 12px; color: #64748B;">
        Thank you for helping us keep your health account secure.
      </p>
    </div>
    <div class="footer">
      Healvia Healthcare Ecosystem &bull; Account Security &bull; Confidential & Encrypted
    </div>
  </div>
</body>
</html>`;

      sendNotificationEmail({
        appointmentId: `sec-pwd-${Date.now()}`,
        recipientEmail: user.email,
        recipientRole: (user.role as any) || "patient",
        recipientName: user.full_name || "User",
        subject,
        htmlContent,
        textContent: `Your Healvia password was successfully changed on ${timestamp} IST. If you did not make this change, please contact care@healvia.com immediately.`,
        idempotencyKey: `pwd-change-${user.id}-${Date.now().toString(36)}`
      }).catch((err: any) => console.error("[ChangePassword] Security email error:", err));
    } catch (e) {
      console.warn("[ChangePassword] Non-fatal notification error:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Your password has been changed successfully."
    });
  } catch (err: any) {
    console.error("[ChangePassword] Unhandled exception:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
