@echo off
title HSE Incident Reporter - Mobile Dev Launcher
echo ==========================================================
echo    HSE Incident Reporter Mobile App (Expo Dev Server)
echo ==========================================================
echo.
echo [1] Make sure your phone is connected to the same Wi-Fi or use Expo Go.
echo [2] Scan the QR code below using:
echo     - Camera app on iPhone (iOS)
echo     - Expo Go app on Android
echo.
cd /d "%~dp0mobile"
call npx expo start
pause
