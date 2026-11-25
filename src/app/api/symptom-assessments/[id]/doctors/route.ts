import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { callDbBridge } from "@/lib/dbBridge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = requireAuth(request, ["patient", "admin"]);
    if (error) return error;

    const { id } = await params;
    const patientId = user.patient_id || user.id;
    const city = request.nextUrl.searchParams.get("city") || "";

    const result = callDbBridge<any[]>("assessment_doctors", [id, patientId, city]);

    return NextResponse.json(Array.isArray(result) ? result : []);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch recommended doctors." },
      { status: 500 }
    );
  }
}
