import { callDbBridge } from "@/lib/pythonBridge";
import { getValidGmailAccessToken, getStoredOAuthTokens } from "@/lib/gmailAuth";

export interface AppointmentEmailPayload {
  id: string;
  reference?: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialty: string;
  doctor_email?: string;
  doctor_phone?: string;
  doctor_avatar?: string;
  patient_id?: string;
  patient_name: string;
  patient_email: string;
  patient_phone?: string;
  date: string;
  time: string;
  start_time?: string;
  end_time?: string;
  timezone?: string;
  type?: "online" | "in-person" | string;
  fee?: number;
  clinic_name?: string;
  meeting_room_id?: string;
  meeting_link?: string;
  symptoms?: string;
}

export interface EmailDispatchResult {
  recipient_role: "patient" | "doctor" | "admin";
  recipient_email: string;
  success: boolean;
  status: "sent" | "queued" | "failed" | "duplicate";
  message_id?: string;
  error?: string;
}

/**
 * Encodes a string to RFC 4648 Base64URL without padding for the Gmail API.
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generates an RFC 2822 / MIME format email message string.
 */
function createMimeMessage({
  from,
  to,
  subject,
  html,
  text
}: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): string {
  const boundary = `__MEDIVERSE_BOUNDARY_${Date.now()}__`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    "",
    `--${boundary}--`
  ];

  return lines.join("\r\n");
}

/**
 * Attempts transmission through live Gmail REST API if credentials exist.
 */
async function sendViaGmailApi(
  rawMime: string,
  accessToken: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ raw: base64UrlEncode(rawMime) })
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, messageId: data.id };
    }

    const errText = await response.text();
    return { success: false, error: `Gmail API responded with ${response.status}: ${errText}` };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to connect to Gmail API" };
  }
}

/**
 * Sends a single notification email with automatic retry and idempotency logging.
 */
async function sendNotificationEmail({
  appointmentId,
  recipientEmail,
  recipientRole,
  recipientName,
  subject,
  htmlContent,
  textContent,
  idempotencyKey
}: {
  appointmentId?: string;
  recipientEmail: string;
  recipientRole: "patient" | "doctor" | "admin";
  recipientName: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  idempotencyKey: string;
}): Promise<EmailDispatchResult> {
  const maxRetries = 3;
  let attempt = 0;
  let lastError: string | undefined;

  const storedTokens = getStoredOAuthTokens();
  const senderEmail =
    storedTokens?.account_email ||
    process.env.GMAIL_SENDER_EMAIL ||
    process.env.GMAIL_USER ||
    "adminhealthcare4@gmail.com";
  const senderName = "MediVerse Healthcare Sanctuary";
  const fromAddress = `"${senderName}" <${senderEmail}>`;

  const mimeMessage = createMimeMessage({
    from: fromAddress,
    to: recipientEmail,
    subject,
    html: htmlContent,
    text: textContent
  });

  // Deduplication check: Suppress sending duplicate emails if already recorded as sent
  if (idempotencyKey) {
    try {
      const logs = callDbBridge("get_email_logs", [appointmentId || ""]);
      if (Array.isArray(logs)) {
        const alreadySent = logs.find(
          (l: any) => l.idempotency_key === idempotencyKey && l.status === "sent"
        );
        if (alreadySent) {
          console.info(`[emailService] Deduplication: Email for key "${idempotencyKey}" already delivered. Suppressing duplicate.`);
          return {
            recipient_role: recipientRole,
            recipient_email: recipientEmail,
            success: true,
            status: "duplicate",
            message_id: alreadySent.id
          };
        }
      }
    } catch (_) {}
  }

  const gmailAccessToken = await getValidGmailAccessToken();

  if (!gmailAccessToken) {
    const errorMsg = "Gmail API OAuth 2.0 access token is not configured or expired. Please authorize admin Gmail account at /api/auth/google.";
    console.warn(`[emailService] ${errorMsg}`);

    // Log unfulfilled delivery in audit table without simulating success
    callDbBridge("log_email", [], {
      appointment_id: appointmentId,
      recipient_email: recipientEmail,
      recipient_role: recipientRole,
      recipient_name: recipientName,
      subject,
      body_html: htmlContent,
      body_text: textContent,
      idempotency_key: idempotencyKey,
      status: "failed",
      delivery_provider: "gmail_api",
      error_message: errorMsg,
      retry_count: 0
    });

    return {
      recipient_role: recipientRole,
      recipient_email: recipientEmail,
      success: false,
      status: "failed",
      error: errorMsg
    };
  }

  while (attempt < maxRetries) {
    attempt++;
    try {
      const liveResult = await sendViaGmailApi(mimeMessage, gmailAccessToken);
      if (liveResult.success) {
        // Log confirmed dispatch to SQLite audit table
        callDbBridge("log_email", [], {
          appointment_id: appointmentId,
          recipient_email: recipientEmail,
          recipient_role: recipientRole,
          recipient_name: recipientName,
          subject,
          body_html: htmlContent,
          body_text: textContent,
          idempotency_key: idempotencyKey,
          status: "sent",
          delivery_provider: "gmail_api",
          retry_count: attempt - 1
        });

        return {
          recipient_role: recipientRole,
          recipient_email: recipientEmail,
          success: true,
          status: "sent",
          message_id: liveResult.messageId
        };
      }
      lastError = liveResult.error;
    } catch (err: any) {
      lastError = err.message;
    }

    if (attempt < maxRetries) {
      // Exponential backoff
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 200));
    }
  }

  // Record failed delivery in audit table without throwing
  callDbBridge("log_email", [], {
    appointment_id: appointmentId,
    recipient_email: recipientEmail,
    recipient_role: recipientRole,
    recipient_name: recipientName,
    subject,
    body_html: htmlContent,
    body_text: textContent,
    idempotency_key: idempotencyKey,
    status: "failed",
    delivery_provider: "gmail_api",
    error_message: lastError,
    retry_count: attempt
  });

  return {
    recipient_role: recipientRole,
    recipient_email: recipientEmail,
    success: false,
    status: "failed",
    error: lastError
  };
}

