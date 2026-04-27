@echo off
if "%~1"=="__run" goto :run
cmd /d /c call "%~f0" __run
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
  echo Patch applied successfully.
) else (
  echo Patch failed with exit code %RESULT%.
  echo Please copy the last error message above if you need help.
)
pause
exit /b %RESULT%

:run
setlocal EnableExtensions EnableDelayedExpansion

:: ============================================================
:: Patch metadata  (update this block for each new patch)
:: ============================================================
set "PATCH_ID=r015"
set "PATCH_DATE=2026-04-27"
set "PATCH_DESC=学生届别显示从"届"改为"级""
set "RESTART_BACKEND=1"
set "NEEDS_FRONTEND_BUILD=0"
set "NEEDS_PRISMA_PUSH=0"
:: ============================================================

for %%I in ("%~dp0..\..") do set "PATCH_ROOT=%%~fI"
set "FILES_DIR=%PATCH_ROOT%\files"

echo Drift Book Lite - apply patch %PATCH_ID%  (%PATCH_DATE%)
echo %PATCH_DESC%
echo.

if not exist "%FILES_DIR%" (
  echo ERROR: files\ directory not found.
  echo Expected: %FILES_DIR%
  goto :fail
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found in PATH.
  goto :fail
)

echo Enter the target system folder (the system you want to patch).
echo Example: D:\library-management-system
set /p "TARGET_INPUT=Target system folder: "
if "!TARGET_INPUT!"=="" (
  echo ERROR: Target system folder is required.
  goto :fail
)
set "TARGET_INPUT=!TARGET_INPUT:"=!"

set "TARGET_APP="
if exist "!TARGET_INPUT!\drift-book-lite\backend" set "TARGET_APP=!TARGET_INPUT!\drift-book-lite"
if not defined TARGET_APP if exist "!TARGET_INPUT!\backend" set "TARGET_APP=!TARGET_INPUT!"
if not defined TARGET_APP (
  echo ERROR: Could not find drift-book-lite backend in:
  echo !TARGET_INPUT!
  goto :fail
)

if /i "!TARGET_INPUT!"=="%PATCH_ROOT%" (
  echo ERROR: Target system folder and patch folder are the same.
  echo Extract the patch zip to a separate folder, then run patch.bat.
  goto :fail
)

echo.
echo Target: !TARGET_INPUT!
echo.

if %RESTART_BACKEND%==1 (
  netstat -ano 2>nul | findstr ":8080 " | findstr "LISTENING" >nul 2>&1
  if not errorlevel 1 (
    echo WARNING: Port 8080 is still in use. Close the backend window first.
    set /p "CONT=Continue anyway? [y/N]: "
    if /i not "!CONT!"=="Y" (
      echo Aborted. Close the backend window, then run patch.bat again.
      exit /b 1
    )
  )
)

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%I"
set "BACKUP_DIR=!TARGET_INPUT!\backups\pre-patch-%PATCH_ID%-%TS%"
echo Creating backup in:
echo %BACKUP_DIR%
echo.

:: ============================================================
:: File list  (add one call :patch_file line per changed file)
:: Use forward slashes; path is relative to the system root.
:: ============================================================
call :patch_file "drift-book-lite/backend/src/services/studentRoster.js"
if errorlevel 1 goto :fail
:: ============================================================

if %NEEDS_PRISMA_PUSH%==1 (
  echo.
  echo Running prisma db push...
  pushd "!TARGET_APP!\backend"
  call npx.cmd prisma db push
  if errorlevel 1 ( popd & goto :fail )
  popd
)

if %NEEDS_FRONTEND_BUILD%==1 (
  echo.
  echo Rebuilding student frontend...
  pushd "!TARGET_APP!\frontend"
  call npm.cmd run build
  if errorlevel 1 ( popd & goto :fail )
  popd
  echo Rebuilding admin frontend...
  pushd "!TARGET_APP!\admin-frontend"
  call npm.cmd run build
  if errorlevel 1 ( popd & goto :fail )
  popd
)

echo.
echo ============================================================
echo  Patch %PATCH_ID% applied.
if %RESTART_BACKEND%==1 echo  ACTION: restart the backend window to apply the change.
if %NEEDS_FRONTEND_BUILD%==0 if %RESTART_BACKEND%==0 echo  No restart required.
echo ============================================================
pause
exit /b 0

:patch_file
setlocal
set "REL=%~1"
set "SRC=%FILES_DIR%\%REL:/=\%"
set "DST=!TARGET_INPUT!\%REL:/=\%"
set "BCK=%BACKUP_DIR%\%REL:/=\%"

if not exist "%SRC%" (
  echo ERROR: Patch file not found in patch zip:
  echo %SRC%
  endlocal & exit /b 1
)

for %%D in ("%BCK%") do (
  if not exist "%%~dpD" mkdir "%%~dpD" >nul 2>nul
)
if exist "!DST!" (
  copy /Y "!DST!" "%BCK%" >nul
  if errorlevel 1 (
    echo ERROR: Failed to back up !DST!
    endlocal & exit /b 1
  )
)

for %%D in ("!DST!") do (
  if not exist "%%~dpD" mkdir "%%~dpD" >nul 2>nul
)
copy /Y "%SRC%" "!DST!" >nul
if errorlevel 1 (
  echo ERROR: Failed to copy to !DST!
  endlocal & exit /b 1
)
echo Patched: %REL%
endlocal & exit /b 0

:fail
echo.
echo ============================================================
echo  Patch failed. See error above.
echo  Backup (if created): %BACKUP_DIR%
echo ============================================================
pause
exit /b 1
