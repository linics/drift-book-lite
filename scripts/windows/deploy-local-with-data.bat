@echo off
if "%~1"=="__run" goto :run
cmd /d /c call "%~f0" __run
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
  echo Deploy script finished.
) else (
  echo Deploy script failed with exit code %RESULT%.
  echo Please copy the last error message above if you need help.
)
pause
exit /b %RESULT%

:run
setlocal EnableExtensions EnableDelayedExpansion

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
cd /d "%ROOT%"
set "ROOT_SLASH=%ROOT:\=/%"

echo Drift Book Lite - Windows local deploy
echo Root: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found in PATH.
  echo Install Node.js 22 LTS from https://nodejs.org/ and make sure it is added to PATH.
  goto :fail
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm.cmd was not found in PATH.
  echo Reinstall Node.js and include npm in PATH.
  goto :fail
)

if not exist "drift-book-lite\backend\prisma\dev.db" (
  echo NOTE: No existing database found. A fresh one will be created.
  echo You can import books, students, sensitive words, and site assets after deployment.
  echo.
)

rem write .env files
set "WRITE_ENV=Y"
if exist "drift-book-lite\backend\.env" (
  set /p "WRITE_ENV=Rewrite local .env files? [Y/n]: "
  if "!WRITE_ENV!"=="" set "WRITE_ENV=Y"
)

if /i "!WRITE_ENV!"=="Y" (
  echo Detecting LAN IP ^(10.x.x.x, physical adapters only^)...
  set "IP_COUNT=0"
  set "DETECTED_IP="
  set "_TMP=%TEMP%\dbl-ips-%RANDOM%.txt"
  powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '10.*' -and $_.InterfaceAlias -notmatch 'vEthernet|VMware|VirtualBox|Loopback|WSL|Tunnel|isatap' } | Select-Object -ExpandProperty IPAddress" > "!_TMP!" 2>nul
  if exist "!_TMP!" (
    for /f "usebackq tokens=* eol=" %%I in ("!_TMP!") do (
      set /a IP_COUNT+=1
      set "DETECTED_IP=%%I"
    )
    del "!_TMP!" >nul 2>nul
  )

  if "!IP_COUNT!"=="1" (
    echo Detected LAN IP: !DETECTED_IP!
    set /p "LAN_HOST=Press Enter to confirm, or type a different IP: "
    if "!LAN_HOST!"=="" set "LAN_HOST=!DETECTED_IP!"
  ) else if !IP_COUNT! GTR 1 (
    echo Multiple 10.x.x.x addresses found:
    set "_TMP2=%TEMP%\dbl-ips-detail-%RANDOM%.txt"
    powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '10.*' -and $_.InterfaceAlias -notmatch 'vEthernet|VMware|VirtualBox|Loopback|WSL|Tunnel|isatap' } | ForEach-Object { '  ' + $_.IPAddress + '  [' + $_.InterfaceAlias + ']' }" > "!_TMP2!" 2>nul
    if exist "!_TMP2!" ( type "!_TMP2!" & del "!_TMP2!" >nul 2>nul )
    set /p "LAN_HOST=Enter the correct LAN IP for other devices: "
    if "!LAN_HOST!"=="" set "LAN_HOST=localhost"
  ) else (
    echo Could not detect a 10.x.x.x address automatically.
    set /p "LAN_HOST=Enter LAN IP for other devices. Blank = localhost: "
    if "!LAN_HOST!"=="" set "LAN_HOST=localhost"
  )

  set /p "ADMIN_PASSWORD=Enter admin password (required): "
  if "!ADMIN_PASSWORD!"=="" (
    echo ERROR: Admin password must not be empty.
    goto :fail
  )

  set "JWT_SECRET=drift-local-!RANDOM!-!RANDOM!-!RANDOM!-!RANDOM!-!RANDOM!"

  rem Resource paths are left empty so the backend
  rem resolves them automatically from its own directory (see src/lib/env.js).
  (
    echo DATABASE_URL="file:./dev.db"
    echo PORT=8080
    echo JWT_SECRET="!JWT_SECRET!"
    echo ADMIN_USERNAMES="admin1,admin2,admin3"
    echo ADMIN_PASSWORD="!ADMIN_PASSWORD!"
    echo APP_BASE_URL="http://!LAN_HOST!:5174"
    echo ADMIN_APP_BASE_URL="http://!LAN_HOST!:5175"
    echo DEFAULT_SITE_ASSETS_DIR=""
    echo DEFAULT_SENSITIVE_WORDS_DIR=""
    echo DEFAULT_BOOK_CATALOG_PATH=""
    echo DEFAULT_STUDENT_ROSTER_PATH=""
    echo STUDENT_ROSTER_PATH=""
    echo TEACHER_ROSTER_PATH=""
    echo UPLOADS_DIR="!ROOT_SLASH!/drift-book-lite/uploads"
  ) > "drift-book-lite\backend\.env"

  (
    echo VITE_API_BASE_URL=http://!LAN_HOST!:8080/api
  ) > "drift-book-lite\frontend\.env"

  (
    echo VITE_API_BASE_URL=http://!LAN_HOST!:8080/api
  ) > "drift-book-lite\admin-frontend\.env"

  echo Wrote .env files for host !LAN_HOST!.
  echo.
)

rem install and build
echo Installing dependencies in drift-book-lite\backend...
pushd "drift-book-lite\backend"
call npm.cmd ci
if errorlevel 1 ( popd & goto :fail )
echo Generating Prisma client...
call npx.cmd prisma generate
if errorlevel 1 ( popd & goto :fail )
echo Syncing SQLite schema...
call npx.cmd prisma db push
if errorlevel 1 ( popd & goto :fail )
popd

echo.
echo Installing dependencies in drift-book-lite\frontend...
pushd "drift-book-lite\frontend"
call npm.cmd ci
if errorlevel 1 ( popd & goto :fail )
echo Building student frontend...
call npm.cmd run build
if errorlevel 1 ( popd & goto :fail )
popd

echo.
echo Installing dependencies in drift-book-lite\admin-frontend...
pushd "drift-book-lite\admin-frontend"
call npm.cmd ci
if errorlevel 1 ( popd & goto :fail )
echo Building admin frontend...
call npm.cmd run build
if errorlevel 1 ( popd & goto :fail )
popd

echo.
echo ============================================================
echo  Deployment complete. Use start.bat for daily startup.
echo ============================================================
pause
exit /b 0

:fail
echo.
echo ============================================================
echo  Deployment failed. See error above.
echo ============================================================
pause
exit /b 1
