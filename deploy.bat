@echo off
setlocal EnableExtensions

set "LOG=%~dp0deploy-debug.log"
if not exist "%LOG%" (
  (
    echo ============================================================
    echo Drift Book Lite deploy
    echo Started: %DATE% %TIME%
    echo Root: %~dp0
    echo ============================================================
  ) > "%LOG%"
)

if not exist "%~dp0scripts\windows\deploy-local-with-data.bat" (
  echo ERROR: scripts\windows\deploy-local-with-data.bat not found.
  echo Please extract the zip file completely before running this script.
  echo Right-click the zip ^> "Extract All" ^> open the extracted folder ^> run deploy.bat
  >> "%LOG%" echo ERROR: scripts\windows\deploy-local-with-data.bat not found.
  pause
  exit /b 1
)

>> "%LOG%" echo Calling scripts\windows\deploy-local-with-data.bat...
call "%~dp0scripts\windows\deploy-local-with-data.bat"
set "RESULT=%ERRORLEVEL%"
>> "%LOG%" echo scripts\windows\deploy-local-with-data.bat returned exit code %RESULT%.

echo.
if "%RESULT%"=="0" (
  echo Deploy entry script completed.
) else (
  echo Deploy entry script failed with exit code %RESULT%.
  echo Check this log file:
  echo %LOG%
)
pause
exit /b %RESULT%
