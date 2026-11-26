import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/pythonBridge";
import { requireAuth } from "@/lib/server-auth";
import { sendAppointmentConfirmationEmails } from "@/lib/emailService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = requireAuth(request, ["patient", "admin"]);
  if (error) return error;

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Doctor ID is required" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const payload = {
      doctor_id: id,
      patient_name: body.patient_name || body.patientName || user.full_name,
      patient_email: body.patient_email || body.patientEmail || user.email,
      patient_phone: body.patient_phone || user.phone || "+91 98765 43210",
      date: body.date || new Date().toISOString().split("T")[0],
      time: body.time || "10:00 AM",
      start_time: body.start_time,
      end_time: body.end_time,
      type: body.type || "online",
      symptoms: body.symptoms || "General medical consultation",
      notes: body.notes || "",
      patient_id: user.patient_id || user.id
    };

    const res = callDbBridge("book_appointment", [], payload);

    if (!res || !res.success) {
      return NextResponse.json(
        { error: res?.error || "Unable to reserve appointment slot. Slot may be taken or doctor unavailable." },
        { status: 400 }
      );
    }

    // Trigger Gmail confirmation & notification
    if (res.appointment) {
      try {
        await sendAppointmentConfirmationEmails(res.appointment);
      } catch (e) {
        console.error("Non-fatal: Email dispatch failed after confirmed booking:", e);
      }
    }

    return NextResponse.json(res, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process appointment booking" },
      { status: 500 }
    );
  }
}
