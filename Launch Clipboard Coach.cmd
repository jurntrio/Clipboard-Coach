@echo off
setlocal

cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js from https://nodejs.org/ and then run this launcher again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing app dependencies. This only needs to happen once.
  call npm.cmd install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting Clipboard Coach...
call npm.cmd run dev
pause
