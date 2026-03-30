#!/bin/bash
# Guardrail Smoke Test Script
# Tests core endpoints and runs a sample scan
#
# Usage:
#   ./scripts/smoke-test.sh [local|staging|production]
#   ENV=local ./scripts/smoke-test.sh
#
# Environment variables:
#   API_URL - API base URL (defaults based on ENV)
#   WEB_URL - Web UI URL (defaults based on ENV)

set -e

ENV="${1:-${ENV:-local}}"

# Set URLs based on environment
case "$ENV" in
  local)
    API_URL="${API_URL:-http://localhost:3000}"
    WEB_URL="${WEB_URL:-http://localhost:5000}"
    ;;
  staging)
    API_URL="${API_URL:-https://api-staging.yourdomain.com}"
    WEB_URL="${WEB_URL:-https://staging.yourdomain.com}"
    ;;
  production)
    API_URL="${API_URL:-https://api.yourdomain.com}"
    WEB_URL="${WEB_URL:-https://yourdomain.com}"
    ;;
  *)
    echo "❌ Unknown environment: $ENV"
    echo "Usage: ./scripts/smoke-test.sh [local|staging|production]"
    exit 1
    ;;
esac

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Running smoke tests against $ENV environment"
echo "   API: $API_URL"
echo "   Web: $WEB_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

FAILED=0

# Helper function to test endpoint
test_endpoint() {
  local name=$1
  local url=$2
  local expected_status=${3:-200}
  local check_json=${4:-false}
  
  echo -n "Testing $name... "
  
  HTTP_CODE=$(curl -s -o /tmp/smoke_response.json -w "%{http_code}" --max-time 10 "$url" || echo "000")
  
  if [ "$HTTP_CODE" = "$expected_status" ] || [ "$HTTP_CODE" = "000" ]; then
    if [ "$HTTP_CODE" = "000" ]; then
      echo "❌ FAILED (timeout/unreachable)"
      FAILED=$((FAILED + 1))
      return 1
    fi
    
    if [ "$check_json" = "true" ]; then
      if grep -q '"ok":true' /tmp/smoke_response.json 2>/dev/null || \
         grep -q '"status":"ok"' /tmp/smoke_response.json 2>/dev/null || \
         grep -q '"status":"alive"' /tmp/smoke_response.json 2>/dev/null; then
        echo "✅ OK ($HTTP_CODE)"
        return 0
      else
        echo "❌ FAILED (invalid response)"
        cat /tmp/smoke_response.json | head -c 200
        echo ""
        FAILED=$((FAILED + 1))
        return 1
      fi
    else
      echo "✅ OK ($HTTP_CODE)"
      return 0
    fi
  else
    echo "❌ FAILED ($HTTP_CODE, expected $expected_status)"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

# Test 1: API Health Check
echo "1. API Health Check"
test_endpoint "API /health" "$API_URL/health" 200 true

# Test 2: API Liveness Probe
echo "2. API Liveness Probe"
test_endpoint "API /health/live" "$API_URL/health/live" 200 true

# Test 3: API Readiness Probe
echo "3. API Readiness Probe"
test_endpoint "API /health/ready" "$API_URL/health/ready" 200 true

# Test 4: Web UI Health Check
echo "4. Web UI Health Check"
test_endpoint "Web /api/health" "$WEB_URL/api/health" 200 true

# Test 5: Web UI Homepage
echo "5. Web UI Homepage"
test_endpoint "Web /" "$WEB_URL/" 200 false

# Test 6: API OpenAPI Spec (if available)
echo "6. API OpenAPI Spec"
test_endpoint "API /api/openapi.json" "$API_URL/api/openapi.json" 200 false || echo "   ⚠️  OpenAPI spec not available (optional)"

# Test 7: Database Connection (via API health)
echo "7. Database Connection"
DB_CHECK=$(curl -s "$API_URL/health" 2>/dev/null | grep -o '"db":"ok"' || echo "")
if [ -n "$DB_CHECK" ]; then
  echo "   ✅ Database: Connected"
else
  echo "   ⚠️  Database: Status unknown (check API health response)"
fi

# Test 8: Sample Scan (if API key available)
if [ -n "$GUARDRAIL_API_KEY" ] && [ "$ENV" != "local" ]; then
  echo "8. Sample Scan Test"
  echo -n "   Creating test scan... "
  
  SCAN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/scans" \
    -H "Authorization: Bearer $GUARDRAIL_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "projectPath": ".",
      "type": "quick",
      "config": {
        "includeSecrets": false,
        "includeDependencies": false
      }
    }' 2>/dev/null || echo '{"error":"failed"}')
  
  if echo "$SCAN_RESPONSE" | grep -q '"id"'; then
    SCAN_ID=$(echo "$SCAN_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
    echo "✅ Created (ID: $SCAN_ID)"
    
    # Wait a bit for scan to process
    sleep 2
    
    # Check scan status
    echo -n "   Checking scan status... "
    STATUS_RESPONSE=$(curl -s "$API_URL/api/v1/scans/$SCAN_ID" \
      -H "Authorization: Bearer $GUARDRAIL_API_KEY" 2>/dev/null || echo '{"status":"unknown"}')
    
    if echo "$STATUS_RESPONSE" | grep -q '"status"'; then
      SCAN_STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
      echo "✅ Status: $SCAN_STATUS"
    else
      echo "⚠️  Could not retrieve scan status"
    fi
  else
    echo "⚠️  Scan creation failed (may require authentication)"
    echo "   Response: $(echo "$SCAN_RESPONSE" | head -c 200)"
  fi
else
  echo "8. Sample Scan Test"
  echo "   ⚠️  Skipped (set GUARDRAIL_API_KEY to test scans)"
fi

# Test 9: Response Time Check
echo "9. Response Time Check"
echo -n "   API /health: "
API_TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$API_URL/health" || echo "999")
API_MS=$(echo "$API_TIME * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "9999")
if [ "$API_MS" -lt 2000 ]; then
  echo "✅ ${API_TIME}s (${API_MS}ms)"
else
  echo "⚠️  ${API_TIME}s (${API_MS}ms) - slow"
fi

echo -n "   Web /: "
WEB_TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$WEB_URL/" || echo "999")
WEB_MS=$(echo "$WEB_TIME * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "9999")
if [ "$WEB_MS" -lt 5000 ]; then
  echo "✅ ${WEB_TIME}s (${WEB_MS}ms)"
else
  echo "⚠️  ${WEB_TIME}s (${WEB_MS}ms) - slow"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
  echo "✅ All smoke tests passed!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo "❌ $FAILED test(s) failed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
