import { NextRequest, NextResponse } from "next/server";
import { sendAdminTestEmail } from "@/lib/emailService";
import { getGmailOAuthStatus } from "@/lib/gmailAuth";

export async function GET() {
  try {
    const status = getGmailOAuthStatus();
    return NextResponse.json(status);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to query OAuth status" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const recipient = (body.recipient || "adminhealthcare4@gmail.com").trim();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email address format.",
          recipient
        },
        { status: 400 }
      );
    }

    console.info(`[admin/test-email] Attempting live Gmail API dispatch to: ${recipient}`);
    const result = await sendAdminTestEmail(recipient);

    if (result.success) {
      return NextResponse.json({
        success: true,
        status: result.status,
        messageId: result.message_id,
        recipient: result.recipient_email,
        timestamp: new Date().toISOString(),
        message: `Live test email successfully delivered to ${result.recipient_email} via Gmail REST API.`
      });
    }

    // Return the exact error returned by Gmail API
    return NextResponse.json(
      {
        success: false,
        status: result.status,
        recipient: result.recipient_email,
        error: result.error || "Gmail API rejected the transmission request."
      },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[admin/test-email] Unhandled error during test email dispatch:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "An unexpected internal error occurred."
      },
      { status: 500 }
    );
  }
}
