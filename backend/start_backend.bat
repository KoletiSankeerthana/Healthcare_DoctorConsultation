@echo off
setlocal enabledelayedexpansion
title HEALVIA Healthcare - FastAPI Backend API (Port 8000)

:: Navigate to project root if executed from within backend/
if exist "..\backend\app\main.py" (
    cd ..
)

echo.
echo ===============================================================================
echo   HEALVIA Healthcare Platform - FastAPI Backend Server
echo ===============================================================================
echo.

:: 1. Detect working Python interpreter with fastapi & uvicorn installed
set "PYTHON_EXE="

if exist "C:\Users\saipa\AppData\Local\Programs\Python\Python312\python.exe" (
    "C:\Users\saipa\AppData\Local\Programs\Python\Python312\python.exe" -c "import fastapi, uvicorn" >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        set "PYTHON_EXE=C:\Users\saipa\AppData\Local\Programs\Python\Python312\python.exe"
    )
)

if not defined PYTHON_EXE (
    python -c "import fastapi, uvicorn" >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        set "PYTHON_EXE=python"
    )
)

if not defined PYTHON_EXE (
    py -3.12 -c "import fastapi, uvicorn" >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        set "PYTHON_EXE=py -3.12"
    )
)

if not defined PYTHON_EXE (
    py -3 -c "import fastapi, uvicorn" >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        set "PYTHON_EXE=py -3"
    )
)

if not defined PYTHON_EXE (
    echo [ERROR] No Python installation with FastAPI and Uvicorn was detected!
    echo Checked: Python 3.12, system python, py launcher.
    echo Please install dependencies: pip install fastapi uvicorn sqlalchemy pydantic
    echo.
    pause
    exit /b 1
)

echo [INFO] Python Interpreter: !PYTHON_EXE!

:: 2. Check for port 8000 conflicts and clean up if unresponsive
netstat -ano | findstr :8000 | findstr LISTENING >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo [INFO] Port 8000 is currently occupied. Checking if backend is already responding...
    powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 1 -UseBasicParsing; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
    if !ERRORLEVEL! equ 0 (
        echo [INFO] FastAPI backend is already running and healthy at http://127.0.0.1:8000/docs
        goto :SERVER_RUNNING
    ) else (
        echo [WARNING] Port 8000 is occupied by an unresponsive process. Terminating orphaned PID...
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
            echo   Freeing PID %%a...
            taskkill /F /PID %%a >nul 2>nul
        )
        timeout /t 1 /nobreak >nul
    )
)

:: 3. Set PYTHONPATH to root directory
set PYTHONPATH=%CD%

echo [INFO] Working Directory: %CD%
echo [INFO] Host:              127.0.0.1
echo [INFO] Port:              8000
echo [INFO] API Documentation: http://127.0.0.1:8000/docs
echo [INFO] Health Endpoint:   http://127.0.0.1:8000/health
echo [INFO] Database:          backend\healthcare_records.db
echo.
echo Starting Uvicorn live server (Press CTRL+C to stop)...
echo -------------------------------------------------------------------------------

:RESTART_LOOP
!PYTHON_EXE! -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] FastAPI backend server exited with error code %ERRORLEVEL%.
    echo Auto-restarting server in 3 seconds (Press CTRL+C to abort)...
    timeout /t 3
    goto :RESTART_LOOP
)

:SERVER_RUNNING
echo [SUCCESS] Backend is active on port 8000.
pause
