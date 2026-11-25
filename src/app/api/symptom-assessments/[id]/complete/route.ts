import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { callDbBridge } from "@/lib/dbBridge";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = requireAuth(request, ["patient", "admin"]);
    if (error) return error;

    const { id } = await params;
    const patientId = user.patient_id || user.id;

    const result = callDbBridge("complete_assessment", [id, patientId], {
      assessment_id: id,
      patient_id: patientId
    });

    if (!result || result.error) {
      return NextResponse.json(
        { error: result?.error || "Failed to complete symptom assessment." },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to complete assessment." },
      { status: 500 }
    );
  }
}
