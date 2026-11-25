import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { requireAuth } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  try {
    const patientId = user.patient_id || user.id;
    const body = await request.json();

    const description = body.description || body.symptom_description || "";
    if (!description.trim()) {
      return NextResponse.json(
        { error: "Please provide a description of your health concern." },
        { status: 400 }
      );
    }

    const payload = {
      patient_id: patientId,
      description: description.trim(),
      selected_symptoms: body.selected_symptoms || [],
      duration: body.duration || body.symptom_duration || "Recently noticed",
      severity: body.severity || "Moderate",
      progression: body.progression || "unchanged",
      started_at: body.started_at,
      patient_context: body.patient_context,
      include_medical_documents: Boolean(body.include_medical_documents)
    };

    const result = callDbBridge("create_assessment", [], payload);

    if (!result || result.error) {
      return NextResponse.json(
        { error: result?.error || "Failed to process symptom assessment." },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create assessment." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  try {
    const patientId = user.patient_id || user.id;
    const result = callDbBridge<any[]>("list_assessments", [patientId]);

    return NextResponse.json(Array.isArray(result) ? result : []);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch assessments." },
      { status: 500 }
    );
  }
}
