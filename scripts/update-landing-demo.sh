#!/bin/bash
# GUARDRAIL Landing Demo Pipeline
# Updates the landing page with real demo artifacts
#
# Usage: ./scripts/update-landing-demo.sh [options]
#
# Options:
#   --skip-reality    Skip Reality Mode test execution
#   --output DIR      Custom output directory
#   --verbose         Enable verbose output

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Default values
SKIP_REALITY=false
OUTPUT_DIR="apps/web-ui/landing/public/demos"
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-reality)
      SKIP_REALITY=true
      shift
      ;;
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Helper functions
step() {
  echo -e "\n${CYAN}=== $1 ===${NC}"
}

success() {
  echo -e "${GREEN}✓ $1${NC}"
}

warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
  echo -e "${RED}✗ $1${NC}"
}

# Find project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Banner
echo -e "${MAGENTA}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        🎬 GUARDRAIL Landing Demo Pipeline 🎬                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Step 1: Run ship check to generate artifacts
step "Running Ship Check"

SHIP_OUTPUT=".GUARDRAIL/ship"
RUNS_DIR=".GUARDRAIL/runs"

export GUARDRAIL_DEMO_MODE=true

if npx ts-node src/bin/ship.ts check --ci --json --output "$SHIP_OUTPUT" > /dev/null 2>&1; then
  success "Ship check completed"
else
  warn "Ship check completed with issues (expected for demo)"
fi

# Find the latest run
LATEST_RUN=$(ls -td "$RUNS_DIR"/*/ 2>/dev/null | head -1)

if [ -z "$LATEST_RUN" ]; then
  error "No run artifacts found"
  exit 1
fi

RUN_ID=$(basename "$LATEST_RUN")
success "Found run: $RUN_ID"

# Step 2: Run Reality Mode if not skipped
if [ "$SKIP_REALITY" = false ]; then
  step "Running Reality Mode"
  
  REALITY_SPEC="$LATEST_RUN/reality-mode/reality-mode.spec.ts"
  PLAYWRIGHT_CONFIG="$PROJECT_ROOT/playwright.demo.config.ts"
  
  if [ -f "$REALITY_SPEC" ]; then
    if [ -f "$PLAYWRIGHT_CONFIG" ]; then
      if npx playwright test "$REALITY_SPEC" --config="$PLAYWRIGHT_CONFIG" > /dev/null 2>&1; then
        success "Reality Mode test executed"
      else
        warn "Reality Mode test completed with detections (expected for demo)"
      fi
    else
      if npx playwright test "$REALITY_SPEC" --reporter=list > /dev/null 2>&1; then
        success "Reality Mode test executed"
      else
        warn "Reality Mode test completed with detections (expected for demo)"
      fi
    fi
  else
    warn "Reality Mode spec not found, skipping"
  fi
fi

# Step 3: Create output directory
step "Preparing Demo Output"

DEMO_OUTPUT="$PROJECT_ROOT/$OUTPUT_DIR"
mkdir -p "$DEMO_OUTPUT"
success "Created output directory: $OUTPUT_DIR"

# Step 4: Copy artifacts
step "Copying Artifacts"

# Copy reality mode result
REALITY_RESULT="$SHIP_OUTPUT/reality-mode/reality-mode-result.json"
if [ -f "$REALITY_RESULT" ]; then
  cp "$REALITY_RESULT" "$DEMO_OUTPUT/reality-mode-result.json"
  success "Copied reality-mode-result.json"
fi

# Copy reality mode report
REALITY_REPORT="$SHIP_OUTPUT/reality-mode/reality-mode-report.txt"
if [ -f "$REALITY_REPORT" ]; then
  cp "$REALITY_REPORT" "$DEMO_OUTPUT/reality-mode-report.txt"
  success "Copied reality-mode-report.txt"
fi

# Copy run report
RUN_REPORT="$LATEST_RUN/report.txt"
if [ -f "$RUN_REPORT" ]; then
  cp "$RUN_REPORT" "$DEMO_OUTPUT/ship-report.txt"
  success "Copied ship-report.txt"
fi

# Copy run summary
RUN_SUMMARY="$LATEST_RUN/summary.json"
if [ -f "$RUN_SUMMARY" ]; then
  cp "$RUN_SUMMARY" "$DEMO_OUTPUT/summary.json"
  success "Copied summary.json"
fi

# Find and copy video if exists
TEST_RESULTS="$PROJECT_ROOT/test-results"
if [ -d "$TEST_RESULTS" ]; then
  VIDEO=$(find "$TEST_RESULTS" -name "*.webm" -type f | head -1)
  if [ -n "$VIDEO" ]; then
    cp "$VIDEO" "$DEMO_OUTPUT/reality.webm"
    success "Copied reality.webm"
  fi
fi

# Copy replay if exists
REPLAY_DIR="$LATEST_RUN/replay"
if [ -d "$REPLAY_DIR" ]; then
  REPLAY=$(find "$REPLAY_DIR" -name "*.json" -type f | head -1)
  if [ -n "$REPLAY" ]; then
    cp "$REPLAY" "$DEMO_OUTPUT/replay-raw.json"
    success "Copied replay.json (raw)"
  fi
fi

# Step 5: Redact sensitive data
step "Redacting Sensitive Data"

REDACT_SCRIPT="$PROJECT_ROOT/scripts/redact-demo.mjs"
if [ -f "$REDACT_SCRIPT" ]; then
  if node "$REDACT_SCRIPT" "$DEMO_OUTPUT"; then
    success "Redaction complete"
  else
    warn "Redaction script failed, manual review recommended"
  fi
else
  warn "Redaction script not found, skipping"
fi

# Step 6: Generate manifest
step "Generating Manifest"

cat > "$DEMO_OUTPUT/manifest.json" << EOF
{
  "generated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "runId": "$RUN_ID",
  "files": [
$(
  first=true
  for file in reality-mode-result.json reality-mode-report.txt ship-report.txt summary.json reality.webm replay.json; do
    if [ -f "$DEMO_OUTPUT/$file" ]; then
      if [ "$first" = true ]; then
        first=false
      else
        echo ","
      fi
      echo -n "    \"$file\""
    fi
  done
  echo ""
)
  ]
}
EOF

success "Generated manifest.json"

# Summary
echo -e "${GREEN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    ✅ Demo Updated ✅                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo "Output: $DEMO_OUTPUT"
echo "Files:"
ls -1 "$DEMO_OUTPUT" | while read -r file; do
  echo "  - $file"
done

echo ""
echo "To preview:"
echo "  cd apps/web-ui/landing && npm run dev"
