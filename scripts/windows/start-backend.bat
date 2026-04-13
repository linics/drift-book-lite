@echo off
setlocal

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI\"
cd /d "%ROOT%drift-book-lite\backend"

echo Starting backend from %CD%
npm.cmd run start

endlocal
