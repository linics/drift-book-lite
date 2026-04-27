@echo off
setlocal EnableExtensions

if /i "%~1"=="__run" goto :run
start "Drift Book Lite Deploy" "%ComSpec%" /d /k call "%~f0" __run
exit /b 0

:run
set "LOG=%~dp0deploy-debug.log"
(
  echo ============================================================
  echo Drift Book Lite deploy launcher
  echo Started: %DATE% %TIME%
  echo Script: %~f0
  echo Root: %~dp0
  echo ============================================================
) > "%LOG%"

echo Drift Book Lite - Unblock and Deploy
echo Root: %~dp0
echo Log: %LOG%
echo.

where powershell >nul 2>nul
if errorlevel 1 (
  echo WARNING: PowerShell was not found. Skipping file unblock step.
  >> "%LOG%" echo WARNING: PowerShell was not found. Skipping file unblock step.
) else (
  echo Removing download block from all files...
  >> "%LOG%" echo Running unblock step...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath '%~dp0' -Recurse -File | ForEach-Object { Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue }; Write-Host 'Done.'"
  if errorlevel 1 (
    echo WARNING: File unblock step failed. Continuing with deployment.
    >> "%LOG%" echo WARNING: File unblock step failed with exit code %ERRORLEVEL%.
  ) else (
    >> "%LOG%" echo Unblock step completed.
  )
)

echo.
if not exist "%~dp0deploy.bat" (
  echo ERROR: deploy.bat not found.
  echo Please extract the zip file completely before running this script.
  >> "%LOG%" echo ERROR: deploy.bat not found.
  echo.
  echo Press any key to close this window.
  pause >nul
  exit /b 1
)

>> "%LOG%" echo Calling deploy.bat...
call "%~dp0deploy.bat"
set "RESULT=%ERRORLEVEL%"
>> "%LOG%" echo deploy.bat returned exit code %RESULT%.
if not "%RESULT%"=="0" (
  echo.
  echo Deployment returned exit code %RESULT%.
  echo Check this log file:
  echo %LOG%
)

echo.
echo Launcher finished with exit code %RESULT%.
echo This window will stay open for troubleshooting.
