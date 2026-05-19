@echo off
echo ==========================================
echo   HALOmed Pharmacy Management System
echo ==========================================
echo.
echo Installing Backend Dependencies...
cd backend
call npm install
echo.
echo Installing Frontend Dependencies...
cd ../frontend
call npm install
echo.
echo Installing ML-Module Dependencies...
cd ../ml-module
call ..\.venv\Scripts\pip install -r requirements.txt
if errorlevel 1 (
  echo Virtual environment pip failed, trying global pip...
  call pip install -r requirements.txt
)
cd ..

echo.
echo Starting all servers in new windows...
echo.

start "HALOmed Backend (Port 5002)" cmd /k "cd backend && npm run dev"
start "HALOmed Frontend (Port 3000)" cmd /k "cd frontend && npm run dev"
start "HALOmed ML-Module (Port 5001)" cmd /k "cd ml-module && call ..\.venv\Scripts\python src\app.py || python src\app.py"

echo All servers have been started!
echo Please wait a few seconds for the frontend to become available at http://localhost:3000
echo.
pause
