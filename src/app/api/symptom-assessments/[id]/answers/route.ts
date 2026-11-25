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

    const question = body.question || "";
    const answer = body.answer || "";

    if (!answer.trim()) {
      return NextResponse.json(
        { error: "Please enter your answer to continue." },
        { status: 400 }
      );
    }

    const payload = {
      assessment_id: id,
      patient_id: patientId,
      question: question.trim(),
      answer: answer.trim()
    };

    const result = callDbBridge("answer_question", [], payload);

    if (!result || result.error) {
      return NextResponse.json(
        { error: result?.error || "Failed to submit follow-up answer." },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to submit answer." },
      { status: 500 }
    );
  }
}
