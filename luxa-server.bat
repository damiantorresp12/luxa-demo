@echo off
title LUXA local server
cd /d "%~dp0"
echo ============================================================
echo  LUXA / TD Lighting Experience - local server
echo ============================================================
echo.
echo   App principal  : http://localhost:8080/
echo   Space Planner  : http://localhost:8080/space-planner/
echo.
echo   Cerra esta ventana (o Ctrl+C) para detener el servidor.
echo ============================================================
echo.
start "" http://localhost:8080/
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0luxa-server.ps1"
echo.
echo Servidor detenido.
pause
