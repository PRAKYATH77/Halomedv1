@echo off
setlocal

echo ==========================================
echo   HALOmed - Seed Test Users
echo ==========================================
echo.

cd /d "%~dp0backend"
if errorlevel 1 (
  echo Failed to locate backend directory.
  exit /b 1
)

call npm run seed:users
set EXIT_CODE=%ERRORLEVEL%

cd /d "%~dp0"
exit /b %EXIT_CODE%
