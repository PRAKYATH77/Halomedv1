$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Write-Host "Starting HALOmed backend on http://127.0.0.1:5003 ..." -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/k", "cd /d `"$backend`" && npm start" `
  -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "Starting HALOmed frontend on http://127.0.0.1:5173 ..." -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/k", "cd /d `"$frontend`" && npm run dev -- --host 127.0.0.1 --port 5173" `
  -WindowStyle Normal

Write-Host ""
Write-Host "Wait until Vite prints Local: http://127.0.0.1:5173/, then refresh the browser." -ForegroundColor Green
