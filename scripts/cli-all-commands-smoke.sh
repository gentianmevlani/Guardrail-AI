#!/usr/bin/env bash
# Exercise guardrail CLI: help/version and a small JSON scan.
# Tier-gated commands: --help must work without login (see checkCommandAccess in bin/guardrail.js).
#
# Usage: ./scripts/cli-all-commands-smoke.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export GUARDRAIL_SKIP_AUTH=1

CLI=(node bin/guardrail.js)
FAILED=0

run_expect_zero() {
  local label="$1"
  shift
  echo ""
  echo "━━ $label ━━"
  if "${CLI[@]}" "$@" >/tmp/gr-cli-smoke.out 2>&1; then
    echo "OK (exit 0)"
  else
    local ec=$?
    echo "FAIL (exit $ec)"
    head -25 /tmp/gr-cli-smoke.out
    FAILED=$((FAILED + 1))
  fi
}

run_doctor() {
  echo ""
  echo "━━ doctor ━━"
  if "${CLI[@]}" doctor >/tmp/gr-cli-smoke.out 2>&1; then
    echo "OK (exit 0)"
  else
    local ec=$?
    if [[ "$ec" -eq 1 ]] && grep -q "DIAGNOSIS REPORT" /tmp/gr-cli-smoke.out 2>/dev/null; then
      echo "OK (exit 1, warnings only)"
    else
      echo "FAIL (exit $ec)"
      head -25 /tmp/gr-cli-smoke.out
      FAILED=$((FAILED + 1))
    fi
  fi
}

run_whoami() {
  echo ""
  echo "━━ whoami ━━"
  if "${CLI[@]}" whoami >/tmp/gr-cli-smoke.out 2>&1; then
    echo "OK (exit 0)"
  else
    local ec=$?
    if [[ "$ec" -eq 1 ]] && grep -qi "not logged in" /tmp/gr-cli-smoke.out 2>/dev/null; then
      echo "OK (exit 1, not logged in)"
    else
      echo "FAIL (exit $ec)"
      head -25 /tmp/gr-cli-smoke.out
      FAILED=$((FAILED + 1))
    fi
  fi
}

# Scan may exit 1 when policy finds critical issues; JSON on stdout is still valid.
run_scan_json_small() {
  echo ""
  echo "━━ scan --json (bin/) ━━"
  if "${CLI[@]}" scan --json --path bin >/tmp/gr-cli-smoke.out 2>&1; then
    echo "OK (exit 0)"
  else
    local ec=$?
    if grep -q '"totalFindings"' /tmp/gr-cli-smoke.out 2>/dev/null; then
      echo "OK (exit $ec, policy / findings)"
    else
      echo "FAIL (exit $ec, no JSON summary)"
      head -40 /tmp/gr-cli-smoke.out
      FAILED=$((FAILED + 1))
    fi
  fi
}

# May fail if optional engine not built — only require --help works
run_enhanced_ship_help_only() {
  echo ""
  echo "━━ enhanced-ship --help ━━"
  if "${CLI[@]}" enhanced-ship --help >/tmp/gr-cli-smoke.out 2>&1; then
    echo "OK (exit 0)"
  else
    local ec=$?
    echo "WARN (exit $ec) — optional engine may be missing; check output"
    head -15 /tmp/gr-cli-smoke.out
  fi
}

run_expect_zero "version" version
run_expect_zero "scan --help" scan --help
run_expect_zero "gate --help" gate --help
run_expect_zero "ship --help" ship --help
run_doctor
run_expect_zero "context --help" context --help
run_expect_zero "validate (README.md)" validate --file=README.md
run_expect_zero "mcp --help" mcp --help
run_expect_zero "init --help" init --help
run_whoami
run_expect_zero "badge --help" badge --help

run_expect_zero "reality-sniff --help" reality-sniff --help
run_expect_zero "firewall --help" firewall --help
run_expect_zero "rules --help" rules --help

run_enhanced_ship_help_only
run_expect_zero "launch --help" launch --help
run_expect_zero "autopilot --help" autopilot --help
run_expect_zero "fix --help" fix --help
run_expect_zero "proof --help" proof --help
run_expect_zero "reality --help" reality --help
run_expect_zero "ai --help" ai --help
run_expect_zero "upgrade --help" upgrade --help
run_expect_zero "certify --help" certify --help
run_expect_zero "verify-agent-output --help" verify-agent-output --help
run_expect_zero "fixpacks --help" fixpacks --help
run_expect_zero "audit --help" audit --help
run_expect_zero "mdc --help" mdc --help

run_scan_json_small

echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo "cli-all-commands-smoke: all checks passed."
  exit 0
else
  echo "cli-all-commands-smoke: $FAILED check(s) failed."
  exit 1
fi
