@echo off
setlocal enabledelayedexpansion
title HEALVIA Healthcare - Next.js Frontend (Port 3000)
cd /d "%~dp0"

echo.
echo ===============================================================================
echo   HEALVIA Healthcare Platform - Service Launcher
echo ===============================================================================
echo.

:: Check if FastAPI backend on port 8000 is running
echo [1/2] Verifying FastAPI backend on port 8000...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 1 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] FastAPI backend is not running. Auto-starting backend in companion window...
    start "HEALVIA Backend (FastAPI :8000)" cmd /k call start_backend.bat
    echo Waiting 2 seconds for backend initialization...
    timeout /t 2 /nobreak >nul
) else (
    echo [OK] FastAPI backend is already active on http://127.0.0.1:8000 (Swagger: /docs)
)

echo.
echo [2/2] Starting Next.js 14 Frontend on http://localhost:3000...
echo.

npm run dev:frontend
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Frontend failed to start with code %ERRORLEVEL%.
    pause
)
