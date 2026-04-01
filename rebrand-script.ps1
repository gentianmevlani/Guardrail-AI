# Guardrail Rebranding Script
# This script performs bulk find-and-replace operations for the rebrand

$ErrorActionPreference = "Continue"

# Get all files to process (excluding node_modules, .git, dist, build, .next)
$files = Get-ChildItem -Recurse -File | Where-Object {
    $_.FullName -notmatch 'node_modules|\.git|dist|build|\.next|pnpm-lock\.yaml|package-lock\.json' -and
    ($_.Extension -match '\.(ts|tsx|js|jsx|json|md|yml|yaml|toml|txt|svg|html)$')
}

Write-Host "Found $($files.Count) files to process" -ForegroundColor Cyan

# Replacement patterns
$replacements = @(
    # Domain replacements
    @{ Old = 'getguardrail\.io'; New = 'guardrailai.dev'; CaseSensitive = $false },
    @{ Old = 'guardrail\.ai'; New = 'guardrailai.dev'; CaseSensitive = $false },
    @{ Old = 'guardrail\.dev'; New = 'guardrailai.dev'; CaseSensitive = $false },
    
    # Email replacements
    @{ Old = 'team@getguardrail\.io'; New = 'support@guardrailai.dev'; CaseSensitive = $false },
    @{ Old = 'team@guardrail'; New = 'support@guardrailai.dev'; CaseSensitive = $false },
    
    # Package name replacements (be careful with case)
    @{ Old = '@guardrail/'; New = '@guardrail/'; CaseSensitive = $true },
    @{ Old = 'guardrail-core'; New = 'guardrail-core'; CaseSensitive = $false },
    @{ Old = 'guardrail-cli'; New = 'guardrail-cli-tool'; CaseSensitive = $false },
    @{ Old = 'guardrail-security'; New = 'guardrail-security'; CaseSensitive = $false },
    @{ Old = 'guardrail-ship'; New = 'guardrail-ship'; CaseSensitive = $false },
    
    # CLI command replacements
    @{ Old = '\bguardrail\b'; New = 'guardrail'; CaseSensitive = $false },
    @{ Old = '\bgr\b'; New = 'vc'; CaseSensitive = $true }, # Only replace standalone 'gr', not in words
    
    # Environment variable replacements
    @{ Old = 'GUARDRAIL_'; New = 'GUARDRAIL_'; CaseSensitive = $true },
    @{ Old = 'guardrail\.config\.json'; New = 'guardrail.config.json'; CaseSensitive = $false },
    @{ Old = '\.guardrailrc'; New = '.guardrailrc'; CaseSensitive = $false },
    
    # Brand name replacements (preserve case where appropriate)
    @{ Old = '\bGuardrail\b'; New = 'Guardrail'; CaseSensitive = $true },
    @{ Old = '\bGUARDRAIL\b'; New = 'GUARDRAIL'; CaseSensitive = $true },
    
    # File path references
    @{ Old = 'bin/guardrail\.js'; New = 'bin/guardrail.js'; CaseSensitive = $false },
    @{ Old = 'guardrail-logo'; New = 'guardrail-logo'; CaseSensitive = $false },
    @{ Old = 'guardrail-shield'; New = 'guardrail-shield'; CaseSensitive = $false }
)

$processed = 0
$modified = 0

foreach ($file in $files) {
    try {
        $content = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
        if ($null -eq $content) { continue }
        
        $originalContent = $content
        $fileModified = $false
        
        foreach ($replacement in $replacements) {
            if ($replacement.CaseSensitive) {
                if ($content -match $replacement.Old) {
                    $content = $content -creplace $replacement.Old, $replacement.New
                    $fileModified = $true
                }
            } else {
                if ($content -imatch $replacement.Old) {
                    $content = $content -ireplace $replacement.Old, $replacement.New
                    $fileModified = $true
                }
            }
        }
        
        if ($fileModified -and $content -ne $originalContent) {
            Set-Content -Path $file.FullName -Value $content -NoNewline
            $modified++
            Write-Host "Modified: $($file.FullName)" -ForegroundColor Green
        }
        
        $processed++
        if ($processed % 100 -eq 0) {
            Write-Host "Processed $processed files..." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Error processing $($file.FullName): $_" -ForegroundColor Red
    }
}

Write-Host "`nCompleted! Processed $processed files, modified $modified files" -ForegroundColor Cyan
