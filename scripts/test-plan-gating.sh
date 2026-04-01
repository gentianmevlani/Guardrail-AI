#!/bin/bash
# Test script for plan gating middleware
# Verifies that paid features are properly gated

set -e

API_URL="${API_URL:-http://localhost:3000}"
FREE_USER_EMAIL="${FREE_USER_EMAIL:-free@example.com}"
FREE_USER_PASSWORD="${FREE_USER_PASSWORD:-testpassword123}"
PRO_USER_EMAIL="${PRO_USER_EMAIL:-pro@example.com}"
PRO_USER_PASSWORD="${PRO_USER_PASSWORD:-testpassword123}"

echo "🧪 Testing Plan Gating Middleware"
echo "API URL: $API_URL"
echo ""

# Function to login and get token
login() {
  local email=$1
  local password=$2
  local response=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}")
  
  echo "$response" | jq -r '.token // .accessToken // empty'
}

# Function to test endpoint with token
test_endpoint() {
  local endpoint=$1
  local token=$2
  local expected_status=$3
  local description=$4
  
  echo "Testing: $description"
  response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL$endpoint" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d '{"code":"test code"}')
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [ "$http_code" = "$expected_status" ]; then
    echo "  ✅ Got expected status $expected_status"
  else
    echo "  ❌ Expected status $expected_status, got $http_code"
    echo "  Response: $body" | jq '.' 2>/dev/null || echo "  Response: $body"
    return 1
  fi
}

# Test 1: Free user trying to access Reality Check (should be blocked)
echo "1. Testing Free user access to paid features..."
FREE_TOKEN=$(login "$FREE_USER_EMAIL" "$FREE_USER_PASSWORD")

if [ -z "$FREE_TOKEN" ] || [ "$FREE_TOKEN" = "null" ]; then
  echo "❌ Failed to login as free user"
  exit 1
fi

echo "✅ Free user logged in"

# Reality Check should require Starter (minTierLevel: 1)
test_endpoint "/api/v1/reality-check" "$FREE_TOKEN" "403" "Free user → Reality Check (should block)"

# Deep Reality Check should require Pro (minTierLevel: 2)
test_endpoint "/api/v1/reality-check/deep" "$FREE_TOKEN" "403" "Free user → Deep Reality Check (should block)"

# Autopilot should require Pro (minTierLevel: 2)
test_endpoint "/api/v1/autopilot/enable" "$FREE_TOKEN" "403" "Free user → Autopilot (should block)"

# AI Intelligence should require Pro (minTierLevel: 2)
test_endpoint "/api/v1/intelligence/ai" "$FREE_TOKEN" "403" "Free user → AI Intelligence (should block)"

echo ""

# Test 2: Pro user should have access
echo "2. Testing Pro user access to paid features..."
PRO_TOKEN=$(login "$PRO_USER_EMAIL" "$PRO_USER_PASSWORD")

if [ -z "$PRO_TOKEN" ] || [ "$PRO_TOKEN" = "null" ]; then
  echo "⚠️  Pro user login failed (may not exist in test DB)"
  echo "   Skipping Pro user tests"
else
  echo "✅ Pro user logged in"
  
  # Pro user should have access (200 or 400 for validation errors, but not 403)
  response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/reality-check" \
    -H "Authorization: Bearer $PRO_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"code":"test code"}')
  
  http_code=$(echo "$response" | tail -n1)
  
  if [ "$http_code" = "403" ]; then
    echo "  ❌ Pro user blocked from Reality Check (should have access)"
  else
    echo "  ✅ Pro user has access to Reality Check (got $http_code)"
  fi
fi

echo ""
echo "🎉 Plan gating tests completed!"
