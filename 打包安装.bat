@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在打包 Windows 安装包 (NSIS setup.exe)...
echo.
call npm run setup
if errorlevel 1 (
  echo.
  echo 打包失败。
  pause
  exit /b 1
)
echo.
echo 完成。安装包在：
echo   src-tauri\target\release\bundle\nsis\
echo.
for %%f in ("src-tauri\target\release\bundle\nsis\*-setup.exe") do (
  echo   %%~ff
)
pause