/**
 * Dispatches both Patient Confirmation and Doctor Notification emails.
 * Failure to send emails will never rollback or fail the confirmed appointment.
 */
export async function sendAppointmentConfirmationEmails(
  appointment: AppointmentEmailPayload
): Promise<{ patient: EmailDispatchResult; doctor: EmailDispatchResult }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const refCode = appointment.reference || appointment.id;
  const isOnline = (appointment.type || "online") === "online";
  const consultModeLabel = isOnline ? "Encrypted HD Telemedicine (WebRTC)" : "In-Person Clinical Visit";
  const roomUrl = appointment.meeting_room_id
    ? `${appUrl}/consultation/${appointment.meeting_room_id}?role=patient&name=${encodeURIComponent(appointment.patient_name)}`
    : `${appUrl}/patient/dashboard`;
  const doctorRoomUrl = appointment.meeting_room_id
    ? `${appUrl}/consultation/${appointment.meeting_room_id}?role=doctor&name=${encodeURIComponent(appointment.doctor_name)}`
    : `${appUrl}/doctor/dashboard`;

  // 1. Patient Confirmation Email
  const patientSubject = `Appointment Confirmed: Consultation with ${appointment.doctor_name} [Ref: ${refCode}]`;
  const patientHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #EDF5FA; margin: 0; padding: 24px; color: #163B63; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px solid #D5E4EF; overflow: hidden; box-shadow: 0 4px 20px rgba(18, 61, 104, 0.08); }
    .header { background: linear-gradient(135deg, #123D68 0%, #163B63 100%); color: #ffffff; padding: 32px 28px; text-align: left; }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(32, 184, 173, 0.2); border: 1px solid rgba(32, 184, 173, 0.4); color: #20B8AD; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .content { padding: 32px 28px; line-height: 1.6; }
    .info-box { background: #F8FBFE; border: 1px solid #DCECF8; border-radius: 16px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #EDF5FA; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .btn { display: inline-block; padding: 14px 28px; background: #258FE5; color: #ffffff !important; text-decoration: none; border-radius: 9999px; font-weight: 600; font-size: 14px; margin-top: 16px; }
    .footer { padding: 20px 28px; background: #F8FBFE; border-top: 1px solid #DCECF8; font-size: 11px; color: #64748B; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">Appointment Confirmed</span>
      <h1 style="margin: 12px 0 4px 0; font-size: 24px; font-weight: 500;">MediVerse Healthcare Sanctuary</h1>
      <p style="margin: 0; font-size: 13px; opacity: 0.85;">Official Clinical Consultation Confirmation</p>
    </div>
    <div class="content">
      <p style="font-size: 15px; margin-top: 0;">Dear <strong>${appointment.patient_name}</strong>,</p>
      <p style="font-size: 13px; color: #526A82;">Your upcoming consultation has been automatically confirmed by our clinical scheduling system.</p>

      <div class="info-box">
        <div class="info-row"><span>Appointment ID:</span><strong>${appointment.id}</strong></div>
        <div class="info-row"><span>Booking Reference:</span><strong style="color: #258FE5;">${refCode}</strong></div>
        <div class="info-row"><span>Consulting Doctor:</span><strong>${appointment.doctor_name}</strong></div>
        <div class="info-row"><span>Medical Specialty:</span><span>${appointment.doctor_specialty}</span></div>
        <div class="info-row"><span>Scheduled Date:</span><strong>${appointment.date}</strong></div>
        <div class="info-row"><span>Consultation Window:</span><strong>${appointment.time} (IST)</strong></div>
        <div class="info-row"><span>Consultation Mode:</span><span>${consultModeLabel}</span></div>
        ${appointment.clinic_name && !isOnline ? `<div class="info-row"><span>Clinic Premises:</span><span>${appointment.clinic_name}</span></div>` : ""}
      </div>

      ${
        isOnline
          ? `
      <div style="text-align: center; margin: 28px 0;">
        <p style="font-size: 13px; color: #526A82; margin-bottom: 12px;">Your secure encrypted video room is ready for consultation:</p>
        <a href="${roomUrl}" class="btn">Enter Video Consultation Room &rarr;</a>
      </div>`
          : `
      <div style="text-align: center; margin: 28px 0;">
        <a href="${appUrl}/patient/dashboard" class="btn">View Appointment in Sanctuary Dashboard &rarr;</a>
      </div>`
      }

      <p style="font-size: 12px; color: #64748B; margin-top: 24px;">
        Please join 5 minutes before your scheduled consultation slot. For support or rescheduling inquiries, contact our clinical care desk.
      </p>
    </div>
    <div class="footer">
      MediVerse Healthcare Ecosystem • Clinical Care Services • Confidential & Encrypted
    </div>
  </div>
</body>
</html>`;

  const patientText = `
MediVerse Healthcare Platform - Appointment Confirmation

Dear ${appointment.patient_name},

Your consultation with ${appointment.doctor_name} (${appointment.doctor_specialty}) has been confirmed.

Details:
- Appointment ID: ${appointment.id}
- Reference: ${refCode}
- Date: ${appointment.date}
- Time: ${appointment.time} (IST)
- Mode: ${consultModeLabel}
${isOnline ? `- Consultation Room URL: ${roomUrl}` : `- Clinic: ${appointment.clinic_name || "MediVerse Medical Clinic"}`}

Access your dashboard at: ${appUrl}/patient/dashboard
`;

  // 2. Doctor Notification Email
  const doctorSubject = `New Patient Scheduled: ${appointment.patient_name} [${appointment.date} at ${appointment.time}]`;
  const doctorEmail = appointment.doctor_email || "dr.arvind@apexheart.in";
  const doctorHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #EDF5FA; margin: 0; padding: 24px; color: #163B63; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; border: 1px solid #D5E4EF; overflow: hidden; box-shadow: 0 4px 20px rgba(18, 61, 104, 0.08); }
    .header { background: linear-gradient(135deg, #163B63 0%, #123D68 100%); color: #ffffff; padding: 32px 28px; text-align: left; }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(37, 143, 229, 0.25); border: 1px solid rgba(37, 143, 229, 0.4); color: #8FD0FF; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .content { padding: 32px 28px; line-height: 1.6; }
    .info-box { background: #F8FBFE; border: 1px solid #DCECF8; border-radius: 16px; padding: 20px; margin: 20px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #EDF5FA; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .btn { display: inline-block; padding: 14px 28px; background: #20B8AD; color: #ffffff !important; text-decoration: none; border-radius: 9999px; font-weight: 600; font-size: 14px; margin-top: 16px; }
    .footer { padding: 20px 28px; background: #F8FBFE; border-top: 1px solid #DCECF8; font-size: 11px; color: #64748B; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">Doctor Schedule Notice</span>
      <h1 style="margin: 12px 0 4px 0; font-size: 24px; font-weight: 500;">New Confirmed Consultation</h1>
      <p style="margin: 0; font-size: 13px; opacity: 0.85;">Patient-Initiated Booking via Published Schedule</p>
    </div>
    <div class="content">
      <p style="font-size: 15px; margin-top: 0;">Dear <strong>${appointment.doctor_name}</strong>,</p>
      <p style="font-size: 13px; color: #526A82;">A new patient consultation has been reserved from your available schedule slots.</p>

      <div class="info-box">
        <div class="info-row"><span>Patient Name:</span><strong>${appointment.patient_name}</strong></div>
        <div class="info-row"><span>Patient Email:</span><span>${appointment.patient_email}</span></div>
        <div class="info-row"><span>Contact Phone:</span><span>${appointment.patient_phone || "Not recorded"}</span></div>
        <div class="info-row"><span>Consultation Date:</span><strong>${appointment.date}</strong></div>
        <div class="info-row"><span>Slot Time:</span><strong>${appointment.time} (IST)</strong></div>
        <div class="info-row"><span>Consultation Mode:</span><span>${consultModeLabel}</span></div>
        <div class="info-row"><span>Symptoms / Reason:</span><span>${appointment.symptoms || "General medical consultation"}</span></div>
        <div class="info-row"><span>Appointment ID:</span><strong>${appointment.id}</strong></div>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${isOnline ? doctorRoomUrl : `${appUrl}/doctor/dashboard`}" class="btn">
          ${isOnline ? "Open Consultation Video Room &rarr;" : "Open Doctor Dashboard &rarr;"}
        </a>
      </div>
    </div>
    <div class="footer">
      MediVerse Practitioner Portal • Automatic Schedule Coordination
    </div>
  </div>
</body>
</html>`;

  const doctorText = `
MediVerse Healthcare Platform - Doctor Schedule Notification

Dear ${appointment.doctor_name},

A new patient appointment has been confirmed for you.

Details:
- Patient: ${appointment.patient_name} (${appointment.patient_email}, ${appointment.patient_phone || "N/A"})
- Date: ${appointment.date}
- Time: ${appointment.time} (IST)
- Mode: ${consultModeLabel}
- Symptoms: ${appointment.symptoms || "General clinical evaluation"}
- Appointment ID: ${appointment.id}
${isOnline ? `- Video Room URL: ${doctorRoomUrl}` : `- Dashboard: ${appUrl}/doctor/dashboard`}
`;

  // Dispatch both notifications concurrently
  const [patientResult, doctorResult] = await Promise.all([
    sendNotificationEmail({
      appointmentId: appointment.id,
      recipientEmail: appointment.patient_email,
      recipientRole: "patient",
      recipientName: appointment.patient_name,
      subject: patientSubject,
      htmlContent: patientHtml,
      textContent: patientText,
      idempotencyKey: `apt-confirm-${appointment.id}-patient`
    }),
    sendNotificationEmail({
      appointmentId: appointment.id,
      recipientEmail: doctorEmail,
      recipientRole: "doctor",
      recipientName: appointment.doctor_name,
      subject: doctorSubject,
      htmlContent: doctorHtml,
      textContent: doctorText,
      idempotencyKey: `apt-confirm-${appointment.id}-doctor`
    })
  ]);

  return { patient: patientResult, doctor: doctorResult };
}

export interface DoctorRegistrationPayload {
  doctorId?: string;
  doctorName: string;
  doctorEmail: string;
  doctorPhone?: string;
  specialty?: string;
  qualification?: string;
  registrationNumber?: string;
  council?: string;
  experienceYears?: number | string;
  hospital?: string;
  clinicDetails?: string;
  applicationReference?: string;
  submittedAt?: string;
  status?: string;
}

/**
 * Dispatches an automated administrative alert to ADMIN_NOTIFICATION_EMAIL (adminhealthcare4@gmail.com)
 * whenever a genuine new doctor registers and is successfully persisted in the database.
 */
export async function sendDoctorRegistrationNotification(
  payload: DoctorRegistrationPayload
): Promise<EmailDispatchResult> {
  const adminEmail =
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    "adminhealthcare4@gmail.com";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const refId = payload.applicationReference || payload.doctorId || `DOC-${Date.now()}`;
  
  // Exact subject as specified by requirements
  const subject = "New Doctor Registration – MediVerse Healthcare Sanctuary";

  const submissionTime = payload.submittedAt
    ? new Date(payload.submittedAt).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    : new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

  const statusLabel = payload.status === "approved"
    ? "Approved Practitioner"
    : "Pending Administrative Review & Credential Verification";

  const cleanDoctorName = (payload.doctorName || "Medical Practitioner").replace(/^Dr\.\s*/i, "");
  const phoneDisplay = payload.doctorPhone && payload.doctorPhone.trim() ? payload.doctorPhone.trim() : "Not provided";
  const expDisplay = payload.experienceYears ? `${payload.experienceYears} Years` : "Not specified";
  const hospitalDisplay = payload.hospital
    ? `${payload.hospital}${payload.clinicDetails ? ` • ${payload.clinicDetails}` : ""}`
    : (payload.clinicDetails || "Private Practice / Clinical Facility");

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; margin: 0; padding: 24px; -webkit-font-smoothing: antialiased; }
    .card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
    .header { background: linear-gradient(135deg, #0E2742 0%, #163B63 55%, #0284c7 100%); color: #ffffff; padding: 32px 28px; text-align: left; }
    .tag { display: inline-block; background: rgba(32, 184, 173, 0.25); border: 1px solid rgba(32, 184, 173, 0.6); color: #20B8AD; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #ffffff; line-height: 1.3; }
    .header p { margin: 0; opacity: 0.9; font-size: 14px; line-height: 1.5; color: #cbd5e1; }
    .body { padding: 28px; }
    .doctor-badge { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; }
    .doctor-name { font-size: 19px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0; }
    .doctor-sub { font-size: 13px; color: #64748b; margin: 0 0 10px 0; }
    .status-pill { display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 9999px; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .info-table td { padding: 11px 12px; font-size: 13.5px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .info-table td.label { font-weight: 600; color: #475569; width: 36%; background: #fafbfc; }
    .info-table td.val { color: #0f172a; font-weight: 500; }
    .cta-container { text-align: center; margin: 32px 0 12px 0; }
    .btn { display: inline-block; background: #258FE5; color: #ffffff !important; font-weight: 600; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-size: 14px; box-shadow: 0 4px 12px rgba(37, 143, 229, 0.25); }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="tag">Clinical Governance & Compliance</span>
      <h1>New Doctor Registration</h1>
      <p>A licensed healthcare practitioner has registered and submitted credentials for administrative verification.</p>
    </div>
    <div class="body">
      <div class="doctor-badge">
        <div class="doctor-name">Dr. ${cleanDoctorName}</div>
        <div class="doctor-sub">${payload.specialty || "Medical Practitioner"} &bull; ${payload.qualification || "MBBS"}</div>
        <span class="status-pill">${statusLabel}</span>
      </div>

      <div class="section-title">Practitioner Profile & Credentials</div>
      <table class="info-table">
        <tr><td class="label">Doctor's Full Name</td><td class="val"><strong>Dr. ${cleanDoctorName}</strong></td></tr>
        <tr><td class="label">Email Address</td><td class="val"><a href="mailto:${payload.doctorEmail}" style="color: #258FE5; text-decoration: none; font-weight: 600;">${payload.doctorEmail}</a></td></tr>
        <tr><td class="label">Phone Number</td><td class="val">${phoneDisplay}</td></tr>
        <tr><td class="label">Medical Specialization</td><td class="val"><strong>${payload.specialty || "General Medicine"}</strong></td></tr>
        <tr><td class="label">Qualifications</td><td class="val">${payload.qualification || "MBBS"}</td></tr>
        <tr><td class="label">Years of Experience</td><td class="val">${expDisplay}</td></tr>
        <tr><td class="label">Hospital / Clinic Details</td><td class="val">${hospitalDisplay}</td></tr>
        ${payload.registrationNumber ? `<tr><td class="label">Registration / Council</td><td class="val">${payload.registrationNumber}${payload.council ? ` (${payload.council})` : ""}</td></tr>` : ""}
        <tr><td class="label">Registration Date & Time</td><td class="val">${submissionTime} (IST)</td></tr>
        <tr><td class="label">Account Status</td><td class="val"><strong style="color: #d97706;">${statusLabel}</strong></td></tr>
        <tr><td class="label">Application Reference</td><td class="val"><code style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #163B63;">${refId}</code></td></tr>
      </table>

      <div class="cta-container">
        <a href="${appUrl}/admin/dashboard" class="btn">
          Review Application in Admin Portal &rarr;
        </a>
      </div>
    </div>
    <div class="footer">
      MediVerse Healthcare Sanctuary &bull; Automated Clinical Credentialing Engine<br>
      Independent audit of physician council credentials, state registries, degree authenticity, and practice licenses.
    </div>
  </div>
</body>
</html>`;

  const textContent = `
New Doctor Registration – MediVerse Healthcare Sanctuary
========================================================

A licensed healthcare practitioner has registered and submitted credentials for administrative verification.

Practitioner Details:
- Doctor's Full Name: Dr. ${cleanDoctorName}
- Email Address: ${payload.doctorEmail}
- Phone Number: ${phoneDisplay}
- Medical Specialization: ${payload.specialty || "General Medicine"}
- Qualifications: ${payload.qualification || "MBBS"}
- Years of Experience: ${expDisplay}
- Hospital/Clinic Details: ${hospitalDisplay}
- Medical Registration No: ${payload.registrationNumber || "Pending Council Verification"}
- Medical Council: ${payload.council || "State Medical Council"}
- Registration Date & Time: ${submissionTime} (IST)
- Account/Application Status: ${statusLabel}
- Application Reference: ${refId}

Review and verify the practitioner's credentials in the administrator dashboard:
${appUrl}/admin/dashboard
`;

  return sendNotificationEmail({
    appointmentId: `reg-${refId}`,
    recipientEmail: adminEmail,
    recipientRole: "admin",
    recipientName: "System Administrator",
    subject,
    htmlContent,
    textContent,
    idempotencyKey: `doc-reg-alert-${refId}`
  });
}

/**
 * Sends a live integration test email via the actual Gmail API
 * using current OAuth 2.0 credentials and logs the delivery result.
 */
export async function sendAdminTestEmail(
  recipientEmail: string = "adminhealthcare4@gmail.com"
): Promise<EmailDispatchResult> {
  const targetEmail = recipientEmail.trim() || "adminhealthcare4@gmail.com";
  const timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const testBatchId = `test-${Date.now().toString(36).toUpperCase()}`;
  const subject = `[MediVerse Verification] Live Gmail OAuth 2.0 API Test (${timestamp} IST)`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MediVerse Gmail API Test</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f0fdf4; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #bbf7d0; box-shadow: 0 10px 25px -5px rgba(22, 163, 74, 0.1); }
    .header { background: linear-gradient(135deg, #16a34a, #0f766e); color: white; padding: 28px 24px; text-align: left; }
    .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 700; }
    .badge { display: inline-block; background: rgba(255,255,255,0.25); color: #fff; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; }
    .content { padding: 28px 24px; }
    .status-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 16px; margin: 16px 0; color: #166534; font-size: 14px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .info-table td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
    .info-table td.label { font-weight: 600; color: #64748b; width: 38%; }
    .info-table td.val { color: #0f172a; font-weight: 500; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">&check; Live OAuth 2.0 Dispatch</span>
      <h1>Gmail API Integration Active</h1>
      <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Automated test transmission from MediVerse Healthcare Sanctuary.</p>
    </div>
    <div class="content">
      <div class="status-box">
        &check; <strong>Live Delivery Verified:</strong> This message was transmitted directly through Google's REST API using your authorized OAuth 2.0 credentials.
      </div>
      <table class="info-table">
        <tr><td class="label">Recipient Address</td><td class="val"><strong>${targetEmail}</strong></td></tr>
        <tr><td class="label">Test Batch ID</td><td class="val"><code>${testBatchId}</code></td></tr>
        <tr><td class="label">Authentication Provider</td><td class="val">Google Cloud OAuth 2.0 (Gmail API)</td></tr>
        <tr><td class="label">OAuth Scope</td><td class="val"><code>https://www.googleapis.com/auth/gmail.send</code></td></tr>
        <tr><td class="label">Dispatched At</td><td class="val">${timestamp} (IST)</td></tr>
        <tr><td class="label">Delivery Mode</td><td class="val"><strong style="color: #16a34a;">Real Gmail REST API (No Simulation)</strong></td></tr>
      </table>
    </div>
    <div class="footer">
      MediVerse Healthcare Sanctuary • Clinical Governance & Communications System
    </div>
  </div>
</body>
</html>`;

  const textContent = `
MediVerse Healthcare Sanctuary - Gmail API Live Test
====================================================
This test email confirms that your Gmail OAuth 2.0 integration is active and operating correctly.

- Recipient: ${targetEmail}
- Test Batch ID: ${testBatchId}
- Provider: Google Cloud OAuth 2.0 (Gmail API)
- Dispatched At: ${timestamp} (IST)
- Mode: Real Gmail REST API (No simulated delivery)
`;

  return sendNotificationEmail({
    appointmentId: testBatchId,
    recipientEmail: targetEmail,
    recipientRole: "admin",
    recipientName: "System Administrator",
    subject,
    htmlContent,
    textContent,
    idempotencyKey: `test-email-${testBatchId}`
  });
}

export interface DoctorApprovalPayload {
  applicationId: string;
  doctorName: string;
  doctorEmail: string;
  applicationReference: string;
  specialty?: string;
  decisionId?: string;
  approvedAt?: string;
}

/**
 * Dispatches an automated approval notification to the approved doctor's registered email address.
 * Triggered strictly after database status confirms 'approved'.
 */
export async function sendDoctorApprovalNotification(
  payload: DoctorApprovalPayload
): Promise<EmailDispatchResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const cleanDoctorName = (payload.doctorName || "Doctor").replace(/^Dr\.\s*/i, "");
  const subject = "Congratulations! Your Doctor Registration Has Been Approved – MediVerse";
  const approvalDate = payload.approvedAt
    ? new Date(payload.approvedAt).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    : new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const decisionKey = payload.decisionId || "approved";

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; margin: 0; padding: 24px; -webkit-font-smoothing: antialiased; }
    .card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
    .header { background: linear-gradient(135deg, #065f46 0%, #0f766e 50%, #0284c7 100%); color: #ffffff; padding: 32px 28px; text-align: left; }
    .tag { display: inline-block; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.4); color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #ffffff; line-height: 1.3; }
    .header p { margin: 0; opacity: 0.95; font-size: 14px; line-height: 1.5; color: #e2e8f0; }
    .body { padding: 28px; }
    .congrats-banner { background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; }
    .congrats-title { font-size: 17px; font-weight: 700; color: #166534; margin: 0 0 4px 0; }
    .congrats-text { font-size: 13.5px; color: #15803d; line-height: 1.5; margin: 0; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .info-table td { padding: 11px 12px; font-size: 13.5px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .info-table td.label { font-weight: 600; color: #475569; width: 36%; background: #fafbfc; }
    .info-table td.val { color: #0f172a; font-weight: 500; }
    .steps-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .step-item { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .step-num { width: 22px; height: 22px; border-radius: 50%; background: #258FE5; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; shrink-0; }
    .step-desc { font-size: 13px; color: #334155; line-height: 1.4; }
    .cta-container { text-align: center; margin: 28px 0 12px 0; }
    .btn { display: inline-block; background: #059669; color: #ffffff !important; font-weight: 600; padding: 14px 34px; border-radius: 10px; text-decoration: none; font-size: 14px; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3); }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="tag">&check; Accreditation Verified</span>
      <h1>Credential Verification Approved</h1>
      <p>Congratulations, Dr. ${cleanDoctorName}! Your clinical accreditation has been verified and your practitioner account is fully active.</p>
    </div>
    <div class="body">
      <div class="congrats-banner">
        <div class="congrats-title">Welcome to the MediVerse Practitioner Network!</div>
        <p class="congrats-text">Our administrative audit committee has reviewed and officially approved your medical council registration and practicing qualifications.</p>
      </div>

      <div class="section-title">Approved Practitioner Information</div>
      <table class="info-table">
        <tr><td class="label">Physician Name</td><td class="val"><strong>Dr. ${cleanDoctorName}</strong></td></tr>
        <tr><td class="label">Registered Email</td><td class="val"><strong>${payload.doctorEmail}</strong></td></tr>
        <tr><td class="label">Specialization</td><td class="val">${payload.specialty || "Specialist Physician"}</td></tr>
        <tr><td class="label">Reference ID</td><td class="val"><code style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #163B63;">${payload.applicationReference}</code></td></tr>
        <tr><td class="label">Approval Date</td><td class="val">${approvalDate} (IST)</td></tr>
        <tr><td class="label">Verification Status</td><td class="val"><strong style="color: #059669;">APPROVED &bull; Active in Directory</strong></td></tr>
      </table>

      <div class="section-title">Available Next Steps in MediVerse</div>
      <div class="steps-box">
        <div class="step-item">
          <div class="step-num">1</div>
          <div class="step-desc"><strong>Sign In:</strong> Log into the doctor workspace using your registered email and password.</div>
        </div>
        <div class="step-item">
          <div class="step-num">2</div>
          <div class="step-desc"><strong>Availability Management:</strong> Access your doctor dashboard to configure your working days, consultation duration, and start/end hours.</div>
        </div>
        <div class="step-item">
          <div class="step-num">3</div>
          <div class="step-desc"><strong>Accept Consultations:</strong> Begin conducting online video consultations and receiving appointment bookings directly from patients.</div>
        </div>
      </div>

      <div class="cta-container">
        <a href="${appUrl}/login?role=doctor" class="btn">
          Sign In to Doctor Dashboard &rarr;
        </a>
      </div>
    </div>
    <div class="footer">
      MediVerse Healthcare Sanctuary &bull; Clinical Governance & Practitioner Portal<br>
      Automated credential approval confirmation. For assistance, reach out to practitioner-support@mediverse.org.
    </div>
  </div>
</body>
</html>`;

  const textContent = `
Congratulations! Your Doctor Registration Has Been Approved – MediVerse
=======================================================================

Dear Dr. ${cleanDoctorName},

Congratulations! Your medical credential verification has been approved by the administrative committee. Your practitioner account is now active in the MediVerse healthcare platform.

Approved Account Summary:
- Physician: Dr. ${cleanDoctorName}
- Registered Email: ${payload.doctorEmail}
- Specialty: ${payload.specialty || "Specialist"}
- Registration Reference: ${payload.applicationReference}
- Approval Date: ${approvalDate} (IST)
- Status: APPROVED (Active)

Next Steps:
1. Log in to the Doctor Workspace: ${appUrl}/login?role=doctor
2. Open your Doctor Dashboard to configure your working schedule and slot duration in Availability Management.
3. Accept patient appointments and conduct secure telemedicine consultations.

Access Doctor Portal:
${appUrl}/login?role=doctor
`;

  return sendNotificationEmail({
    appointmentId: `decision-${payload.applicationId}`,
    recipientEmail: payload.doctorEmail,
    recipientRole: "doctor",
    recipientName: `Dr. ${cleanDoctorName}`,
    subject,
    htmlContent,
    textContent,
    idempotencyKey: `doc-decision-${payload.applicationId}-approve-${decisionKey}`
  });
}

export interface DoctorRejectionPayload {
  applicationId: string;
  doctorName: string;
  doctorEmail: string;
  applicationReference: string;
  rejectionReason: string;
  specialty?: string;
  decisionId?: string;
  rejectedAt?: string;
}

/**
 * Dispatches an automated rejection notification to the doctor's registered email address.
 * Triggered strictly after database status confirms 'rejected'.
 */
export async function sendDoctorRejectionNotification(
  payload: DoctorRejectionPayload
): Promise<EmailDispatchResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const cleanDoctorName = (payload.doctorName || "Doctor").replace(/^Dr\.\s*/i, "");
  const subject = "Update Regarding Your Doctor Registration – MediVerse";
  const decisionDate = payload.rejectedAt
    ? new Date(payload.rejectedAt).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    : new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const decisionKey = payload.decisionId || "rejected";

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; margin: 0; padding: 24px; -webkit-font-smoothing: antialiased; }
    .card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); }
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%); color: #ffffff; padding: 32px 28px; text-align: left; }
    .tag { display: inline-block; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); color: #fca5a5; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #ffffff; line-height: 1.3; }
    .header p { margin: 0; opacity: 0.9; font-size: 14px; line-height: 1.5; color: #cbd5e1; }
    .body { padding: 28px; }
    .rejection-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; }
    .rejection-title { font-size: 14px; font-weight: 700; color: #991b1b; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.05em; }
    .rejection-reason { font-size: 14px; color: #b91c1c; font-weight: 500; line-height: 1.5; margin: 0; background: #ffffff; padding: 12px 14px; border-radius: 8px; border: 1px solid #fee2e2; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .info-table td { padding: 11px 12px; font-size: 13.5px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .info-table td.label { font-weight: 600; color: #475569; width: 36%; background: #fafbfc; }
    .info-table td.val { color: #0f172a; font-weight: 500; }
    .guidance-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; font-size: 13px; color: #334155; line-height: 1.6; }
    .cta-container { text-align: center; margin: 28px 0 12px 0; }
    .btn { display: inline-block; background: #258FE5; color: #ffffff !important; font-weight: 600; padding: 14px 34px; border-radius: 10px; text-decoration: none; font-size: 14px; box-shadow: 0 4px 14px rgba(37, 143, 229, 0.25); }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="tag">Application Status Notice</span>
      <h1>Credential Verification Update</h1>
      <p>Official notification regarding your practitioner registration with MediVerse Healthcare Sanctuary.</p>
    </div>
    <div class="body">
      <p style="font-size: 15px; color: #1e293b; line-height: 1.6; margin-top: 0;">
        Dear <strong>Dr. ${cleanDoctorName}</strong>,
      </p>
      <p style="font-size: 13.5px; color: #475569; line-height: 1.6;">
        Thank you for your interest in joining the MediVerse clinical network. Following our regulatory credentialing review, we regret to inform you that your registration application could not be approved at this time.
      </p>

      <div class="rejection-box">
        <div class="rejection-title">Reason for Decision:</div>
        <div class="rejection-reason">${payload.rejectionReason}</div>
      </div>

      <div class="section-title">Application Record</div>
      <table class="info-table">
        <tr><td class="label">Physician Name</td><td class="val">Dr. ${cleanDoctorName}</td></tr>
        <tr><td class="label">Registered Email</td><td class="val"><strong>${payload.doctorEmail}</strong></td></tr>
        <tr><td class="label">Specialization</td><td class="val">${payload.specialty || "Specialist"}</td></tr>
        <tr><td class="label">Reference ID</td><td class="val"><code style="background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #163B63;">${payload.applicationReference}</code></td></tr>
        <tr><td class="label">Decision Date</td><td class="val">${decisionDate} (IST)</td></tr>
        <tr><td class="label">Status</td><td class="val"><strong style="color: #dc2626;">Not Approved</strong></td></tr>
      </table>

      <div class="section-title">Next Steps & Reapplication</div>
      <div class="guidance-box">
        Please review the reason stated above. If the rejection was due to missing, expired, or unreadable documentation, you are encouraged to update your documents or reapply with verified credentials. For clarification or dispute resolution, our administrative compliance team is available at <a href="mailto:support@mediverse.org" style="color: #258FE5; font-weight: 600;">support@mediverse.org</a>.
      </div>

      <div class="cta-container">
        <a href="${appUrl}/login?role=doctor" class="btn">
          Visit Practitioner Portal &rarr;
        </a>
      </div>
    </div>
    <div class="footer">
      MediVerse Healthcare Sanctuary &bull; Clinical Governance & Compliance<br>
      Statutory review record. If you have questions regarding council guidelines, contact compliance@mediverse.org.
    </div>
  </div>
</body>
</html>`;

  const textContent = `
Update Regarding Your Doctor Registration – MediVerse
=====================================================

Dear Dr. ${cleanDoctorName},

Thank you for your application to join the MediVerse clinical network. Following administrative review, we regret to inform you that your registration could not be approved at this time.

Decision Details:
- Physician: Dr. ${cleanDoctorName}
- Registered Email: ${payload.doctorEmail}
- Application Reference: ${payload.applicationReference}
- Decision Date: ${decisionDate} (IST)
- Status: Not Approved

Reason for Rejection:
${payload.rejectionReason}

Guidance:
Please review the reason specified above. You may address the highlighted issue and reapply with corrected documentation, or reach out to our compliance team at support@mediverse.org.

Practitioner Portal:
${appUrl}/login?role=doctor
`;

  return sendNotificationEmail({
    appointmentId: `decision-${payload.applicationId}`,
    recipientEmail: payload.doctorEmail,
    recipientRole: "doctor",
    recipientName: `Dr. ${cleanDoctorName}`,
    subject,
    htmlContent,
    textContent,
    idempotencyKey: `doc-decision-${payload.applicationId}-reject-${decisionKey}`
  });
}
