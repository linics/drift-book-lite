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
  echo ERROR: Node.js was not found in PATH. Install Node.js 22 LTS first.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm.cmd was not found in PATH. Reinstall Node.js and include npm in PATH.
  pause
  exit /b 1
)

call :restore_packaged_data
if errorlevel 1 exit /b 1

set "ROSTER_REL=package-data\student-roster.xls"
if not exist "%ROSTER_REL%" if exist "2025学年学生信息.xls" set "ROSTER_REL=2025学年学生信息.xls"
if not exist "%ROSTER_REL%" (
  echo WARNING: 2025 student roster file was not found at project root.
  echo Expected package-data\student-roster.xls or 2025 student roster xls at project root.
  echo The backend can still start, but roster import will be skipped.
  echo.
  set "ROSTER_REL=2025学年学生信息.xls"
)

call :write_env
if errorlevel 1 exit /b 1

echo.
echo Installing dependencies in drift-book-lite\backend...
pushd "drift-book-lite\backend"
call npm.cmd ci
if errorlevel 1 goto :fail_popd
echo Generating Prisma client...
call npx.cmd prisma generate
if errorlevel 1 goto :fail_popd
echo Syncing SQLite schema...
call npx.cmd prisma db push
if errorlevel 1 goto :fail_popd
popd

echo.
echo Installing dependencies in drift-book-lite\frontend...
pushd "drift-book-lite\frontend"
call npm.cmd ci
if errorlevel 1 goto :fail_popd
echo Building student frontend...
call npm.cmd run build
if errorlevel 1 goto :fail_popd
popd

echo.
echo Installing dependencies in drift-book-lite\admin-frontend...
pushd "drift-book-lite\admin-frontend"
call npm.cmd ci
if errorlevel 1 goto :fail_popd
echo Building admin frontend...
call npm.cmd run build
if errorlevel 1 goto :fail_popd
popd

echo.
echo Local deployment complete.
echo Use start.bat for daily startup.
pause
exit /b 0

:restore_packaged_data
if not exist "package-data\backend-data\dev.db" (
  if not exist "drift-book-lite\backend\prisma\dev.db" (
    echo WARNING: drift-book-lite\backend\prisma\dev.db was not found.
    echo The backend may create an empty database unless you restore a backup first.
    echo.
  )
  exit /b 0
)

set "RESTORE_DB=N"
if not exist "drift-book-lite\backend\prisma\dev.db" set "RESTORE_DB=Y"
if exist "drift-book-lite\backend\prisma\dev.db" (
  set /p "RESTORE_DB=Restore packaged database now? Use N to keep current data. [y/N]: "
  if "!RESTORE_DB!"=="" set "RESTORE_DB=N"
)

if /i not "!RESTORE_DB!"=="Y" exit /b 0

if not exist "drift-book-lite\backend\prisma" mkdir "drift-book-lite\backend\prisma"
copy /Y "package-data\backend-data\dev.db" "drift-book-lite\backend\prisma\dev.db" >nul
if errorlevel 1 (
  echo ERROR: Failed to restore package-data\backend-data\dev.db.
  exit /b 1
)

echo Restored packaged database to drift-book-lite\backend\prisma\dev.db.
exit /b 0

:write_env
set "WRITE_ENV=Y"
if exist "drift-book-lite\backend\.env" (
  set /p "WRITE_ENV=Rewrite local .env files? [Y/n]: "
  if "!WRITE_ENV!"=="" set "WRITE_ENV=Y"
)
if /i not "!WRITE_ENV!"=="Y" exit /b 0

