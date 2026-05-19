# Start HALOmed Application

Write-Host "🚀 Starting HALOmed Pharmacy Management System..." -ForegroundColor Green
Write-Host ""

# Start Backend
Write-Host "Starting Backend Server on port 5003..." -ForegroundColor Cyan
$backend = Start-Process -FilePath "powershell" -ArgumentList `
    "-NoExit", "-Command", `
    "`$env:PORT='5003'; cd 'c:\Users\praky\OneDrive\Desktop\halomedupdated\backend'; npm start" `
    -PassThru

Start-Sleep -Seconds 2

# Start Frontend  
Write-Host "Starting Frontend Dev Server on port 5173..." -ForegroundColor Cyan
$frontend = Start-Process -FilePath "powershell" -ArgumentList `
    "-NoExit", "-Command", `
    "cd 'c:\Users\praky\OneDrive\Desktop\halomedupdated\frontend'; npm run dev" `
    -PassThru

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "✅ Servers started!" -ForegroundColor Green
Write-Host "📍 Frontend: http://127.0.0.1:5173" -ForegroundColor Yellow
Write-Host "📍 Backend: http://127.0.0.1:5003" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop..." -ForegroundColor Gray

# Wait for processes
$backend, $frontend | Wait-Process
