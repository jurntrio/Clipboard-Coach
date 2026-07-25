@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "TARGET=%PROJECT_DIR%Launch Clipboard Coach Hidden.vbs"
set "ICON=%PROJECT_DIR%assets\branding\logo.ico"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$shortcutPath = [Environment]::GetFolderPath('Desktop') + '\Clipboard Coach.lnk'; $shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut($shortcutPath); $shortcut.TargetPath = '%TARGET%'; $shortcut.WorkingDirectory = '%PROJECT_DIR%'; $shortcut.IconLocation = '%ICON%'; $shortcut.Save()"

if errorlevel 1 (
  echo Could not create the desktop shortcut.
  pause
  exit /b 1
)

echo Created a desktop shortcut named Clipboard Coach.
pause
