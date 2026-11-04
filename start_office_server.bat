@echo off
title Haryana Cyber Police - Leave Portal Office Server
color 0B
echo ======================================================================
echo       HARYANA POLICE - STATE CYBER CRIME, PANCHKULA
echo       Online Leave Management System - Office LAN Server
echo ======================================================================
echo.
echo Starting local office web server with shared database...
echo.
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0start_server.ps1"
pause
