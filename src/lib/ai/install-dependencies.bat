@echo off
REM AI Integration Dependencies Installation Script for Windows
REM This script installs the required dependencies for the AI integration module

echo 🚀 Installing GUARDRAIL AI Integration Dependencies...
echo.

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Error: npm is not installed. Please install Node.js and npm first.
    pause
    exit /b 1
)

REM Install OpenAI SDK
echo 📦 Installing OpenAI SDK...
npm install openai

REM Install Anthropic SDK
echo 📦 Installing Anthropic SDK...
npm install @anthropic-ai/sdk

REM Install TypeScript types if not already installed
echo 📦 Installing TypeScript types...
npm install --save-dev @types/node

echo.
echo ✅ Installation complete!
echo.
echo 📝 Next steps:
echo 1. Set your environment variables:
echo    - OPENAI_API_KEY=your_openai_api_key
echo    - ANTHROPIC_API_KEY=your_anthropic_api_key
echo.
echo 2. Import the AI module in your code:
echo    import { aiHub } from './src/lib/ai';
echo.
echo 3. Start using AI features:
echo    const analysis = await aiHub.analyzeCode({
echo      code: 'your code here',
echo      language: 'typescript',
echo      analysisType: 'comprehensive'
echo    });
echo.
echo 🎉 Happy coding with AI!
pause
