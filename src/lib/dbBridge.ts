import path from "path";
import { spawnSync } from "child_process";
import { getPythonBinary } from "./pythonBridge";

export function callDbBridge<T = any>(action: string, args: string[] = [], stdinPayload?: any): T | null {
  try {
    const pythonBin = getPythonBinary();
    const scriptPath = path.join(process.cwd(), "backend", "app", "services", "db_bridge.py");
    const cmdArgs = [scriptPath, action, ...args];
    const opts: any = {
      encoding: "utf-8",
      timeout: 15000,
      maxBuffer: 25 * 1024 * 1024,
    };
    if (stdinPayload !== undefined) {
      opts.input = typeof stdinPayload === "string" ? stdinPayload : JSON.stringify(stdinPayload);
    }
    const result = spawnSync(pythonBin, cmdArgs, opts);
    if (result.status === 0 && result.stdout) {
      return JSON.parse(result.stdout.trim()) as T;
    }
    if (result.stderr) {
      console.error(`db_bridge stderr (${action}):`, result.stderr);
    }
  } catch (err) {
    console.error(`db_bridge error (${action}):`, err);
  }
  return null;
}
