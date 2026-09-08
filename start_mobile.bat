@echo off
title HSE Incident Reporter - Mobile Dev Launcher
echo ==========================================================
echo    HSE Incident Reporter Mobile App (Expo Go)
echo ==========================================================
echo.
echo Scan the QR code below using:
echo   - Camera app on iPhone (iOS)
echo   - Expo Go app on Android
echo.
cd /d "%~dp0mobile"
call npx.cmd expo start --go
pause
