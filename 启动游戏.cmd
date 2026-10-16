@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 需要 Node.js 20.11 或更新版本，请先安装 Node.js。
  pause
  exit /b 1
)
echo 麦麦谁是卧底正在启动，请打开 http://127.0.0.1:4317
echo 关闭此窗口即可停止本机服务。
node server.mjs
pause
