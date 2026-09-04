@echo off
chcp 65001 >nul
echo ====================================
echo    HygNote - 桌面笔记本应用
echo ====================================
echo.
echo 正在启动开发服务器...
echo.
cd /d "%~dp0"
npm run tauri dev
