#!/bin/bash
# Production Hardening Verification Suite
# Run this script to verify all production hardening changes

set -e

echo "=========================================="
echo "🔒 Guardrail Production Hardening Verification"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

check_pass() {
  echo -e "${GREEN}✓ PASS:${NC} $1"
  ((PASSED++))
}

check_fail() {
  echo -e "${RED}✗ FAIL:${NC} $1"
  ((FAILED++))
}

check_warn() {
  echo -e "${YELLOW}⚠ WARN:${NC} $1"
  ((WARNINGS++))
}

echo "1. Checking @ts-ignore comments in fastify-auth.ts..."
TS_IGNORE_COUNT=$(grep -c "@ts-ignore" apps/api/src/middleware/fastify-auth.ts 2>/dev/null || echo "0")
if [ "$TS_IGNORE_COUNT" -eq "0" ]; then
  check_pass "Zero @ts-ignore comments in fastify-auth.ts"
else
  check_fail "Found $TS_IGNORE_COUNT @ts-ignore comments in fastify-auth.ts"
fi

echo ""
echo "2. Checking console.log in API routes..."
CONSOLE_LOG_COUNT=$(grep -r "console\\.log" apps/api/src/routes/ 2>/dev/null | grep -v "\.log\." | grep -v "name.*console" | wc -l || echo "0")
if [ "$CONSOLE_LOG_COUNT" -lt "5" ]; then
  check_pass "Minimal console.log usage in API routes ($CONSOLE_LOG_COUNT instances)"
else
  check_warn "Found $CONSOLE_LOG_COUNT console.log statements in API routes"
fi

echo ""
echo "3. Checking console.log in error-handler.ts..."
ERROR_HANDLER_CONSOLE=$(grep -c "console\\." apps/api/src/middleware/error-handler.ts 2>/dev/null || echo "0")
if [ "$ERROR_HANDLER_CONSOLE" -eq "0" ]; then
  check_pass "No console.log in error-handler.ts (using structured logger)"
else
  check_fail "Found $ERROR_HANDLER_CONSOLE console statements in error-handler.ts"
fi

echo ""
echo "4. Checking Redis rate limiter exists..."
if [ -f "apps/api/src/middleware/redis-rate-limiter.ts" ]; then
  FAIL_CLOSED=$(grep -c "failClosed: true" apps/api/src/middleware/redis-rate-limiter.ts 2>/dev/null || echo "0")
  if [ "$FAIL_CLOSED" -gt "0" ]; then
    check_pass "Redis rate limiter with fail-closed behavior exists"
  else
    check_warn "Redis rate limiter exists but fail-closed not configured"
  fi
else
  check_fail "Redis rate limiter not found"
fi

echo ""
echo "5. Checking jest.config.js integration test exclusions..."
EXCLUDED_INTEGRATION=$(grep -c "apps/api/src/__tests__/integration" jest.config.js 2>/dev/null || echo "0")
if [ "$EXCLUDED_INTEGRATION" -eq "0" ]; then
  check_pass "Integration tests enabled in jest.config.js"
else
  check_fail "Integration tests still excluded in jest.config.js"
fi

echo ""
echo "6. Checking CLI version reads from package.json..."
CLI_VERSION_HARDCODED=$(grep -c 'VERSION = "2.0.0"' bin/guardrail.js 2>/dev/null || echo "0")
CLI_VERSION_DYNAMIC=$(grep -c "getVersion()" bin/guardrail.js 2>/dev/null || echo "0")
if [ "$CLI_VERSION_HARDCODED" -eq "0" ] && [ "$CLI_VERSION_DYNAMIC" -gt "0" ]; then
  check_pass "CLI version reads from package.json"
else
  check_fail "CLI version is still hardcoded"
fi

echo ""
echo "7. Checking body limits in Fastify config..."
BODY_LIMIT=$(grep -c "bodyLimit" apps/api/src/index.ts 2>/dev/null || echo "0")
if [ "$BODY_LIMIT" -gt "0" ]; then
  check_pass "Request body limits configured in Fastify"
else
  check_warn "Request body limits not explicitly configured"
fi

echo ""
echo "8. Checking Zod validation schemas exist..."
if [ -f "apps/api/src/schemas/validation.ts" ]; then
  SCHEMA_COUNT=$(grep -c "export const" apps/api/src/schemas/validation.ts 2>/dev/null || echo "0")
  if [ "$SCHEMA_COUNT" -gt "10" ]; then
    check_pass "Zod validation schemas defined ($SCHEMA_COUNT schemas)"
  else
    check_warn "Limited Zod schemas found ($SCHEMA_COUNT)"
  fi
else
  check_fail "Validation schemas file not found"
fi

echo ""
echo "9. Checking auth types definition..."
if [ -f "apps/api/src/types/auth.ts" ]; then
  check_pass "Auth types defined in types/auth.ts"
else
  check_warn "Auth types file not found"
fi

echo ""
echo "10. Checking structured logger usage..."
LOGGER_IMPORTS=$(grep -r "from.*logger" apps/api/src/routes/ 2>/dev/null | wc -l || echo "0")
if [ "$LOGGER_IMPORTS" -gt "5" ]; then
  check_pass "Structured logger imported in routes ($LOGGER_IMPORTS files)"
else
  check_warn "Limited structured logger usage ($LOGGER_IMPORTS imports)"
fi

echo ""
echo "=========================================="
echo "📊 VERIFICATION SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

if [ "$FAILED" -eq "0" ]; then
  echo -e "${GREEN}✅ Production hardening verification passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some checks failed. Review the output above.${NC}"
  exit 1
fi
