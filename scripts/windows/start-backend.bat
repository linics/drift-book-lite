@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%drift-book-lite\backend"

echo Starting backend from %CD%
npm.cmd run start

endlocal
