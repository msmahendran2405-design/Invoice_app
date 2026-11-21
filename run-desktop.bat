@echo off
title Mobile Care & Service Billing (Desktop App)
cd /d "%~dp0"

set ELECTRON_RUN_AS_NODE=

echo ===================================================
echo   Starting Mobile Service Billing Desktop App
echo ===================================================
echo.

if not exist node_modules (
    echo Installing dependencies...
    call npm.cmd install --no-audit --no-fund
)

call npm.cmd run electron:dev
pause
