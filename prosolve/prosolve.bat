@echo off
:: Define o diretório de trabalho para onde o .bat está (pasta prosolve)
cd /d "%~dp0"

:: Título da janela para facilitar identificação
title ProSolve Suite

echo.
echo ========================================
echo   ProSolve Suite - Iniciando Servidor
echo ========================================
echo.
echo Iniciando API Backend (porta 5000)...
echo Iniciando HTTP Server (porta 8000)...
echo.
echo Abrindo dashboard em 2 segundos...
echo.

:: Inicia o Flask API Server em background
start "" ..\engines\python\python.exe main.pyw

:: Aguarda 2 segundos para o servidor API iniciar
timeout /t 2 >nul

:: Abre o navegador automaticamente no dashboard
start "" chrome --app=http://localhost:8000/dashboard.html


:: Inicia o HTTP Server na porta 8000 (em foreground para manter o .bat rodando)
echo.
echo HTTP Server rodando em http://localhost:8000
echo Para parar, feche estas janelas.
echo.

..\engines\python\python.exe -m http.server 8000

pause