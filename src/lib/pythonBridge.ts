import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";

let cachedPythonPath: string | null = null;

export function getPythonBinary(): string {
  if (cachedPythonPath) return cachedPythonPath;

  const candidates = [
    "C:\\Users\\saipa\\AppData\\Local\\Programs\\Python\\Python312\\python.exe",
    "python",
    "py -3.12",
    "py -3",
    "python3"
  ];

  for (const candidate of candidates) {
    try {
      if (candidate.includes("\\") && fs.existsSync(candidate)) {
        cachedPythonPath = candidate;
        return candidate;
      }
      const parts = candidate.split(" ");
      const bin = parts[0];
      const args = parts.slice(1).concat(["-c", "import sqlalchemy, fastapi; print('OK')"]);
      const res = spawnSync(bin, args, { encoding: "utf-8", timeout: 2000, shell: process.platform === "win32" });
      if (res.status === 0 && res.stdout && res.stdout.includes("OK")) {
        cachedPythonPath = bin;
        return bin;
      }
    } catch (e) {}
  }

  cachedPythonPath = "python";
  return cachedPythonPath;
}

export function callDbBridge(action: string, args: string[] = [], stdinPayload?: any): any {
  try {
    const pythonBin = getPythonBinary();
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
    const result = spawnSync(pythonBin, cmdArgs, opts);
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
