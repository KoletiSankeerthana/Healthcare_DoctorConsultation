@echo off
setlocal enabledelayedexpansion
title MediVerse Healthcare - Complete Full-Stack Launcher
cd /d "%~dp0"

echo.
echo ===============================================================================
echo   MediVerse Healthcare Platform - Starting Full-Stack Environment
echo ===============================================================================
echo.

:: 1. Launch FastAPI Backend on port 8000
echo [1/3] Checking FastAPI Backend (:8000)...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 1 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] Spawning FastAPI Backend on http://127.0.0.1:8000...
    start "MediVerse Backend (FastAPI :8000)" cmd /k call start_backend.bat
    echo Waiting for backend to initialize...
    timeout /t 3 /nobreak >nul
) else (
    echo [OK] FastAPI Backend is already running on http://127.0.0.1:8000
)

:: 2. Launch Next.js Frontend on port 3000
echo.
echo [2/3] Checking Next.js Frontend (:3000)...
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] Spawning Next.js Frontend on http://localhost:3000...
    start "MediVerse Frontend (Next.js :3000)" cmd /k call start_frontend.bat
    timeout /t 2 /nobreak >nul
) else (
    echo [OK] Frontend is already running on http://localhost:3000
)

:: 3. Open browser windows
echo.
echo [3/3] Opening application in default browser...
timeout /t 2 /nobreak >nul
start http://localhost:3000
start http://127.0.0.1:8000/docs

echo.
echo ===============================================================================
echo Full-stack environment is ready:
echo   - Web Application: http://localhost:3000
echo   - Swagger API Docs: http://127.0.0.1:8000/docs
echo   - Health Check:    http://127.0.0.1:8000/health
echo ===============================================================================
echo.
