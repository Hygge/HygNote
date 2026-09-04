@echo off
cd /d "%~dp0"
echo Building HygNote portable package...
echo.
call npm run portable
if errorlevel 1 (
  echo.
  echo Portable build failed.
  pause
  exit /b 1
)

set "PORTABLE_DIR=src-tauri\target\release\portable"
set "ZIP_FILE=src-tauri\target\release\bundle\HygNote_0.1.1_x64-portable.zip"

if exist "%PORTABLE_DIR%" rmdir /s /q "%PORTABLE_DIR%"
if exist "%ZIP_FILE%" del /f /q "%ZIP_FILE%"
mkdir "%PORTABLE_DIR%"
mkdir "%PORTABLE_DIR%\mcp"
copy /y "src-tauri\target\release\note.exe" "%PORTABLE_DIR%\HygNote.exe" >nul
copy /y "mcp\server.mjs" "%PORTABLE_DIR%\mcp\server.mjs" >nul
copy /y "mcp\db.mjs" "%PORTABLE_DIR%\mcp\db.mjs" >nul
copy /y "mcp\hygnote-mcp.cmd" "%PORTABLE_DIR%\mcp\hygnote-mcp.cmd" >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '%PORTABLE_DIR%\*' -DestinationPath '%ZIP_FILE%' -Force"
if errorlevel 1 (
  echo.
  echo Failed to create portable zip.
  pause
  exit /b 1
)

echo.
echo Portable package created:
echo   %ZIP_FILE%
pause
