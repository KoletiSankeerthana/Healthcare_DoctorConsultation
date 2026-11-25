import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/pythonBridge";
import { requireAuth } from "@/lib/server-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolved = await params;
  const id = resolved.id;
  const { searchParams } = new URL(request.url);
  const targetDate = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const mode = searchParams.get("mode") || "all";

  // Dynamic slot generation from doctor's real saved schedule in database
  const dynamicData = callDbBridge("get_slots", [id, targetDate, mode]);

  if (dynamicData) {
    return NextResponse.json(dynamicData, { status: 200 });
  }

  // Graceful fallback with clear reason if doctor record is not initialized
  return NextResponse.json(
    {
      doctor_id: id,
      date: targetDate,
      available: false,
      reason: "No available consultation slots found for this date.",
      total_available_slots: 0,
      slots: [],
      grouped_slots: { morning: [], afternoon: [], evening: [] }
    },
    { status: 200 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { user, error } = requireAuth(request, ["doctor", "admin"]);
  if (error) return error;

  const resolved = await params;
  const id = resolved.id;

  // Enforce doctor ownership or administrative access
  if (user.role === "doctor" && user.doctor_id && user.doctor_id !== id) {
    return NextResponse.json(
      { error: "Forbidden: You are not authorized to modify availability for this practitioner.", code: "UNAUTHORIZED_DOCTOR" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const action = body.action || "save_schedule";

    let result: any = null;

    if (action === "add_override") {
      result = callDbBridge("add_override", [], { doctor_id: id, ...body });
    } else if (action === "remove_override") {
      result = callDbBridge("remove_override", [id, body.override_id]);
    } else if (action === "add_leave") {
      result = callDbBridge("add_leave", [id], { doctor_id: id, ...body });
    } else if (action === "cancel_leave") {
      result = callDbBridge("cancel_leave", [id, body.leave_id]);
    } else if (action === "save_settings") {
      result = callDbBridge("save_schedule_settings", [id], { doctor_id: id, ...body });
    } else {
      // Default: save weekly schedule
      result = callDbBridge("save_schedule", [], { doctor_id: id, ...body });
    }

    if (!result || result.error) {
      return NextResponse.json(
        { error: result?.error || "Failed to update practitioner schedule in database." },
        { status: 400 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process availability update." }, { status: 500 });
  }
}
