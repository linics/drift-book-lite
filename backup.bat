@echo off
if not exist "%~dp0scripts\windows\backup-local-data.bat" (
  echo ERROR: scripts\windows\backup-local-data.bat not found.
  echo Please extract the zip file completely before running this script.
  echo Right-click the zip ^> "Extract All" ^> open the extracted folder ^> run backup.bat
  pause
  exit /b 1
)
call "%~dp0scripts\windows\backup-local-data.bat"
