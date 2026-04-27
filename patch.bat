@echo off
setlocal EnableExtensions

set "LOG=%~dp0patch-debug.log"
(
  echo ============================================================
  echo Drift Book Lite patch
  echo Started: %DATE% %TIME%
  echo Root: %~dp0
  echo ============================================================
) > "%LOG%"

if not exist "%~dp0scripts\windows\apply-patch.bat" (
  echo ERROR: scripts\windows\apply-patch.bat not found.
  echo Please extract the zip file completely before running this script.
  echo Right-click the zip ^> "Extract All" ^> open the extracted folder ^> run patch.bat
  >> "%LOG%" echo ERROR: scripts\windows\apply-patch.bat not found.
  pause
  exit /b 1
)

>> "%LOG%" echo Calling scripts\windows\apply-patch.bat...
call "%~dp0scripts\windows\apply-patch.bat"
set "RESULT=%ERRORLEVEL%"
>> "%LOG%" echo apply-patch.bat returned exit code %RESULT%.

echo.
if "%RESULT%"=="0" (
  echo Patch entry script completed.
) else (
  echo Patch entry script failed with exit code %RESULT%.
  echo Check this log file:
  echo %LOG%
)
pause
exit /b %RESULT%
