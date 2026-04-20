@echo off
if not exist "%~dp0scripts\windows\start-local-services.bat" (
  echo ERROR: scripts\windows\start-local-services.bat not found.
  echo Please extract the zip file completely before running this script.
  echo Right-click the zip ^> "Extract All" ^> open the extracted folder ^> run start.bat
  pause
  exit /b 1
)
call "%~dp0scripts\windows\start-local-services.bat"
