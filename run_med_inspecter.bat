@echo off
set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%"
set "MED_ENV_DIR=%ROOT_DIR%MEDCOUPLING-9.15.0\MEDCOUPLING-9.15.0"
set "INSPECTER_SCRIPT=%ROOT_DIR%backend\services\med\med_inspecter.py"

if not exist "%MED_ENV_DIR%\env_launch.bat" (
    echo ERROR: SALOME environment not found at %MED_ENV_DIR%
    pause
    exit /b 1
)

if "%~1"=="" (
    echo Usage: run_med_inspecter.bat ^<path_to_med_file^>
    pause
    exit /b 1
)

set "MED_FILE=%~f1"

echo Initializing SALOME/MED environment...
cd /d "%MED_ENV_DIR%"
call env_launch.bat

echo Running Inspeção: %MED_FILE%
python "%INSPECTER_SCRIPT%" "%MED_FILE%"

pause
