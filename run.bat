@echo off
title Professional Invoice Application
cd /d "%~dp0"

echo ===================================================
echo   Professional Desktop Invoice Application
echo   Powered by Google Sheets & Electron / Vite
echo ===================================================
echo.

if not exist node_modules (
    echo [1/2] Installing required dependencies...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install encountered an issue. Please check your internet connection.
        pause
        exit /b 1
    )
)

echo [2/2] Starting Invoice Application...
echo.
echo Application URL: http://localhost:5173
echo.
echo Default Logins:
echo   - Admin:   admin@invoice.com / mahendran@123
echo   - Client:  client1           / client123
echo.

start http://localhost:5173
call npm run dev
pause
