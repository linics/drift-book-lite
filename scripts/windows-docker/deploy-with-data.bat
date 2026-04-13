@echo off
setlocal EnableExtensions EnableDelayedExpansion

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
cd /d "%ROOT%"

echo Drift Book Lite - first deploy with packaged data
echo Root: %CD%
echo.

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

call :configure_env
if errorlevel 1 exit /b 1

if not exist "2025学年学生信息.xls" (
  echo WARNING: 2025 student roster file was not found at project root.
  echo The backend can still start, but roster import will be skipped.
  echo.
)

set "RESTORE_DATA=Y"
if exist "package-data\backend-data\dev.db" (
  set /p "RESTORE_DATA=Restore packaged database and uploads now? Use Y for first deployment. [Y/n]: "
  if "!RESTORE_DATA!"=="" set "RESTORE_DATA=Y"
) else (
  set "RESTORE_DATA=N"
  echo No package-data\backend-data\dev.db found. Skipping packaged data restore.
)

if /i "!RESTORE_DATA!"=="Y" (
  echo.
  echo Building backend image for restore helper...
  docker compose build backend
  if errorlevel 1 goto :fail

  echo Restoring packaged data into Docker volumes...
  docker compose run --rm --no-deps --entrypoint sh -v "%ROOT%\package-data\backend-data:/restore-data:ro" -v "%ROOT%\drift-book-lite\uploads:/restore-uploads:ro" backend -lc "mkdir -p /data /app/uploads && if [ -f /restore-data/dev.db ]; then cp /restore-data/dev.db /data/dev.db; fi && if [ -d /restore-uploads ]; then cp -a /restore-uploads/. /app/uploads/; fi"
  if errorlevel 1 goto :fail
)

echo.
echo Starting all services...
docker compose up --build -d
if errorlevel 1 goto :fail

call "%~dp0status-services.bat"
echo.
echo Deployment complete.
pause
exit /b 0

:configure_env
set "WRITE_ENV=N"
if not exist ".env" set "WRITE_ENV=Y"
if exist ".env" (
  set /p "WRITE_ENV=.env already exists. Rewrite deployment URLs/admin settings? [y/N]: "
  if "!WRITE_ENV!"=="" set "WRITE_ENV=N"
)

if /i not "!WRITE_ENV!"=="Y" exit /b 0

set /p "LAN_HOST=Enter this computer LAN IP or host for other devices. Blank = localhost: "
if "!LAN_HOST!"=="" set "LAN_HOST=localhost"

set /p "ADMIN_PASSWORD=Enter admin password. Blank = change-this-password: "
if "!ADMIN_PASSWORD!"=="" set "ADMIN_PASSWORD=change-this-password"

set "JWT_SECRET=drift-!RANDOM!-!RANDOM!-!RANDOM!-!RANDOM!-!RANDOM!"

(
  echo BACKEND_PORT=8080
  echo FRONTEND_PORT=5174
  echo ADMIN_FRONTEND_PORT=5175
  echo.
  echo JWT_SECRET=!JWT_SECRET!
  echo ADMIN_USERNAMES=admin1,admin2,admin3
  echo ADMIN_PASSWORD=!ADMIN_PASSWORD!
  echo APP_BASE_URL=http://!LAN_HOST!:5174
  echo ADMIN_APP_BASE_URL=http://!LAN_HOST!:5175
  echo.
  echo FRONTEND_API_BASE_URL=http://!LAN_HOST!:8080/api
  echo ADMIN_FRONTEND_API_BASE_URL=http://!LAN_HOST!:8080/api
) > ".env"

echo Wrote .env for host !LAN_HOST!.
exit /b 0

:fail
echo.
echo ERROR: Deployment failed. Check the messages above.
pause
exit /b 1
