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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  try {
    const body = await request.json();
    const res = callDbBridge("end_consultation", [], { room_id: roomId, ...body });
    return NextResponse.json(res || { success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
