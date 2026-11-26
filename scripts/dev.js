const { spawn, spawnSync } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

console.log("\x1b[36m%s\x1b[0m", "===============================================================================");
console.log("\x1b[36m%s\x1b[0m", "  MediVerse Full-Stack Healthcare Platform Dev Server");
console.log("\x1b[36m%s\x1b[0m", "  - FastAPI Backend API:   http://127.0.0.1:8000 (Swagger: /docs)");
console.log("\x1b[36m%s\x1b[0m", "  - Next.js Web Frontend:  http://localhost:3000");
console.log("\x1b[36m%s\x1b[0m", "===============================================================================\n");

const isWin = process.platform === "win32";
const projectRoot = path.resolve(__dirname, "..");
const npxCmd = isWin ? "npx.cmd" : "npx";

// 1. Locate the exact Python installation containing FastAPI and Uvicorn
function findWorkingPython() {
  const candidates = [
    "C:\\Users\\saipa\\AppData\\Local\\Programs\\Python\\Python312\\python.exe",
    "python",
    "py -3.12",
    "py -3",
    "python3"
  ];

  for (const cmd of candidates) {
    try {
      if (cmd.includes("\\") && fs.existsSync(cmd)) {
        return cmd;
      }
      const parts = cmd.split(" ");
      const bin = parts[0];
      const args = parts.slice(1).concat(["-c", "import fastapi, uvicorn; print('OK')"]);
      const res = spawnSync(bin, args, { encoding: "utf-8", timeout: 3000, shell: isWin });
      if (res.status === 0 && res.stdout && res.stdout.includes("OK")) {
        return bin;
      }
    } catch (e) {
      // Continue to next candidate
    }
  }
  return isWin ? "python" : "python3";
}

// 2. Health probe helper for FastAPI
function checkFastApiHealth() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:8000/health", { timeout: 1200 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

// 3. Clear orphaned port processes if occupied
function cleanupPort(port) {
  if (!isWin) return;
  try {
    const out = spawnSync("cmd.exe", ["/c", `netstat -ano | findstr :${port} | findstr LISTENING`], {
      encoding: "utf-8",
      timeout: 3000
    });
    if (out.stdout && out.stdout.trim()) {
      const lines = out.stdout.trim().split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(parseInt(pid, 10)) && parseInt(pid, 10) > 0) {
          console.log(`\x1b[33m[Dev Runner] Freeing unresponsive port ${port} occupied by PID ${pid}...\x1b[0m`);
          spawnSync("taskkill", ["/F", "/PID", pid], { timeout: 3000 });
        }
      }
    }
  } catch (e) {}
}

let backendProcess = null;
let frontendProcess = null;
let isShuttingDown = false;
let restartDebounceTimer = null;

async function start() {
  const pythonBin = findWorkingPython();
  console.log(`\x1b[32m[Dev Runner] Using Python interpreter:\x1b[0m ${pythonBin}`);

  // Clear orphaned Next.js port 3000
  cleanupPort(3000);

  // Check if FastAPI is already running and healthy
  const alreadyHealthy = await checkFastApiHealth();
  if (alreadyHealthy) {
    console.log("\x1b[32m[FastAPI :8000] Backend is already running and healthy at http://127.0.0.1:8000 (Swagger: /docs)\x1b[0m");
  } else {
    cleanupPort(8000);
    // Allow Windows kernel socket release
    await new Promise((r) => setTimeout(r, 600));

    function spawnBackend() {
      if (isShuttingDown) return;
      console.log("\x1b[36m[FastAPI :8000] Spawning FastAPI backend server on http://127.0.0.1:8000 (Swagger: /docs)...\x1b[0m");
      
      // Note: On Windows Python 3.12, uvicorn --reload crashes with [WinError 2] named pipe error.
      // We run uvicorn directly and handle reload cleanly via Node file-watcher.
      backendProcess = spawn(
        pythonBin,
        ["-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        {
          cwd: projectRoot,
          env: { ...process.env, PYTHONPATH: projectRoot },
          shell: true,
          stdio: ["inherit", "pipe", "pipe"]
        }
      );

      backendProcess.stdout?.on("data", (data) => {
        process.stdout.write(`\x1b[32m[FastAPI :8000]\x1b[0m ${data}`);
      });

      backendProcess.stderr?.on("data", (data) => {
        process.stderr.write(`\x1b[33m[FastAPI :8000]\x1b[0m ${data}`);
      });

      backendProcess.on("exit", (code) => {
        if (!isShuttingDown) {
          console.log(`\x1b[33m[FastAPI :8000] Process exited with code ${code}. Restarting...\x1b[0m`);
          setTimeout(spawnBackend, 1000);
        }
      });
    }

    spawnBackend();

    // Node-level file watcher for Python backend hot reload (100% stable on Windows)
    try {
      const backendAppDir = path.join(projectRoot, "backend", "app");
      if (fs.existsSync(backendAppDir)) {
        fs.watch(backendAppDir, { recursive: true }, (eventType, filename) => {
          if (filename && filename.endsWith(".py") && !filename.includes("__pycache__")) {
            if (restartDebounceTimer) clearTimeout(restartDebounceTimer);
            restartDebounceTimer = setTimeout(() => {
              if (isShuttingDown || !backendProcess) return;
              console.log(`\x1b[36m[FastAPI :8000] Code change detected (${filename}). Restarting backend...\x1b[0m`);
              if (isWin && backendProcess.pid) {
                try {
                  spawnSync("taskkill", ["/F", "/T", "/PID", backendProcess.pid.toString()]);
                } catch (e) {}
              } else {
                backendProcess.kill("SIGTERM");
              }
            }, 600);
          }
        });
      }
    } catch (e) {
      // Non-fatal if fs.watch fails
    }
  }

  // Launch Next.js frontend on localhost:3000
  function spawnFrontend() {
    if (isShuttingDown) return;
    console.log("\x1b[34m[Next.js :3000] Starting Next.js Dev Server on http://localhost:3000...\x1b[0m");
    frontendProcess = spawn(npxCmd, ["next", "dev", "-p", "3000"], {
      cwd: projectRoot,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    frontendProcess.stdout?.on("data", (data) => {
      process.stdout.write(`\x1b[34m[Next.js :3000]\x1b[0m ${data}`);
    });

    frontendProcess.stderr?.on("data", (data) => {
      process.stderr.write(`\x1b[35m[Next.js :3000]\x1b[0m ${data}`);
    });

    frontendProcess.on("exit", (code) => {
      if (!isShuttingDown) {
        console.log(`\x1b[31m[Next.js :3000] Frontend exited with code ${code}. Restarting...\x1b[0m`);
        setTimeout(spawnFrontend, 1500);
      }
    });
  }

  spawnFrontend();
}

function cleanup() {
  isShuttingDown = true;
  console.log("\n[Dev Runner] Gracefully stopping dev processes...");
  if (isWin) {
    if (backendProcess && backendProcess.pid) {
      try {
        spawnSync("taskkill", ["/pid", backendProcess.pid.toString(), "/f", "/t"]);
      } catch (e) {}
    }
    if (frontendProcess && frontendProcess.pid) {
      try {
        spawnSync("taskkill", ["/pid", frontendProcess.pid.toString(), "/f", "/t"]);
      } catch (e) {}
    }
  } else {
    try {
      if (backendProcess) backendProcess.kill("SIGTERM");
      if (frontendProcess) frontendProcess.kill("SIGTERM");
    } catch (e) {}
  }
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

start();
