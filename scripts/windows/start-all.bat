@echo off
setlocal

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI\"
set "TOOL_DIR=%ROOT%scripts\windows\"

start "Drift Book Lite Backend" cmd /k ""%TOOL_DIR%start-backend.bat""
start "Drift Book Lite Student Frontend" cmd /k ""%TOOL_DIR%start-frontend.bat""
start "Drift Book Lite Admin Frontend" cmd /k ""%TOOL_DIR%start-admin.bat""

echo Started backend, student frontend, and admin frontend in separate windows.
echo If a frontend window reports missing dist files, run build-frontends.bat first.

endlocal
