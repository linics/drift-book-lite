@echo off
setlocal EnableExtensions

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
cd /d "%ROOT%"

where docker >nul 2>nul
if errorlevel 1 (
  echo ERROR: Docker was not found in PATH. Install Docker Desktop first.
  pause
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo ERROR: Docker is not running. Start Docker Desktop, then run this script again.
  pause
  exit /b 1
)

echo Starting Drift Book Lite services...
docker compose up -d
if errorlevel 1 (
  echo.
  echo Start failed. If this is the first run on this computer, run deploy-with-data.bat first.
  pause
  exit /b 1
)

call "%~dp0status-services.bat"
pause
