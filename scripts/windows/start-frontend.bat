@echo off
setlocal EnableDelayedExpansion

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI\"
cd /d "%ROOT%drift-book-lite\frontend"

if not exist "dist" (
  echo frontend\dist not found.
  echo Run build-frontends.bat first, then try again.
  pause
  exit /b 1
)

netstat -ano 2>nul | findstr ":5174 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo WARNING: Port 5174 is already in use. Another student frontend instance may be running.
  set /p "CONT=Start anyway? [y/N]: "
  if /i not "!CONT!"=="Y" (
    echo Aborted.
    pause
    exit /b 1
  )
)

echo Starting student frontend from %CD%
npm.cmd run preview -- --host 0.0.0.0 --port 5174

endlocal
