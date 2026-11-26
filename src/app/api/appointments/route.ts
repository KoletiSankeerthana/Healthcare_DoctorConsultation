import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/pythonBridge";
import { requireAuth } from "@/lib/server-auth";
import { sendAppointmentConfirmationEmails } from "@/lib/emailService";

export async function GET(request: NextRequest) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";

  // Strict role isolation: patient only accesses their own records
  let effectiveRole = user.role;
  let effectivePatientId = user.patient_id || user.id;
  let effectiveDoctorId = user.doctor_id;

  if (user.role === "admin") {
    effectiveRole = searchParams.get("role") || "patient";
    effectivePatientId = searchParams.get("patient_id") || effectivePatientId;
    effectiveDoctorId = searchParams.get("doctor_id") || effectiveDoctorId;
  }

  // Direct persistence via database bridge
  let apts: any[] = [];
  if (effectiveRole === "doctor" && effectiveDoctorId) {
    apts = callDbBridge("doctor_appointments", [effectiveDoctorId, status]) || [];
  } else {
    apts = callDbBridge("patient_appointments", [effectivePatientId, status]) || [];
  }

  return NextResponse.json(apts, { status: 200 });
}

export async function POST(request: NextRequest) {
  const { user, error } = requireAuth(request, ["patient", "admin"]);
  if (error) return error;

  try {
    const body = await request.json();

    // Enforce authenticated ownership & parameters
    const bookingPayload = {
      ...body,
      patient_id: user.patient_id || user.id,
      patient_name: body.patient_name || user.full_name,
      patient_email: body.patient_email || user.email,
      patient_phone: body.patient_phone || user.phone || "+91 98765 43210"
    };

    // Atomic reservation & automatic confirmation in SQLite database
    const res = callDbBridge("book_appointment", [], bookingPayload);
    if (!res || !res.success) {
      return NextResponse.json(
        { error: res?.error || "Unable to reserve appointment slot. Slot may be taken or doctor unavailable." },
        { status: 400 }
      );
    }

    // Trigger Gmail confirmation & notification; failure will not undo booking
    if (res.appointment) {
      try {
        await sendAppointmentConfirmationEmails(res.appointment);
      } catch (e) {
        console.error("Non-fatal: Email dispatch failed after confirmed booking:", e);
      }
    }

    return NextResponse.json(res, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to book appointment" }, { status: 500 });
  }
}
