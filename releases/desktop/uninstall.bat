@echo off
setlocal

echo ==============================================================================
echo   PauseFlow - Windows Uninstaller
echo ==============================================================================
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\Programs\PauseFlow"
set "START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"

echo [1/3] Removing application shortcuts...
if exist "%START_MENU%\PauseFlow.lnk" del /f /q "%START_MENU%\PauseFlow.lnk"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$desktop = [Environment]::GetFolderPath('Desktop'); $p = Join-Path $desktop 'PauseFlow.lnk'; if (Test-Path $p) { Remove-Item $p -Force }"

echo [2/3] Stopping running instances and removing application files...
taskkill /F /IM PauseFlow.exe >nul 2>&1
ping 127.0.0.1 -n 2 >nul

if "%INSTALL_DIR%"=="%LOCALAPPDATA%\Programs\PauseFlow" (
    if exist "%INSTALL_DIR%" (
        rmdir /S /Q "%INSTALL_DIR%"
        echo       Removed: %INSTALL_DIR%
    ) else (
        echo       Directory %INSTALL_DIR% was not found.
    )
)

echo [3/3] PauseFlow uninstalled cleanly.
echo.
