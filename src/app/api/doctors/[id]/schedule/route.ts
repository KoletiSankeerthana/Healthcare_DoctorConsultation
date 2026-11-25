import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/pythonBridge";
import { requireAuth } from "@/lib/server-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = callDbBridge("doctor_schedule", [id]);
  if (!data) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }
  return NextResponse.json(data, { status: 200 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = requireAuth(request, ["doctor", "admin"]);
  if (error) return error;

  const { id } = await params;

  // Protect doctor schedule ownership
  if (user.role === "doctor" && user.doctor_id && user.doctor_id !== id) {
    return NextResponse.json(
      { error: "Forbidden: You are not authorized to update this doctor's schedule.", code: "UNAUTHORIZED_DOCTOR" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const data = callDbBridge("save_schedule", [], { doctor_id: id, ...body });
    if (!data || data.error) {
      return NextResponse.json({ error: data?.error || "Failed to update schedule in database" }, { status: 400 });
    }
    return NextResponse.json(data || { success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update schedule" }, { status: 500 });
  }
}
