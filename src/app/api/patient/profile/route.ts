import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { requireAuth } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  try {
    const patientId = user.patient_id || user.id;
    const profile = callDbBridge("get_patient_profile", [patientId]);
    if (!profile || profile.error) {
      return NextResponse.json(
        { error: profile?.error || "Failed to load patient profile." },
        { status: 404 }
      );
    }
    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error fetching patient profile." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  try {
    const patientId = user.patient_id || user.id;
    const body = await request.json();

    const res = callDbBridge("save_patient_profile", [patientId], body);
    if (!res || res.error) {
      return NextResponse.json(
        { error: res?.error || "Failed to save patient profile." },
        { status: 400 }
      );
    }
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error saving patient profile." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return PUT(request);
}
