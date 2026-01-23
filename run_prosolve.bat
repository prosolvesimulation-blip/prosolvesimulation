@echo off
echo Starting ProSolve Professional...
echo.

cd /d "%~dp0backend"

REM Check if we need to install dependencies (only if venv didn't exist or specific flag)
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate.bat
    echo Installing dependencies...
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

REM Run the application
python app.py

pause
