# GUARDRAIL Landing Demo Pipeline
# Updates the landing page with real demo artifacts
#
# Usage: .\scripts\update-landing-demo.ps1

param(
    [string]$DemoRepo = "",
    [string]$OutputDir = "apps/web-ui/landing/public/demos",
    [switch]$SkipReality,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Ensure we're in the project root
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (Test-Path "$ProjectRoot\package.json") {
    Set-Location $ProjectRoot
} else {
    $ProjectRoot = Get-Location
}

Write-Host @"
╔══════════════════════════════════════════════════════════════╗
║        🎬 GUARDRAIL Landing Demo Pipeline 🎬                 ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Magenta

# Step 1: Run ship check to generate artifacts
Write-Step "Running Ship Check"

$ShipOutput = ".GUARDRAIL/ship"
$RunsDir = ".GUARDRAIL/runs"

try {
    $env:GUARDRAIL_DEMO_MODE = "true"
    npx ts-node src/bin/ship.ts check --ci --json --output $ShipOutput 2>&1 | Out-Null
    Write-Success "Ship check completed"
} catch {
    Write-Warning "Ship check completed with issues (expected for demo)"
}

# Find the latest run
$LatestRun = Get-ChildItem -Path $RunsDir -Directory -ErrorAction SilentlyContinue | 
    Sort-Object Name -Descending | 
    Select-Object -First 1

if (-not $LatestRun) {
    Write-Error "No run artifacts found"
    exit 1
}

$RunDir = $LatestRun.FullName
Write-Success "Found run: $($LatestRun.Name)"

# Step 2: Run Reality Mode if not skipped
if (-not $SkipReality) {
    Write-Step "Running Reality Mode"
    
    $RealitySpec = Join-Path $RunDir "reality-mode\reality-mode.spec.ts"
    $PlaywrightConfig = Join-Path $ProjectRoot "playwright.demo.config.ts"
    
    if (Test-Path $RealitySpec) {
        try {
            # Use demo config for video output
            if (Test-Path $PlaywrightConfig) {
                npx playwright test $RealitySpec --config=$PlaywrightConfig 2>&1 | Out-Null
            } else {
                npx playwright test $RealitySpec --reporter=list 2>&1 | Out-Null
            }
            Write-Success "Reality Mode test executed"
        } catch {
            Write-Warning "Reality Mode test completed with detections (expected for demo)"
        }
    } else {
        Write-Warning "Reality Mode spec not found, skipping"
    }
}

# Step 3: Create output directory
Write-Step "Preparing Demo Output"

$DemoOutput = Join-Path $ProjectRoot $OutputDir
New-Item -ItemType Directory -Force -Path $DemoOutput | Out-Null
Write-Success "Created output directory: $OutputDir"

# Step 4: Copy artifacts
Write-Step "Copying Artifacts"

# Copy reality mode result
$RealityResult = Join-Path $ShipOutput "reality-mode\reality-mode-result.json"
if (Test-Path $RealityResult) {
    Copy-Item $RealityResult -Destination (Join-Path $DemoOutput "reality-mode-result.json") -Force
    Write-Success "Copied reality-mode-result.json"
}

# Copy reality mode report
$RealityReport = Join-Path $ShipOutput "reality-mode\reality-mode-report.txt"
if (Test-Path $RealityReport) {
    Copy-Item $RealityReport -Destination (Join-Path $DemoOutput "reality-mode-report.txt") -Force
    Write-Success "Copied reality-mode-report.txt"
}

# Copy run report
$RunReport = Join-Path $RunDir "report.txt"
if (Test-Path $RunReport) {
    Copy-Item $RunReport -Destination (Join-Path $DemoOutput "ship-report.txt") -Force
    Write-Success "Copied ship-report.txt"
}

# Copy run summary
$RunSummary = Join-Path $RunDir "summary.json"
if (Test-Path $RunSummary) {
    Copy-Item $RunSummary -Destination (Join-Path $DemoOutput "summary.json") -Force
    Write-Success "Copied summary.json"
}

# Find and copy video if exists
$TestResults = Join-Path $ProjectRoot "test-results"
if (Test-Path $TestResults) {
    $Videos = Get-ChildItem -Path $TestResults -Filter "*.webm" -Recurse
    if ($Videos) {
        $Video = $Videos | Select-Object -First 1
        Copy-Item $Video.FullName -Destination (Join-Path $DemoOutput "reality.webm") -Force
        Write-Success "Copied reality.webm"
    }
}

# Copy replay if exists
$ReplayDir = Join-Path $RunDir "replay"
if (Test-Path $ReplayDir) {
    $Replays = Get-ChildItem -Path $ReplayDir -Filter "*.json"
    if ($Replays) {
        $Replay = $Replays | Select-Object -First 1
        Copy-Item $Replay.FullName -Destination (Join-Path $DemoOutput "replay-raw.json") -Force
        Write-Success "Copied replay.json (raw)"
    }
}

# Step 5: Redact sensitive data
Write-Step "Redacting Sensitive Data"

$RedactScript = Join-Path $ProjectRoot "scripts\redact-demo.mjs"
if (Test-Path $RedactScript) {
    try {
        node $RedactScript $DemoOutput
        Write-Success "Redaction complete"
    } catch {
        Write-Warning "Redaction script failed, manual review recommended"
    }
} else {
    Write-Warning "Redaction script not found, skipping"
}

# Step 6: Generate manifest
Write-Step "Generating Manifest"

$Manifest = @{
    generated = (Get-Date).ToUniversalTime().ToString("o")
    runId = $LatestRun.Name
    files = @(
        "reality-mode-result.json",
        "reality-mode-report.txt",
        "ship-report.txt",
        "summary.json",
        "reality.webm",
        "replay.json"
    ) | Where-Object { Test-Path (Join-Path $DemoOutput $_) }
}

$Manifest | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $DemoOutput "manifest.json")
Write-Success "Generated manifest.json"

# Summary
Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║                    ✅ Demo Updated ✅                        ║
╚══════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green

Write-Host "Output: $DemoOutput"
Write-Host "Files:"
Get-ChildItem $DemoOutput | ForEach-Object {
    Write-Host "  - $($_.Name)"
}

Write-Host "`nTo preview:"
Write-Host "  cd apps/web-ui/landing && npm run dev"
