@echo off
setlocal EnableDelayedExpansion

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI\"
cd /d "%ROOT%drift-book-lite\backend"

netstat -ano 2>nul | findstr ":8080 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo WARNING: Port 8080 is already in use. Another backend instance may be running.
  set /p "CONT=Start anyway? [y/N]: "
  if /i not "!CONT!"=="Y" (
    echo Aborted.
    pause
    exit /b 1
  )
)

echo Starting backend from %CD%
npm.cmd run start

endlocal
