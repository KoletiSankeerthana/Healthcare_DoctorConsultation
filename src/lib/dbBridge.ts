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
      const rawOutput = result.stdout.trim();
      try {
        return JSON.parse(rawOutput) as T;
      } catch {
        // Fallback: extract JSON line if stdout was prepended with warnings or logs
        const lines = rawOutput.split("\n").map((l) => l.trim()).filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i];
          if ((line.startsWith("{") && line.endsWith("}")) || (line.startsWith("[") && line.endsWith("]"))) {
            try {
              return JSON.parse(line) as T;
            } catch {
              // continue scanning
            }
          }
        }
        throw new Error(`Failed to parse db_bridge output: ${rawOutput.slice(0, 200)}`);
      }
    }
    if (result.stderr) {
      console.error(`db_bridge stderr (${action}):`, result.stderr);
    }
  } catch (err) {
    console.error(`db_bridge error (${action}):`, err);
  }
  return null;
}
