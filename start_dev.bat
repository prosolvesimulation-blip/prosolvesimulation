@echo off
echo --- INICIANDO MODO DESENVOLVIMENTO PROSOLVE ---

:: 1. Inicia o Backend em uma nova janela
start "Backend Python (API)" cmd /k "python main.py"

:: 2. Inicia o Frontend em uma nova janela
start "Frontend React" cmd /k "npm run dev"

echo Tudo iniciado! Aceda ao link mostrado na janela do Frontend.