import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { callDbBridge } from "@/lib/pythonBridge";

export async function GET(request: NextRequest) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const role = user.role;

  let notifications: any[] = [];
  if (role === "doctor") {
    const docId = searchParams.get("doctor_id") || user.doctor_id || user.id;
    notifications = callDbBridge("doctor_notifications", [docId]) || [];
  } else {
    const patId = searchParams.get("patient_id") || user.patient_id || user.id;
    notifications = callDbBridge("patient_notifications", [patId]) || [];
  }

  return NextResponse.json(notifications, { status: 200 });
}

export async function POST(request: NextRequest) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  try {
    const body = await request.json();
    const notifId = body.notification_id || body.id;
    if (!notifId) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    const res = callDbBridge("mark_notification_read", [notifId, user.role]);
    return NextResponse.json({ success: !!res?.success }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
