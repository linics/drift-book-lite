@echo off
setlocal

set "ROOT=%~dp0"

echo Building student frontend...
cd /d "%ROOT%drift-book-lite\frontend"
npm.cmd run build
if errorlevel 1 (
  echo Student frontend build failed.
  pause
  exit /b 1
)

echo Building admin frontend...
cd /d "%ROOT%drift-book-lite\admin-frontend"
npm.cmd run build
if errorlevel 1 (
  echo Admin frontend build failed.
  pause
  exit /b 1
)

echo Frontend builds completed successfully.
pause

endlocal
