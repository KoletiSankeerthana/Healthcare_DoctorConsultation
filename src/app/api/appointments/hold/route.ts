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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = callDbBridge("hold_slot", [], body);
    if (!res || !res.success) {
      return NextResponse.json(
        { error: res?.error || "This slot is currently held or unavailable. Please choose another slot." },
        { status: 409 }
      );
    }
    return NextResponse.json(res, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const holdId = searchParams.get("hold_id");
  if (!holdId) return NextResponse.json({ success: false }, { status: 400 });

  callDbBridge("release_hold", [holdId]);
  return NextResponse.json({ success: true }, { status: 200 });
}
