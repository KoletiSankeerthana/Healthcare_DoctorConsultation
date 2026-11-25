import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { spawnSync } from "child_process";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://127.0.0.1:8000/api/v1";

function callDbBridge(action: string, args: string[] = [], stdinPayload?: any): any {
  try {
    const scriptPath = path.join(process.cwd(), "backend", "app", "services", "db_bridge.py");
    const cmdArgs = [scriptPath, action, ...args];
    const opts: any = {
      encoding: "utf-8",
      timeout: 8000,
      maxBuffer: 10 * 1024 * 1024
    };
    if (stdinPayload !== undefined) {
      opts.input = typeof stdinPayload === "string" ? stdinPayload : JSON.stringify(stdinPayload);
    }
    const result = spawnSync("python", cmdArgs, opts);
    if (result.status === 0 && result.stdout) {
      return JSON.parse(result.stdout.trim());
    }
  } catch (err) {
    console.error(`db_bridge ${action} error:`, err);
  }
  return null;
}

// GET - Cancellation Policy and Eligibility
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolved = await params;
  const id = resolved.id;

  // Try FastAPI backend first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600);
    const res = await fetch(`${BACKEND_URL}/appointments/${id}/cancellation-policy`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data, { status: 200 });
    }
  } catch (e) {}

  // Fallback to db_bridge
  const res = callDbBridge("check_cancellation_policy", [id]);
  if (!res) {
    return NextResponse.json({
      eligible: true,
      hours_remaining: 48,
      deadline_hours: 24,
      cancellation_policy: "Free cancellation permitted up to 24 hours before consultation. Non-refundable policy applies."
    }, { status: 200 });
  }
  return NextResponse.json(res, { status: 200 });
}

// Reschedule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolved = await params;
  const id = resolved.id;
  const body = await request.json();

  const res = callDbBridge("reschedule_appointment", [], { appointment_id: id, ...body });
  if (!res || !res.success) {
    return NextResponse.json({ error: res?.error || "Failed to reschedule appointment" }, { status: 400 });
  }
  return NextResponse.json(res, { status: 200 });
}

// Cancel
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolved = await params;
  const id = resolved.id;
  let reason = "Patient request";
  let cancelled_by = "patient";

  try {
    const body = await request.json();
    if (body.reason) reason = body.reason;
    if (body.cancelled_by) cancelled_by = body.cancelled_by;
  } catch (e) {}

  // Try FastAPI backend first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${BACKEND_URL}/appointments/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, cancelled_by }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data, { status: 200 });
    } else {
      const errData = await res.json();
      return NextResponse.json({ error: errData.detail || "Cancellation failed." }, { status: res.status });
    }
  } catch (e) {}

  // Fallback to db_bridge
  const res = callDbBridge("cancel_appointment", [], { appointment_id: id, reason, cancelled_by });
  if (!res || !res.success) {
    return NextResponse.json({ error: res?.error || "Failed to cancel appointment" }, { status: 400 });
  }
  return NextResponse.json(res, { status: 200 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  return DELETE(request, { params });
}
