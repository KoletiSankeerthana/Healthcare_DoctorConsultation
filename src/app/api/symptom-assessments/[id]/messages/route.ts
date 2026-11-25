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
    const body = await request.json();

    const message = body.message || "";
    if (!message.trim()) {
      return NextResponse.json(
        { error: "Message content cannot be empty." },
        { status: 400 }
      );
    }

    const payload = {
      assessment_id: id,
      patient_id: patientId,
      message: message.trim()
    };

    const result = callDbBridge("message_assessment", [], payload);

    if (!result || result.error) {
      return NextResponse.json(
        { error: result?.error || "Failed to process message." },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to send message." },
      { status: 500 }
    );
  }
}
