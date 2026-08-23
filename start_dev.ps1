# Incident Management Platform - Local Start Script
$Host.UI.RawUI.WindowTitle = "Incident System - Dev Launcher"

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   Incident Management & Ticketing Platform               " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

$pgBin = "$env:USERPROFILE\.pgsql\pgsql\bin"
$pgData = "$env:USERPROFILE\.pgsql\data"
$pgLog = "$env:USERPROFILE\.pgsql\server.log"
$nodeBin = "C:\Program Files\nodejs"

# Ensure PATH includes Node and PostgreSQL
$env:PATH = "$nodeBin;$pgBin;$env:PATH"

# 1. Start PostgreSQL if not already running
Write-Host "[1/3] Checking PostgreSQL Local Database..." -ForegroundColor Cyan
$pgRunning = Get-Process -Name *postgres* -ErrorAction SilentlyContinue

if (!$pgRunning) {
    Write-Host "Starting PostgreSQL Server..." -ForegroundColor Yellow
    if (Test-Path "$pgData\postmaster.pid") { Remove-Item "$pgData\postmaster.pid" -Force }
    Start-Process -FilePath "$pgBin\pg_ctl.exe" -ArgumentList "-D `"$pgData`"", "-l `"$pgLog`"", "-o `"-p 5432`"", "start" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Host "✅ PostgreSQL started successfully on port 5432." -ForegroundColor Green
} else {
    Write-Host "✅ PostgreSQL is already running on port 5432." -ForegroundColor Green
}

# 2. Start Backend Express API
Write-Host "[2/3] Starting Express Backend API (Port 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy Bypass", "-Command", "`$Host.UI.RawUI.WindowTitle = 'Backend API - Port 3000'; `$env:PATH = '$nodeBin;$pgBin;' + `$env:PATH; cd '$PSScriptRoot/backend'; Write-Host 'Starting Backend API on http://localhost:3000...' -ForegroundColor Green; npm.cmd run dev"

# 3. Start Frontend Vite App
Write-Host "[3/3] Starting React Vite Frontend (Port 5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy Bypass", "-Command", "`$Host.UI.RawUI.WindowTitle = 'Frontend App - Port 5173'; `$env:PATH = '$nodeBin;' + `$env:PATH; cd '$PSScriptRoot/frontend'; Write-Host 'Starting React Frontend on http://localhost:5173...' -ForegroundColor Green; npm.cmd run dev"

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "   🚀 All Services Launched Successfully!                 " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " - 🌐 Frontend UI:  http://localhost:5173" -ForegroundColor Yellow
Write-Host " - ⚙️  Backend API:  http://localhost:3000" -ForegroundColor Yellow
Write-Host " - 🗄️  PostgreSQL:   localhost:5432 (DB: incident_system)" -ForegroundColor Yellow
Write-Host "`n📋 Test Accounts (Login via OTP or test accounts):" -ForegroundColor Cyan
Write-Host "   • Admin:           al3ren0@gmail.com (OTP in dev auto-displayed)" -ForegroundColor White
Write-Host "   • HSE Controller:  controller@system.com / controller123" -ForegroundColor White
Write-Host "   • OC Reporter:     reporter@system.com / reporter123" -ForegroundColor White
Write-Host "   • Safety Manager:  safety_manager@system.com / safety123" -ForegroundColor White
Write-Host "   • HR Rep:          hr@system.com / hr123" -ForegroundColor White
Write-Host "   • Operations Rep:  dep_rep@system.com / deprep123" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
