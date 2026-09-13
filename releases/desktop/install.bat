@echo off
setlocal enabledelayedexpansion

echo ==============================================================================
echo   PauseFlow - Windows Application Installer
echo ==============================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%..\.."
set "SOURCE_DIR=%ROOT_DIR%\dist-electron\win-unpacked"
set "INSTALL_DIR=%LOCALAPPDATA%\Programs\PauseFlow"
set "TARGET_EXE=%INSTALL_DIR%\PauseFlow.exe"

if not exist "%SOURCE_DIR%\PauseFlow.exe" (
    set "SOURCE_DIR=%ROOT_DIR%\dist-desktop\win-unpacked"
)
if not exist "%SOURCE_DIR%\PauseFlow.exe" (
    set "SOURCE_DIR=%ROOT_DIR%\release\PauseFlow-2.0.0-rc1-Windows\package"
)

if not exist "%SOURCE_DIR%\PauseFlow.exe" (
    echo [ERROR] Packaged PauseFlow application build not found!
    echo Looked in:
    echo   - %ROOT_DIR%\dist-electron\win-unpacked
    echo.
    echo Please run 'npm run package:win' in the project root first.
    echo.
    pause
    exit /b 1
)

echo [1/4] Stopping any running PauseFlow instances...
taskkill /F /IM PauseFlow.exe >nul 2>&1
ping 127.0.0.1 -n 2 >nul

echo [2/4] Installing PauseFlow application bundle to: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
robocopy "%SOURCE_DIR%" "%INSTALL_DIR%" /E /R:1 /W:1 /NP /NFL /NDL /NJH /NJS >nul
if errorlevel 8 (
    echo [ERROR] Failed to copy application files to %INSTALL_DIR%.
    pause
    exit /b 1
)

echo [3/4] Creating application shortcuts...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $sm = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\PauseFlow.lnk'; $s = $ws.CreateShortcut($sm); $s.TargetPath = '%TARGET_EXE%'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Description = 'PauseFlow Digital Wellness'; $s.Save()"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $s = $ws.CreateShortcut((Join-Path $desktop 'PauseFlow.lnk')); $s.TargetPath = '%TARGET_EXE%'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Description = 'PauseFlow Digital Wellness'; $s.Save()"

echo [4/4] Launching PauseFlow...
start "" "%TARGET_EXE%"

echo.
echo ==============================================================================
echo   PauseFlow Installed and Launched Successfully!
echo   Installation Path: %TARGET_EXE%
echo   Desktop Shortcut: 'PauseFlow.lnk'
echo ==============================================================================
echo.
