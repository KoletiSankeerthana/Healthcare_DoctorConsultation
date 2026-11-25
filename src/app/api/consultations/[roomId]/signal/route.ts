import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { spawnSync } from "child_process";

function callDbBridge(action: string, args: string[] = [], stdinPayload?: any): any {
  try {
    const scriptPath = path.join(process.cwd(), "backend", "app", "services", "db_bridge.py");
    const cmdArgs = [scriptPath, action, ...args];
    const opts: any = {
      encoding: "utf-8",
      timeout: 10000,
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

// Post a signal (offer, answer, candidate)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  try {
    const body = await request.json();
    const payload = {
      room_id: roomId,
      sender_role: body.sender_role,
      target_role: body.target_role || (body.sender_role === "doctor" ? "patient" : "doctor"),
      signal_type: body.signal_type, // "offer", "answer", "ice-candidate", "status", "leave"
      signal_data: body.signal_data
    };

    const res = callDbBridge("send_signal", [], payload);
    return NextResponse.json(res || { success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Poll pending signals
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const { searchParams } = new URL(request.url);
  const targetRole = searchParams.get("role") || "patient";

  const signals = callDbBridge("get_signals", [roomId, targetRole]) || [];
  return NextResponse.json(signals, { status: 200 });
}
