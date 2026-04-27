@echo off
setlocal EnableExtensions

set "LOG=%~dp0upgrade-debug.log"
if not exist "%LOG%" (
  (
    echo ============================================================
    echo Drift Book Lite upgrade
    echo Started: %DATE% %TIME%
    echo New root: %~dp0
    echo ============================================================
  ) > "%LOG%"
)

if not exist "%~dp0scripts\windows\upgrade-existing-install.bat" (
  echo ERROR: scripts\windows\upgrade-existing-install.bat not found.
  echo Please extract the zip file completely before running this script.
  echo Right-click the zip ^> "Extract All" ^> open the extracted folder ^> run upgrade.bat
  >> "%LOG%" echo ERROR: scripts\windows\upgrade-existing-install.bat not found.
  pause
  exit /b 1
)

>> "%LOG%" echo Calling scripts\windows\upgrade-existing-install.bat...
call "%~dp0scripts\windows\upgrade-existing-install.bat"
set "RESULT=%ERRORLEVEL%"
>> "%LOG%" echo scripts\windows\upgrade-existing-install.bat returned exit code %RESULT%.

echo.
if "%RESULT%"=="0" (
  echo Upgrade entry script completed.
) else (
  echo Upgrade entry script failed with exit code %RESULT%.
  echo Check this log file:
  echo %LOG%
)
pause
exit /b %RESULT%
