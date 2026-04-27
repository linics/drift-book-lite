@echo off
if "%~1"=="__run" goto :run
cmd /d /c call "%~f0" __run
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
  echo Upgrade script finished.
) else (
  echo Upgrade script failed with exit code %RESULT%.
  echo Please copy the last error message above if you need help.
)
pause
exit /b %RESULT%

:run
setlocal EnableExtensions EnableDelayedExpansion

for %%I in ("%~dp0..\..") do set "NEW_ROOT=%%~fI"
cd /d "%NEW_ROOT%"
set "NEW_ROOT_SLASH=%NEW_ROOT:\=/%"
set "NEW_APP=%NEW_ROOT%\drift-book-lite"
set "NEW_APP_SLASH=%NEW_ROOT_SLASH%/drift-book-lite"

echo Drift Book Lite - upgrade existing install
echo New version root: %CD%
echo.
echo IMPORTANT: close the old Backend, Student Frontend, and Admin Frontend windows before continuing.
echo.

call :check_port 8080 "backend"
if errorlevel 1 goto :fail
call :check_port 5174 "student frontend"
if errorlevel 1 goto :fail
call :check_port 5175 "admin frontend"
if errorlevel 1 goto :fail

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found in PATH.
  echo Install Node.js 22 LTS from https://nodejs.org/ and make sure it is added to PATH.
  goto :fail
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm.cmd was not found in PATH.
  echo Reinstall Node.js and include npm in PATH.
  goto :fail
)

echo Enter the OLD working system folder.
echo Example: D:\library-management-system
echo If you drag the old folder into this window, quotes are OK.
set /p "OLD_INPUT=Old system folder: "
if "!OLD_INPUT!"=="" (
  echo ERROR: Old system folder is required.
  goto :fail
)
set "OLD_INPUT=!OLD_INPUT:"=!"

set "OLD_APP="
if exist "!OLD_INPUT!\drift-book-lite\backend" set "OLD_APP=!OLD_INPUT!\drift-book-lite"
if not defined OLD_APP if exist "!OLD_INPUT!\backend" set "OLD_APP=!OLD_INPUT!"
if not defined OLD_APP (
  echo ERROR: Could not find drift-book-lite backend in:
  echo !OLD_INPUT!
  echo Enter either the project root or the drift-book-lite folder from the old system.
  goto :fail
)

if /i "!OLD_APP!"=="%NEW_APP%" (
  echo ERROR: Old system folder and new version folder are the same.
  echo Extract the new zip to a separate folder, then run upgrade.bat from the new folder.
  goto :fail
)

if not exist "!OLD_APP!\backend\prisma\dev.db" (
  echo ERROR: Old database was not found:
  echo !OLD_APP!\backend\prisma\dev.db
  echo Check that you selected the old working system folder.
  goto :fail
)

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "TS=%%I"
set "BACKUP_DIR=%NEW_ROOT%\backups\pre-upgrade-%TS%"
mkdir "%BACKUP_DIR%\backend-prisma" >nul 2>nul
mkdir "%BACKUP_DIR%\env" >nul 2>nul

echo.
echo Saving current new-folder data to:
echo %BACKUP_DIR%
if exist "%NEW_APP%\backend\prisma\dev.db" copy /Y "%NEW_APP%\backend\prisma\dev.db*" "%BACKUP_DIR%\backend-prisma\" >nul
if exist "%NEW_APP%\backend\.env" copy /Y "%NEW_APP%\backend\.env" "%BACKUP_DIR%\env\backend.env" >nul
if exist "%NEW_APP%\frontend\.env" copy /Y "%NEW_APP%\frontend\.env" "%BACKUP_DIR%\env\frontend.env" >nul
if exist "%NEW_APP%\admin-frontend\.env" copy /Y "%NEW_APP%\admin-frontend\.env" "%BACKUP_DIR%\env\admin-frontend.env" >nul
if exist "%NEW_APP%\uploads" (
  robocopy "%NEW_APP%\uploads" "%BACKUP_DIR%\uploads" /E >nul
  if errorlevel 8 (
    echo ERROR: Failed to back up current new-folder uploads.
    goto :fail
  )
)

echo.
echo Copying old SQLite database files ^(dev.db, dev.db-wal, dev.db-shm^)...
if not exist "%NEW_APP%\backend\prisma" mkdir "%NEW_APP%\backend\prisma"
del /Q "%NEW_APP%\backend\prisma\dev.db" "%NEW_APP%\backend\prisma\dev.db-wal" "%NEW_APP%\backend\prisma\dev.db-shm" >nul 2>nul
copy /Y "!OLD_APP!\backend\prisma\dev.db*" "%NEW_APP%\backend\prisma\" >nul
if errorlevel 1 (
  echo ERROR: Failed to copy old dev.db files.
  goto :fail
)

