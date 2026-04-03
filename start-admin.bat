@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%drift-book-lite\admin-frontend"

if not exist "dist" (
  echo admin-frontend\dist not found.
  echo Run build-frontends.bat first, then try again.
  pause
  exit /b 1
)

echo Starting admin frontend from %CD%
npx.cmd serve -s dist -l 5175

endlocal
