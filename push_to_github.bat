@echo off
setlocal
cd /d "%~dp0"

echo ====================================================
echo        PaluPhone - 1-Click Git Commit & Push
echo ====================================================
echo.

git status --short
echo.

set /p msg="Enter commit message (or press Enter for 'Update PaluPhone'): "
if "%msg%"=="" set msg=Update PaluPhone: %date% %time%

echo.
echo [1/3] Adding changes...
git add .

echo [2/3] Committing with message: "%msg%"...
git commit -m "%msg%"

echo [3/3] Pushing to GitHub (DanishDane/PaluwaganPhone)...
git push origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo ====================================================
    echo SUCCESS! Your changes are now live on GitHub!
    echo URL: https://github.com/DanishDane/PaluwaganPhone
    echo ====================================================
) else (
    echo [ERROR] Push failed. Check your network or credentials.
)

echo.
pause

