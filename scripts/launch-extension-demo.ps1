# Launch VS Code Extension Demo
# This script launches VS Code with the Guardrail extension in development mode

$extensionPath = Join-Path $PSScriptRoot "..\vscode-extension"
$workspacePath = Join-Path $PSScriptRoot ".."

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  GUARDRAIL VS CODE EXTENSION DEMO" -ForegroundColor Cyan  
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Launching VS Code with extension..." -ForegroundColor Yellow
Write-Host ""
Write-Host "DEMO STEPS:" -ForegroundColor Green
Write-Host "1. Press Win+G to open Xbox Game Bar for recording"
Write-Host "2. Copy this JSON to clipboard:" -ForegroundColor Yellow
Write-Host ""
Write-Host @'
{
  "format": "guardrail-v1",
  "diff": "diff --git a/src/hello.ts b/src/hello.ts\n--- a/src/hello.ts\n+++ b/src/hello.ts\n@@ -1 +1,2 @@\n export const greet = () => 'Hello';\n+export const farewell = () => 'Goodbye';",
  "commands": ["pnpm test"]
}
'@ -ForegroundColor White
Write-Host ""
Write-Host "3. Press Ctrl+Shift+Enter to verify" -ForegroundColor Yellow
Write-Host "4. See PASS notification" -ForegroundColor Green
Write-Host ""
Write-Host "Then try this FAILING example:" -ForegroundColor Red
Write-Host @'
{
  "format": "guardrail-v1",
  "diff": "diff --git a/config.ts b/config.ts\n--- a/config.ts\n+++ b/config.ts\n@@ -1 +1,2 @@\n export const config = {};\n+export const API_KEY = 'AKIAIOSFODNN7EXAMPLE';",
  "commands": []
}
'@ -ForegroundColor White
Write-Host ""
Write-Host "5. Press Ctrl+Shift+Enter - see FAIL (secret detected)" -ForegroundColor Red
Write-Host ""

# Launch VS Code
code --extensionDevelopmentPath="$extensionPath" "$workspacePath"
