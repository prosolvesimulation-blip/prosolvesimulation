@echo off
setlocal
echo ================= Dev Start =================
echo Backend (prosolve) will be started in a new window if an entrypoint is found.
echo.
REM ---------------- Backend -----------------
cd /d "%~dp0backend"
if exist venv\Scripts\activate.bat (
  echo Activating virtual environment...
  call venv\Scripts\activate.bat
)
if exist requirements.txt (
  echo Installing backend dependencies...
  python -m pip install -r requirements.txt
)
if exist app.py (
  echo Starting Flask dev server (app.py)...
  start "Backend Flask" cmd /k "cd /d %~dp0backend && set FLASK_ENV=development && python app.py"
) else (
  echo No backend entrypoint found in backend folder.
)

echo.
REM --------------- Frontend ---------------
cd /d "%~dp0frontend"
if exist package.json (
  echo Installing frontend dependencies...
  npm install
  echo Starting frontend dev server...
  start "Frontend Dev" cmd /k "cd /d %~dp0frontend && npm run dev"
) else (
  echo No frontend package.json found in frontend.
)

echo Dev environment launched. Access frontend at http://localhost:5173
pause
