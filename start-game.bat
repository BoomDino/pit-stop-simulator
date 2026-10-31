@echo off
title RPA PIT STOP: PRECISION UNDER PRESSURE
cd /d "%~dp0"

echo ========================================================
echo   RPA PIT STOP: PRECISION UNDER PRESSURE
echo   Starting local server...
echo ========================================================

:: Check for agy-node or node
where agy-node >nul 2>nul
if %errorlevel% equ 0 (
    agy-node server.js
    goto end
)

where node >nul 2>nul
if %errorlevel% equ 0 (
    node server.js
    goto end
)

:: Fallback: Open index.html directly in default browser
echo Node.js not detected in PATH. Opening index.html directly...
start "" "%~dp0index.html"

:end
pause
