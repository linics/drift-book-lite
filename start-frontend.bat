@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%drift-book-lite\frontend"

if not exist "dist" (
  echo frontend\dist not found.
  echo Run build-frontends.bat first, then try again.
  pause
  exit /b 1
)

echo Starting student frontend from %CD%
npx.cmd serve -s dist -l 5174

endlocal
