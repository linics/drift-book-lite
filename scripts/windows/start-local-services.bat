@echo off
setlocal EnableExtensions

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
cd /d "%ROOT%"

if not exist "drift-book-lite\backend\node_modules" (
  echo Backend dependencies are missing. Run deploy.bat first.
  pause
  exit /b 1
)

if not exist "drift-book-lite\frontend\dist" (
  echo Student frontend dist is missing. Run deploy.bat first.
  pause
  exit /b 1
)

if not exist "drift-book-lite\admin-frontend\dist" (
  echo Admin frontend dist is missing. Run deploy.bat first.
  pause
  exit /b 1
)

call "%~dp0start-all.bat"

echo.
echo Local services are starting in separate windows.
echo Student: http://localhost:5174
echo Admin:   http://localhost:5175
echo API:     http://localhost:8080/api/health
pause
