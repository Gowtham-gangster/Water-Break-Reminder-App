@echo off
setlocal
echo ===================================================
echo   Installing EyeFlow - Digital Wellness for Windows
echo ===================================================

set "INSTALL_DIR=%LOCALAPPDATA%\Programs\EyeFlow"
set "SOURCE_DIR=%~dp0..\dist-desktop\EyeFlow-win32-x64"

if not exist "%SOURCE_DIR%\EyeFlow.exe" (
    echo Error: EyeFlow binary not found at %SOURCE_DIR%
    pause
    exit /b 1
)

echo [1/4] Stopping any existing instances...
taskkill /F /IM EyeFlow.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [2/4] Copying application files to %INSTALL_DIR%...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
xcopy /E /I /Y "%SOURCE_DIR%\*" "%INSTALL_DIR%\" >nul

echo [3/4] Creating Start Menu shortcut...
set "START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%START_MENU%\EyeFlow.lnk'); $s.TargetPath = '%INSTALL_DIR%\EyeFlow.exe'; $s.Description = 'EyeFlow Digital Wellness'; $s.Save()"

echo [4/4] Creating Desktop shortcut...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\EyeFlow.lnk'); $s.TargetPath = '%INSTALL_DIR%\EyeFlow.exe'; $s.Description = 'EyeFlow Digital Wellness'; $s.Save()"

echo ===================================================
echo   EyeFlow installed successfully!
echo   You can launch EyeFlow from your Desktop or Start Menu.
echo ===================================================
pause
