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
    if (result.stderr) {
      console.error(`db_bridge stderr (${action}):`, result.stderr);
    }
  } catch (err) {
    console.error(`db_bridge ${action} execution error:`, err);
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = callDbBridge("schedule_settings", [id]);
  if (!data) {
    return NextResponse.json({ error: "Settings not found" }, { status: 404 });
  }
  return NextResponse.json(data, { status: 200 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data = callDbBridge("save_schedule_settings", [], { doctor_id: id, ...body });
  return NextResponse.json(data || { success: true }, { status: 200 });
}