echo Copying old uploads directory...
if exist "!OLD_APP!\uploads" (
  if not exist "%NEW_APP%\uploads" mkdir "%NEW_APP%\uploads"
  robocopy "!OLD_APP!\uploads" "%NEW_APP%\uploads" /E >nul
  if errorlevel 8 (
    echo ERROR: Failed to copy old uploads.
    goto :fail
  )
) else (
  echo WARNING: Old uploads directory was not found. Continuing without uploads copy.
)

echo Copying old environment files...
if exist "!OLD_APP!\backend\.env" (
  copy /Y "!OLD_APP!\backend\.env" "%NEW_APP%\backend\.env" >nul
) else (
  echo ERROR: Old backend .env was not found:
  echo !OLD_APP!\backend\.env
  goto :fail
)
if exist "!OLD_APP!\frontend\.env" copy /Y "!OLD_APP!\frontend\.env" "%NEW_APP%\frontend\.env" >nul
if exist "!OLD_APP!\admin-frontend\.env" copy /Y "!OLD_APP!\admin-frontend\.env" "%NEW_APP%\admin-frontend\.env" >nul

echo Updating backend .env paths to the new folder...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$envPath = '%NEW_APP%\backend\.env';" ^
  "$newApp = '%NEW_APP_SLASH%';" ^
  "$lines = Get-Content -LiteralPath $envPath;" ^
  "function Set-Line($key, $value) { $script:lines = @($script:lines | Where-Object { $_ -notmatch ('^' + [regex]::Escape($key) + '=') }); $script:lines += ($key + '=' + [char]34 + $value + [char]34) }" ^
  "Set-Line 'DATABASE_URL' 'file:./dev.db';" ^
  "Set-Line 'UPLOADS_DIR' ($newApp + '/uploads');" ^
  "Set-Line 'DEFAULT_SITE_ASSETS_DIR' '';" ^
  "Set-Line 'DEFAULT_SENSITIVE_WORDS_DIR' '';" ^
  "Set-Line 'DEFAULT_BOOK_CATALOG_PATH' '';" ^
  "Set-Line 'DEFAULT_STUDENT_ROSTER_PATH' '';" ^
  "Set-Line 'STUDENT_ROSTER_PATH' '';" ^
  "Set-Line 'TEACHER_ROSTER_PATH' '';" ^
  "Set-Content -LiteralPath $envPath -Value $lines -Encoding UTF8"
if errorlevel 1 (
  echo ERROR: Failed to update backend .env paths.
  goto :fail
)

echo.
echo Installing dependencies in drift-book-lite\backend...
pushd "%NEW_APP%\backend"
call npm.cmd ci
if errorlevel 1 ( popd & goto :fail )
echo Generating Prisma client...
call npx.cmd prisma generate
if errorlevel 1 ( popd & goto :fail )
echo Syncing SQLite schema...
call npx.cmd prisma db push
if errorlevel 1 ( popd & goto :fail )
echo Checking migrated database counts...
node -e "require('dotenv').config(); const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); (async()=>{ console.log('books=', await p.book.count()); console.log('reviews=', await p.bookReview.count()); console.log('imports=', await p.importBatch.count()); await p.$disconnect(); })().catch(e=>{ console.error(e); process.exit(1); })"
if errorlevel 1 ( popd & goto :fail )
popd

echo.
echo Installing dependencies in drift-book-lite\frontend...
pushd "%NEW_APP%\frontend"
call npm.cmd ci
if errorlevel 1 ( popd & goto :fail )
echo Building student frontend...
call npm.cmd run build
if errorlevel 1 ( popd & goto :fail )
popd

echo.
echo Installing dependencies in drift-book-lite\admin-frontend...
pushd "%NEW_APP%\admin-frontend"
call npm.cmd ci
if errorlevel 1 ( popd & goto :fail )
echo Building admin frontend...
call npm.cmd run build
if errorlevel 1 ( popd & goto :fail )
popd

echo.
echo ============================================================
echo  Upgrade complete.
echo  Start the upgraded system with start.bat in the new folder.
echo  Confirm the database counts above include your existing reviews.
echo ============================================================
pause
exit /b 0

:check_port
netstat -ano 2>nul | findstr ":%~1 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo WARNING: Port %~1 is still in use ^(%~2 may still be running^).
  set /p "CONT=Continue anyway? [y/N]: "
  if /i not "!CONT!"=="Y" (
    echo Aborted. Close the running service windows, then run upgrade.bat again.
    exit /b 1
  )
)
exit /b 0

:fail
echo.
echo ============================================================
echo  Upgrade failed. See error above.
echo  No old-system files were modified.
echo ============================================================
pause
exit /b 1
