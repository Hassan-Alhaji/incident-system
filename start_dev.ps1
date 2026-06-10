Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   Incident Management & Ticketing Platform             " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Starting development servers..." -ForegroundColor Cyan

# Start Backend Express API in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting Express Backend API...' -ForegroundColor Green; cd '$PSScriptRoot/backend'; npm run dev"

# Start Frontend React Vite App in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting React Frontend...' -ForegroundColor Green; cd '$PSScriptRoot/frontend'; npm run dev"

Write-Host "Servers launched in separate windows:" -ForegroundColor Cyan
Write-Host " - Express Backend API: http://localhost:3000" -ForegroundColor Gray
Write-Host " - React/Vite Frontend: http://localhost:5173" -ForegroundColor Gray
Write-Host " - Test User Credentials (Seeded):" -ForegroundColor Green
Write-Host "   Admin:   admin@system.com / admin123" -ForegroundColor White
Write-Host "   Marshal: marshal@system.com / marshal123" -ForegroundColor White
Write-Host "   Medical: medical@system.com / medical123" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green
