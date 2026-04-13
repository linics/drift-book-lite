@echo off
setlocal EnableExtensions EnableDelayedExpansion

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
cd /d "%ROOT%"

set "APP_URL=http://localhost:5174"
set "ADMIN_URL=http://localhost:5175"
set "API_URL=http://localhost:8080/api"

if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if "%%A"=="APP_BASE_URL" set "APP_URL=%%B"
    if "%%A"=="ADMIN_APP_BASE_URL" set "ADMIN_URL=%%B"
    if "%%A"=="FRONTEND_API_BASE_URL" set "API_URL=%%B"
  )
)

docker compose ps
echo.
echo Student: !APP_URL!
echo Admin:   !ADMIN_URL!
echo API:     !API_URL!
echo Health:  !API_URL!/health
