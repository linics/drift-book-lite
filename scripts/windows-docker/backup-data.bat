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

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%I"
set "BACKUP_DIR=%ROOT%\backups\%TS%"
mkdir "%BACKUP_DIR%" >nul 2>nul

echo Backing up Docker database and uploads to:
echo %BACKUP_DIR%

docker compose run --rm --no-deps --entrypoint sh -v "%BACKUP_DIR%:/backup" backend -lc "mkdir -p /backup/backend-data /backup/uploads && if [ -d /data ]; then cp -a /data/. /backup/backend-data/; fi && if [ -d /app/uploads ]; then cp -a /app/uploads/. /backup/uploads/; fi"
if errorlevel 1 (
  echo.
  echo Backup failed. Make sure deploy-with-data.bat has been run at least once.
  pause
  exit /b 1
)

echo Backup complete.
pause
