@echo off
setlocal EnableDelayedExpansion
echo ===================================================
echo   Installing EyeFlow - Digital Wellness for Windows
echo ===================================================

set "INSTALL_DIR=%LOCALAPPDATA%\Programs\EyeFlow"
set "SOURCE_DIR=%~dp0..\dist-desktop\EyeFlow-win32-x64"

if not exist "%SOURCE_DIR%\EyeFlow.exe" (
    echo [ERROR] EyeFlow binary not found at:
    echo "%SOURCE_DIR%\EyeFlow.exe"
    echo.
    echo Please run 'npm run package:win' first to build the Windows package.
    pause
    exit /b 1
)

if not exist "%SOURCE_DIR%\resources" (
    echo [ERROR] Packaged resources directory is missing from %SOURCE_DIR%.
    pause
    exit /b 1
)

echo [1/4] Stopping any existing EyeFlow instances...
taskkill /F /IM EyeFlow.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [2/4] Installing application files to %INSTALL_DIR%...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
xcopy /E /I /Y "%SOURCE_DIR%\*" "%INSTALL_DIR%\" >nul
if %errorlevel% neq 0 (
    echo [ERROR] Failed to copy application files to %INSTALL_DIR%.
    pause
    exit /b 1
)

echo [3/4] Creating Start Menu shortcut...
set "START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%START_MENU%\EyeFlow.lnk'); $s.TargetPath = '%INSTALL_DIR%\EyeFlow.exe'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Description = 'EyeFlow Digital Wellness'; $s.Save()"

echo [4/4] Creating Desktop shortcut...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\EyeFlow.lnk'); $s.TargetPath = '%INSTALL_DIR%\EyeFlow.exe'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Description = 'EyeFlow Digital Wellness'; $s.Save()"

echo ===================================================
echo   EyeFlow installed successfully!
echo   Location: %INSTALL_DIR%\EyeFlow.exe
echo   You can launch EyeFlow from your Desktop or Start Menu.
echo ===================================================
pause
