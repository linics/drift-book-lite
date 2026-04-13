@echo off
setlocal EnableExtensions

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
cd /d "%ROOT%"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%I"
set "BACKUP_DIR=%ROOT%\backups\local-%TS%"
mkdir "%BACKUP_DIR%\backend-prisma" >nul 2>nul

if exist "drift-book-lite\backend\prisma\dev.db" (
  copy /Y "drift-book-lite\backend\prisma\dev.db" "%BACKUP_DIR%\backend-prisma\dev.db" >nul
) else (
  echo WARNING: backend prisma dev.db was not found.
)

if exist "package-data\student-roster.xls" (
  copy /Y "package-data\student-roster.xls" "%BACKUP_DIR%\student-roster.xls" >nul
) else if exist "2025学年学生信息.xls" (
  copy /Y "2025学年学生信息.xls" "%BACKUP_DIR%\student-roster.xls" >nul
)

if exist "drift-book-lite\uploads" (
  robocopy "drift-book-lite\uploads" "%BACKUP_DIR%\uploads" /E >nul
  if errorlevel 8 (
    echo ERROR: Upload backup failed.
    pause
    exit /b 1
  )
)

echo Backup complete:
echo %BACKUP_DIR%
pause
