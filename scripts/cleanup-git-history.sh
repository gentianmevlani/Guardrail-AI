#!/bin/bash
# =============================================================================
# Git History Cleanup Script - Remove .env files from history
# =============================================================================
# This script uses BFG Repo-Cleaner to remove .env files from git history.
# 
# Prerequisites:
#   - Java Runtime Environment (JRE)
#   - BFG Repo-Cleaner: brew install bfg (Mac) or download JAR
#
# DANGER: This rewrites git history. Coordinate with your team first!
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ⚠️   DANGER: GIT HISTORY REWRITE                             ║"
echo "║                                                               ║"
echo "║  This script will PERMANENTLY modify git history.            ║"
echo "║  All team members must re-clone after this operation.        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Confirm
read -p "Have you coordinated with your team? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborting. Coordinate with team first."
    exit 1
fi

# Check for BFG
if ! command -v bfg &> /dev/null && [ ! -f "bfg.jar" ]; then
    echo -e "${YELLOW}BFG not found. Installing...${NC}"
    if command -v brew &> /dev/null; then
        brew install bfg
    else
        echo "Please install BFG manually:"
        echo "  Download from: https://rtyley.github.io/bfg-repo-cleaner/"
        echo "  Or: brew install bfg (Mac)"
        exit 1
    fi
fi

# Get repo root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
    echo "Error: Not in a git repository"
    exit 1
fi

cd "$REPO_ROOT"
REPO_NAME=$(basename "$REPO_ROOT")
BACKUP_DIR="../${REPO_NAME}-backup-$(date +%Y%m%d-%H%M%S)"

echo -e "${GREEN}Step 1: Creating backup...${NC}"
cp -r "$REPO_ROOT" "$BACKUP_DIR"
echo "Backup created at: $BACKUP_DIR"

echo -e "${GREEN}Step 2: Checking for .env files in history...${NC}"
ENV_FILES=$(git log --all --full-history -- "*.env*" --oneline 2>/dev/null | head -20 || echo "")
if [ -z "$ENV_FILES" ]; then
    echo "No .env files found in git history. Nothing to clean."
    exit 0
fi

echo "Found .env files in these commits:"
echo "$ENV_FILES"
echo ""

# Get remote URL
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE_URL" ]; then
    echo -e "${YELLOW}Warning: No remote 'origin' found${NC}"
fi

echo -e "${GREEN}Step 3: Creating mirror clone for BFG...${NC}"
MIRROR_DIR="../${REPO_NAME}-mirror.git"
rm -rf "$MIRROR_DIR"

if [ -n "$REMOTE_URL" ]; then
    git clone --mirror "$REMOTE_URL" "$MIRROR_DIR"
else
    # Local mirror
    git clone --mirror . "$MIRROR_DIR"
fi

echo -e "${GREEN}Step 4: Running BFG to remove .env files...${NC}"
cd "$MIRROR_DIR"

# Run BFG
if command -v bfg &> /dev/null; then
    bfg --delete-files '.env*' --no-blob-protection .
else
    java -jar "$REPO_ROOT/bfg.jar" --delete-files '.env*' --no-blob-protection .
fi

echo -e "${GREEN}Step 5: Cleaning up refs and garbage collecting...${NC}"
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo -e "${GREEN}Step 6: Ready to force push${NC}"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}IMPORTANT: Before force pushing, notify your team:${NC}"
echo ""
echo "  📢 TEAM NOTIFICATION MESSAGE:"
echo "  ─────────────────────────────"
echo "  ⚠️ SECURITY: Force push incoming in 5 minutes."
echo "  Everyone must:"
echo "    1. Commit/stash all local changes NOW"
echo "    2. After the push, DELETE your local repo"
echo "    3. Fresh clone: git clone $REMOTE_URL"
echo "  Do NOT push until you've re-cloned!"
echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""

read -p "Ready to force push? (yes/no): " push_confirm
if [ "$push_confirm" == "yes" ]; then
    echo -e "${RED}Force pushing...${NC}"
    git push --force
    echo -e "${GREEN}Done! History has been rewritten.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. All team members must delete local repos and re-clone"
    echo "  2. Run: node scripts/verify-secrets.js"
    echo "  3. Rotate all exposed credentials (see docs/SECURITY-INCIDENT-RESPONSE.md)"
else
    echo "Force push skipped. To push manually:"
    echo "  cd $MIRROR_DIR"
    echo "  git push --force"
fi

cd "$REPO_ROOT"
echo ""
echo -e "${GREEN}Cleanup complete!${NC}"
echo "Mirror repo: $MIRROR_DIR"
echo "Backup repo: $BACKUP_DIR"
