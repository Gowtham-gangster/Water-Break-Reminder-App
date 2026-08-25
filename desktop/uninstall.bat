@echo off
setlocal
echo ===================================================
echo   Uninstalling EyeFlow
echo ===================================================

set "INSTALL_DIR=%LOCALAPPDATA%\Programs\EyeFlow"
set "START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"

echo [1/3] Removing application shortcuts...
if exist "%START_MENU%\EyeFlow.lnk" del /f /q "%START_MENU%\EyeFlow.lnk"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = [Environment]::GetFolderPath('Desktop') + '\EyeFlow.lnk'; if (Test-Path $p) { Remove-Item $p -Force }"

echo [2/3] Removing installed application binaries...
taskkill /F /IM EyeFlow.exe >nul 2>&1
timeout /t 1 /nobreak >nul

if exist "%INSTALL_DIR%" (
    rmdir /S /Q "%INSTALL_DIR%"
)

echo [3/3] Preserving user wellness statistics in AppData...

echo ===================================================
echo   EyeFlow uninstalled cleanly.
echo ===================================================
pause
