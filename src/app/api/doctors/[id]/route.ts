import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/pythonBridge";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000/api/v1";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Doctor ID is required" }, { status: 400 });
  }

  // 1. Try FastAPI backend over HTTP
  try {
    const fastApiUrl = `${BACKEND_URL}/doctors/${id}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);
    const res = await fetch(fastApiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data, { status: 200 });
    }
  } catch (e) {}

  // 2. Direct fallback to SQLite database via pythonBridge
  const doctor = callDbBridge("doctor_detail", [id]);

  if (!doctor || doctor.error || doctor.status === 404) {
    return NextResponse.json(
      { error: "Doctor profile not found or currently under administrative review" },
      { status: 404 }
    );
  }

  return NextResponse.json(doctor, { status: 200 });
}
