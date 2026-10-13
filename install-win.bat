@echo off
title LayerFilter Installer
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-win.ps1"
if %ERRORLEVEL% EQU 0 goto end

echo.
echo [!] PowerShell script failed. Running direct fallback installation...
echo.

for /L %%i in (6,1,16) do (
    reg add "HKEY_CURRENT_USER\Software\Adobe\CSXS.%%i" /v "PlayerDebugMode" /t REG_SZ /d "1" /f >nul 2>&1
)

set "TARGET_DIR=%APPDATA%\Adobe\CEP\extensions\LayerFilter"
if not exist "%APPDATA%\Adobe\CEP\extensions" mkdir "%APPDATA%\Adobe\CEP\extensions" >nul 2>&1
if exist "%TARGET_DIR%" rmdir /s /q "%TARGET_DIR%" >nul 2>&1
mkdir "%TARGET_DIR%" >nul 2>&1

xcopy "%~dp0CSXS" "%TARGET_DIR%\CSXS\" /E /I /Q /Y >nul
xcopy "%~dp0css" "%TARGET_DIR%\css\" /E /I /Q /Y >nul
xcopy "%~dp0icons" "%TARGET_DIR%\icons\" /E /I /Q /Y >nul
xcopy "%~dp0js" "%TARGET_DIR%\js\" /E /I /Q /Y >nul
xcopy "%~dp0jsx" "%TARGET_DIR%\jsx\" /E /I /Q /Y >nul
copy /y "%~dp0index.html" "%TARGET_DIR%\" >nul
copy /y "%~dp0LICENSE" "%TARGET_DIR%\" >nul

echo [SUCCESS] Installed to: %TARGET_DIR%
echo Please restart Photoshop.

:end
pause
