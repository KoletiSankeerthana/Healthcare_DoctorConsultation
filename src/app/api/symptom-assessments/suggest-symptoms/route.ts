import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { requireAuth } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  try {
    const body = await request.json();
    const description = body.description || body.health_concern || "";

    if (!description.trim()) {
      return NextResponse.json(
        { error: "Description is required to suggest symptoms." },
        { status: 400 }
      );
    }

    const payload = {
      description: description.trim(),
      patient_context: body.patient_context || null
    };

    const res = callDbBridge("suggest_symptoms", [], payload);
    if (!res || res.error) {
      return NextResponse.json(
        { error: res?.error || "Failed to generate symptom suggestions." },
        { status: 500 }
      );
    }

    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error generating symptom suggestions." },
      { status: 500 }
    );
  }
}
