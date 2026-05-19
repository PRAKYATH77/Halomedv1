Write-Host "Seeding HALOmed test users..." -ForegroundColor Cyan

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $root "backend"

if (!(Test-Path $backendPath)) {
    Write-Host "Backend directory not found." -ForegroundColor Red
    exit 1
}

Push-Location $backendPath
try {
    npm run seed:users
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}

Write-Host "Done." -ForegroundColor Green
