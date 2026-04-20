@echo off
setlocal EnableDelayedExpansion

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI\"
cd /d "%ROOT%drift-book-lite\admin-frontend"

if not exist "dist" (
  echo admin-frontend\dist not found.
  echo Run build-frontends.bat first, then try again.
  pause
  exit /b 1
)

netstat -ano 2>nul | findstr ":5175 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo WARNING: Port 5175 is already in use. Another admin frontend instance may be running.
  set /p "CONT=Start anyway? [y/N]: "
  if /i not "!CONT!"=="Y" (
    echo Aborted.
    pause
    exit /b 1
  )
)

echo Starting admin frontend from %CD%
npm.cmd run preview -- --host 0.0.0.0 --port 5175

endlocal
