@echo off
REM Guardrail VS Code Extension Deployment Script for Windows
REM Usage: deploy.bat [publisher-id]

setlocal enabledelayedexpansion

set PUBLISHER=%1
if "%PUBLISHER%"=="" set PUBLISHER=guardrail

echo 🚀 Deploying Guardrail Extension
for /f "tokens=*" %%i in ('node -p "require('./package.json').version"') do set VERSION=%%i
echo Version: %VERSION%
echo Publisher: %PUBLISHER%

REM Check if vsce is installed
where vsce >nul 2>nul
if %errorlevel% neq 0 (
    echo 📦 Installing VSCE...
    npm install -g @vscode/vsce
)

REM Build extension
echo 🔨 Building extension...
call npm run build
if %errorlevel% neq 0 exit /b 1

REM Package extension
echo 📦 Packaging extension...
vsce package
if %errorlevel% neq 0 exit /b 1

REM Check if logged in
vsce ls-publishers | find "%PUBLISHER%" >nul
if %errorlevel% neq 0 (
    echo 🔐 Please login to VS Code Marketplace:
    echo vsce login %PUBLISHER%
    echo Then run this script again.
    pause
    exit /b 1
)

REM Publish extension
echo 🚀 Publishing to marketplace...
vsce publish
if %errorlevel% neq 0 exit /b 1

echo ✅ Extension published successfully!
echo 📊 View at: https://marketplace.visualstudio.com/items?itemName=%PUBLISHER%.guardrail
pause
