@echo off
setlocal

echo ===================================================
echo   Installing EyeFlow - Digital Wellness for Windows
echo ===================================================

set "SCRIPT_DIR=%~dp0"
set "SOURCE_DIR=%SCRIPT_DIR%..\dist-electron\win-unpacked"
set "INSTALL_DIR=%LOCALAPPDATA%\Programs\EyeFlow"

if not exist "%SOURCE_DIR%\EyeFlow.exe" (
    set "SOURCE_DIR=%SCRIPT_DIR%..\dist-desktop\win-unpacked"
)

if not exist "%SOURCE_DIR%\EyeFlow.exe" (
    echo [ERROR] Packaged application not found at:
    echo   %SOURCE_DIR%
    echo.
    echo Please run 'npm run package:win' in the project root first.
    echo.
    pause
    exit /b 1
)

echo [1/4] Stopping any running EyeFlow instances...
taskkill /F /IM EyeFlow.exe >nul 2>&1
ping 127.0.0.1 -n 2 >nul

echo [2/4] Installing complete application bundle to %INSTALL_DIR%...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
robocopy "%SOURCE_DIR%" "%INSTALL_DIR%" /E /PURGE /R:1 /W:1 /NP /NFL /NDL /NJH /NJS >nul
if %ERRORLEVEL% GEQ 8 (
    echo [ERROR] Failed to copy application files to %INSTALL_DIR%.
    pause
    exit /b 1
)

echo [3/4] Creating Start Menu shortcut...
set "START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
set "TARGET_EXE=%INSTALL_DIR%\EyeFlow.exe"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut((Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\EyeFlow.lnk')); $s.TargetPath = (Join-Path $env:LOCALAPPDATA 'Programs\EyeFlow\EyeFlow.exe'); $s.WorkingDirectory = (Join-Path $env:LOCALAPPDATA 'Programs\EyeFlow'); $s.Description = 'EyeFlow Digital Wellness'; $s.Save()"

echo [4/4] Creating Desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $s = $ws.CreateShortcut((Join-Path $desktop 'EyeFlow.lnk')); $s.TargetPath = (Join-Path $env:LOCALAPPDATA 'Programs\EyeFlow\EyeFlow.exe'); $s.WorkingDirectory = (Join-Path $env:LOCALAPPDATA 'Programs\EyeFlow'); $s.Description = 'EyeFlow Digital Wellness'; $s.Save()"

echo ===================================================
echo   EyeFlow installed successfully!
echo   Location: %INSTALL_DIR%\EyeFlow.exe
echo   You can launch EyeFlow from your Desktop or Start Menu.
echo ===================================================
pause
