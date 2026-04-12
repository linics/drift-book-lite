@echo off
setlocal

set "ROOT=%~dp0"

start "Drift Book Lite Backend" cmd /k ""%ROOT%start-backend.bat""
start "Drift Book Lite Student Frontend" cmd /k ""%ROOT%start-frontend.bat""
start "Drift Book Lite Admin Frontend" cmd /k ""%ROOT%start-admin.bat""

echo Started backend, student frontend, and admin frontend in separate windows.
echo If a frontend window reports missing dist files, run build-frontends.bat first.

endlocal
