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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const messages = callDbBridge("get_messages", [roomId]) || [];
  return NextResponse.json(messages, { status: 200 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  try {
    const body = await request.json();
    const payload = {
      room_id: roomId,
      sender_id: body.sender_id || "user",
      sender_name: body.sender_name || "User",
      sender_role: body.sender_role || "patient",
      message: body.message
    };
    const res = callDbBridge("send_message", [], payload);
    return NextResponse.json(res || { success: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
