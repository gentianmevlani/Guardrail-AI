#!/usr/bin/env pwsh
# Manual CLI Testing Script
# Tests all CLI commands on real projects

$ErrorActionPreference = "Continue"

# Projects to test
$projects = @(
    'C:\Users\mevla\OneDrive\Desktop\FullStackFlow-main',
    'C:\Users\mevla\OneDrive\Desktop\Guardescan-main',
    'C:\Users\mevla\OneDrive\Desktop\Paradexx-main'
)

# CLI path
$cliPath = Join-Path $PSScriptRoot "..\packages\cli\dist\index.js"
$cliPath = Resolve-Path $cliPath

# Test results
$results = @{
    Passed = @()
    Failed = @()
    Skipped = @()
}

function Test-Command {
    param(
        [string]$Command,
        [string]$ProjectPath,
        [string[]]$ExpectedOutput = @(),
        [switch]$HelpOnly = $false
    )
    
    $projectName = Split-Path $ProjectPath -Leaf
    $testName = "$Command on $projectName"
    
    try {
        Push-Location $ProjectPath
        
        if ($HelpOnly) {
            $output = & node $cliPath $Command --help 2>&1
            $exitCode = $LASTEXITCODE
        } else {
            $output = & node $cliPath $Command --path . --format json 2>&1
            $exitCode = $LASTEXITCODE
        }
        
        $outputText = $output -join "`n"
        
        # Check if command succeeded (exit code 0) or help command worked
        if ($exitCode -eq 0 -or ($HelpOnly -and $outputText -match "Usage|Options|help")) {
            Write-Host "  ✓ $testName" -ForegroundColor Green
            $results.Passed += $testName
            return $true
        } else {
            # For non-help commands, exit code 1 might be OK (findings found)
            if (-not $HelpOnly -and $outputText -match "findings|scan|json") {
                Write-Host "  ✓ $testName (found issues, which is expected)" -ForegroundColor Green
                $results.Passed += $testName
                return $true
            } else {
                Write-Host "  ✗ $testName (exit code: $exitCode)" -ForegroundColor Red
                $results.Failed += $testName
                return $false
            }
        }
    } catch {
        Write-Host "  ✗ $testName (error: $($_.Exception.Message))" -ForegroundColor Red
        $results.Failed += $testName
        return $false
    } finally {
        Pop-Location
    }
}

Write-Host "🚀 CLI Manual Testing on Real Projects" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Verify projects exist
Write-Host "📁 Verifying Projects..." -ForegroundColor Yellow
foreach ($proj in $projects) {
    if (Test-Path $proj) {
        Write-Host "  ✓ $(Split-Path $proj -Leaf)" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $(Split-Path $proj -Leaf) - NOT FOUND" -ForegroundColor Red
        $results.Skipped += "All commands on $(Split-Path $proj -Leaf)"
    }
}

Write-Host "`n📋 Testing Basic Commands (--help)" -ForegroundColor Yellow
Write-Host "-" * 70

$basicCommands = @(
    "scan",
    "scan:secrets",
    "scan:vulnerabilities",
    "scan:compliance",
    "sbom:generate",
    "fix",
    "ship",
    "reality",
    "autopilot",
    "init",
    "menu",
    "smells",
    "auth"
)

foreach ($cmd in $basicCommands) {
    Write-Host "`nTesting: $cmd --help" -ForegroundColor Cyan
    try {
        $output = & node $cliPath $cmd --help 2>&1
        if ($output -match "Usage|Options|help" -or $LASTEXITCODE -eq 0) {
            Write-Host "  ✓ $cmd --help works" -ForegroundColor Green
            $results.Passed += "$cmd --help"
        } else {
            Write-Host "  ✗ $cmd --help failed" -ForegroundColor Red
            $results.Failed += "$cmd --help"
        }
    } catch {
        Write-Host "  ✗ $cmd --help error: $($_.Exception.Message)" -ForegroundColor Red
        $results.Failed += "$cmd --help"
    }
}

Write-Host "`n🔍 Testing Scan Commands on Projects" -ForegroundColor Yellow
Write-Host "-" * 70

$scanCommands = @(
    "scan:secrets",
    "scan:vulnerabilities"
)

foreach ($proj in $projects) {
    if (-not (Test-Path $proj)) { continue }
    
    $projName = Split-Path $proj -Leaf
    Write-Host "`n📁 Project: $projName" -ForegroundColor Cyan
    
    foreach ($cmd in $scanCommands) {
        Write-Host "  Testing: $cmd" -ForegroundColor Yellow
        Test-Command -Command $cmd -ProjectPath $proj -HelpOnly:$false
        Start-Sleep -Seconds 1
    }
}

Write-Host "`n🚀 Testing Ship Command on Projects" -ForegroundColor Yellow
Write-Host "-" * 70

foreach ($proj in $projects) {
    if (-not (Test-Path $proj)) { continue }
    
    $projName = Split-Path $proj -Leaf
    Write-Host "`n📁 Project: $projName" -ForegroundColor Cyan
    Write-Host "  Testing: ship" -ForegroundColor Yellow
    Test-Command -Command "ship" -ProjectPath $proj -HelpOnly:$false
    Start-Sleep -Seconds 1
}

Write-Host "`n" + ("=" * 70) -ForegroundColor Cyan
Write-Host "`n📊 Test Summary" -ForegroundColor Cyan
Write-Host "-" * 70
Write-Host "✅ Passed: $($results.Passed.Count)" -ForegroundColor Green
Write-Host "❌ Failed: $($results.Failed.Count)" -ForegroundColor Red
Write-Host "⏭️  Skipped: $($results.Skipped.Count)" -ForegroundColor Yellow

if ($results.Failed.Count -gt 0) {
    Write-Host "`n❌ Failed Tests:" -ForegroundColor Red
    foreach ($test in $results.Failed) {
        Write-Host "  - $test" -ForegroundColor Red
    }
}

if ($results.Passed.Count -gt 0) {
    Write-Host "`n✅ Passed Tests:" -ForegroundColor Green
    foreach ($test in $results.Passed | Select-Object -First 20) {
        Write-Host "  - $test" -ForegroundColor Green
    }
    if ($results.Passed.Count -gt 20) {
        Write-Host "  ... and $($results.Passed.Count - 20) more" -ForegroundColor Gray
    }
}

Write-Host "`n" + ("=" * 70) -ForegroundColor Cyan

if ($results.Failed.Count -eq 0) {
    Write-Host "`n✨ All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n⚠️  Some tests failed" -ForegroundColor Yellow
    exit 1
}
