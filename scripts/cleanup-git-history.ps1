# =============================================================================
# Git History Cleanup Script - Remove .env files from history (Windows)
# =============================================================================
# This script uses BFG Repo-Cleaner to remove .env files from git history.
# 
# Prerequisites:
#   - Java Runtime Environment (JRE)
#   - BFG JAR file (download from https://rtyley.github.io/bfg-repo-cleaner/)
#
# DANGER: This rewrites git history. Coordinate with your team first!
# =============================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Red
Write-Host "║  ⚠️   DANGER: GIT HISTORY REWRITE                              ║" -ForegroundColor Red
Write-Host "║                                                               ║" -ForegroundColor Red
Write-Host "║  This script will PERMANENTLY modify git history.            ║" -ForegroundColor Red
Write-Host "║  All team members must re-clone after this operation.        ║" -ForegroundColor Red
Write-Host "╚═══════════════════════════════════════════════════════════════╝" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Have you coordinated with your team? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Aborting. Coordinate with team first." -ForegroundColor Yellow
    exit 1
}

# Check for BFG JAR
$bfgPath = ".\bfg.jar"
if (-not (Test-Path $bfgPath)) {
    $bfgPath = "$env:USERPROFILE\bfg.jar"
    if (-not (Test-Path $bfgPath)) {
        Write-Host "BFG not found. Please download from:" -ForegroundColor Yellow
        Write-Host "  https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"
        Write-Host "  Save as bfg.jar in the current directory or $env:USERPROFILE"
        exit 1
    }
}

# Check for Java
try {
    java -version 2>&1 | Out-Null
} catch {
    Write-Host "Java not found. Please install Java Runtime Environment." -ForegroundColor Red
    exit 1
}

# Get repo root
$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
    Write-Host "Error: Not in a git repository" -ForegroundColor Red
    exit 1
}

Set-Location $repoRoot
$repoName = Split-Path $repoRoot -Leaf
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = "..\$repoName-backup-$timestamp"

Write-Host "Step 1: Creating backup..." -ForegroundColor Green
Copy-Item -Recurse $repoRoot $backupDir
Write-Host "Backup created at: $backupDir"

Write-Host "Step 2: Checking for .env files in history..." -ForegroundColor Green
$envFiles = git log --all --full-history -- "*.env*" --oneline 2>$null | Select-Object -First 20
if (-not $envFiles) {
    Write-Host "No .env files found in git history. Nothing to clean."
    exit 0
}

Write-Host "Found .env files in these commits:"
$envFiles | ForEach-Object { Write-Host "  $_" }
Write-Host ""

# Get remote URL
$remoteUrl = git remote get-url origin 2>$null

Write-Host "Step 3: Creating mirror clone for BFG..." -ForegroundColor Green
$mirrorDir = "..\$repoName-mirror.git"
if (Test-Path $mirrorDir) {
    Remove-Item -Recurse -Force $mirrorDir
}

if ($remoteUrl) {
    git clone --mirror $remoteUrl $mirrorDir
} else {
    git clone --mirror . $mirrorDir
}

Write-Host "Step 4: Running BFG to remove .env files..." -ForegroundColor Green
Set-Location $mirrorDir

# Run BFG
java -jar $bfgPath --delete-files '.env*' --no-blob-protection .

Write-Host "Step 5: Cleaning up refs and garbage collecting..." -ForegroundColor Green
git reflog expire --expire=now --all
git gc --prune=now --aggressive

Write-Host "Step 6: Ready to force push" -ForegroundColor Green
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "IMPORTANT: Before force pushing, notify your team:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  📢 TEAM NOTIFICATION MESSAGE:"
Write-Host "  ─────────────────────────────"
Write-Host "  ⚠️ SECURITY: Force push incoming in 5 minutes."
Write-Host "  Everyone must:"
Write-Host "    1. Commit/stash all local changes NOW"
Write-Host "    2. After the push, DELETE your local repo"
Write-Host "    3. Fresh clone: git clone $remoteUrl"
Write-Host "  Do NOT push until you've re-cloned!"
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""

$pushConfirm = Read-Host "Ready to force push? (yes/no)"
if ($pushConfirm -eq "yes") {
    Write-Host "Force pushing..." -ForegroundColor Red
    git push --force
    Write-Host "Done! History has been rewritten." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. All team members must delete local repos and re-clone"
    Write-Host "  2. Run: node scripts/verify-secrets.js"
    Write-Host "  3. Rotate all exposed credentials (see docs/SECURITY-INCIDENT-RESPONSE.md)"
} else {
    Write-Host "Force push skipped. To push manually:"
    Write-Host "  cd $mirrorDir"
    Write-Host "  git push --force"
}

Set-Location $repoRoot
Write-Host ""
Write-Host "Cleanup complete!" -ForegroundColor Green
Write-Host "Mirror repo: $mirrorDir"
Write-Host "Backup repo: $backupDir"
