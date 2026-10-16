@echo off
chcp 65001 >nul
cd /d "%~dp0"
where pwsh >nul 2>nul
if errorlevel 1 (
  echo 需要 PowerShell 7，请使用现有本机环境启动。
  pause
  exit /b 1
)
pwsh -NoProfile -File "%~dp0scripts\start-live.ps1"
pause
