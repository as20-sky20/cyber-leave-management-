@echo off
title Haryana Cyber Police - Leave Portal Launcher
color 1F

echo ======================================================================
echo           HARYANA POLICE - STATE CYBER CRIME, PANCHKULA
echo         Online Leave Management & Sanction Portal Launcher
echo ======================================================================
echo.
echo Opening Haryana Cyber Police Leave Management Portal in your browser...
echo.

set "INDEX_PATH=%~dp0index.html"

:: Check if index.html exists
if not exist "%INDEX_PATH%" (
    echo [ERROR] index.html not found in current folder!
    pause
    exit /b
)

:: Launch in default browser
start "" "%INDEX_PATH%"

echo [SUCCESS] Portal launched successfully!
echo You can keep this window open or close it at any time.
echo.
timeout /t 3 >nul
exit