echo Detecting LAN IP (10.x.x.x, physical adapters only)...
set "IP_COUNT=0"
set "DETECTED_IP="
set "_TMP=%TEMP%\dbl-ips-%RANDOM%.txt"
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '10.*' -and $_.InterfaceAlias -notmatch 'vEthernet|VMware|VirtualBox|Loopback|WSL|Tunnel|isatap' } | Select-Object -ExpandProperty IPAddress" > "!_TMP!" 2>nul
if exist "!_TMP!" (
  for /f "tokens=* eol=" %%I in ("!_TMP!") do (
    set /a IP_COUNT+=1
    set "DETECTED_IP=%%I"
  )
  del "!_TMP!" >nul 2>nul
)

if "!IP_COUNT!"=="1" goto :_ip_one
if !IP_COUNT! GTR 1 goto :_ip_many

:_ip_none
echo Could not detect a 10.x.x.x address automatically.
set /p "LAN_HOST=Enter LAN IP for other devices. Blank = localhost: "
if "!LAN_HOST!"=="" set "LAN_HOST=localhost"
goto :_ip_done

:_ip_one
echo Detected LAN IP: !DETECTED_IP!
set /p "LAN_HOST=Press Enter to confirm, or type a different IP: "
if "!LAN_HOST!"=="" set "LAN_HOST=!DETECTED_IP!"
goto :_ip_done

:_ip_many
echo Multiple 10.x.x.x addresses found:
set "_TMP2=%TEMP%\dbl-ips-detail-%RANDOM%.txt"
powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '10.*' -and $_.InterfaceAlias -notmatch 'vEthernet|VMware|VirtualBox|Loopback|WSL|Tunnel|isatap' } | ForEach-Object { '  ' + $_.IPAddress + '  [' + $_.InterfaceAlias + ']' }" > "!_TMP2!" 2>nul
if exist "!_TMP2!" (
  type "!_TMP2!"
  del "!_TMP2!" >nul 2>nul
)
set /p "LAN_HOST=Enter the correct LAN IP for other devices: "
if "!LAN_HOST!"=="" set "LAN_HOST=localhost"

:_ip_done
set /p "ADMIN_PASSWORD=Enter admin password. Blank = change-this-password: "
if "!ADMIN_PASSWORD!"=="" set "ADMIN_PASSWORD=change-this-password"

set "JWT_SECRET=drift-local-!RANDOM!-!RANDOM!-!RANDOM!-!RANDOM!-!RANDOM!"

(
  echo DATABASE_URL="file:./dev.db"
  echo PORT=8080
  echo JWT_SECRET="!JWT_SECRET!"
  echo ADMIN_USERNAMES="admin1,admin2,admin3"
  echo ADMIN_PASSWORD="!ADMIN_PASSWORD!"
  echo APP_BASE_URL="http://!LAN_HOST!:5174"
  echo ADMIN_APP_BASE_URL="http://!LAN_HOST!:5175"
  echo DEFAULT_SITE_ASSETS_DIR="!ROOT_SLASH!/drift-book-lite/resources/default-site-assets"
  echo DEFAULT_SENSITIVE_WORDS_DIR="!ROOT_SLASH!/drift-book-lite/resources/default-sensitive-words"
  echo TEACHER_ROSTER_PATH="!ROOT_SLASH!/drift-book-lite/resources/default-teacher-roster/2025-teachers.txt"
  set "ROSTER_SLASH=!ROSTER_REL:\=/!"
  echo STUDENT_ROSTER_PATH="!ROOT_SLASH!/!ROSTER_SLASH!"
  echo UPLOADS_DIR="!ROOT_SLASH!/drift-book-lite/uploads"
) > "drift-book-lite\backend\.env"

(
  echo VITE_API_BASE_URL=http://!LAN_HOST!:8080/api
) > "drift-book-lite\frontend\.env"

(
  echo VITE_API_BASE_URL=http://!LAN_HOST!:8080/api
) > "drift-book-lite\admin-frontend\.env"

echo Wrote backend/frontend/admin .env files for host !LAN_HOST!.
exit /b 0

:fail_popd
popd
echo.
echo ERROR: Deployment failed. Check the messages above.
pause
exit /b 1
