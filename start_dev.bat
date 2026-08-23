@echo off
title Incident Management Platform - Launcher
echo ==========================================================
echo    Incident Management ^& Ticketing Platform
echo ==========================================================
echo Starting services via PowerShell...
powershell.exe -ExecutionPolicy Bypass -File "%~dp0start_dev.ps1"
pause
