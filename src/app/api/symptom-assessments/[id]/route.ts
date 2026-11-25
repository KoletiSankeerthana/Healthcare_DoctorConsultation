import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";
import { requireAuth } from "@/lib/server-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const patientId = user.patient_id || user.id;

    const result = callDbBridge("get_assessment", [id, patientId]);

    if (!result || result.error) {
      return NextResponse.json(
        { error: "Assessment not found or unauthorized access." },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to retrieve assessment." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = requireAuth(request);
  if (error) return error;

  try {
    const { id } = await params;
    const patientId = user.patient_id || user.id;

    const result = callDbBridge("delete_assessment", [id, patientId]);

    if (!result || result.error) {
      return NextResponse.json(
        { error: result?.error || "Failed to delete assessment." },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete assessment." },
      { status: 500 }
    );
  }
}
