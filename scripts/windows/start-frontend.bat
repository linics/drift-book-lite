@echo off
setlocal

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI\"
cd /d "%ROOT%drift-book-lite\frontend"

if not exist "dist" (
  echo frontend\dist not found.
  echo Run build-frontends.bat first, then try again.
  pause
  exit /b 1
)

echo Starting student frontend from %CD%
npm.cmd run preview -- --host 0.0.0.0 --port 5174

endlocal
