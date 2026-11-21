@echo off
title Mobile Care & Service Billing (Web Server)
cd /d "%~dp0"

echo ===================================================
echo   Starting Mobile Service Billing Web App
echo ===================================================
echo Opening in your browser: http://127.0.0.1:5173/
echo.

start http://127.0.0.1:5173/
call npm.cmd run dev
pause
