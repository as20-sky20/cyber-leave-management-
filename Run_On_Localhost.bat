@echo off
title Haryana Cyber Police - Localhost Web Server (8080)
color 1F

echo ======================================================================
echo           HARYANA POLICE - STATE CYBER CRIME, PANCHKULA
echo         Online Leave Management Portal - Localhost Server
echo ======================================================================
echo.
echo Starting Web Server on http://localhost:8080/ ...
echo.

powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start_server.ps1"

pause
