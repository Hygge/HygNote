@echo off
cd /d "%~dp0"
echo Building Windows NSIS installer...
echo.
call npm run setup
if errorlevel 1 (
  echo.
  echo Packaging failed.
  pause
  exit /b 1
)
echo.
echo Packaging complete. Installer directory:
echo   src-tauri\target\release\bundle\nsis\
echo.
for %%f in ("src-tauri\target\release\bundle\nsis\*-setup.exe") do (
  echo   %%~ff
)
pause
