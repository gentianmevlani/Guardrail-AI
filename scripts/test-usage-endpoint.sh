#!/bin/bash
# Test script for /api/v1/usage endpoint
# Tests usage endpoint with a test tenant

set -e

API_URL="${API_URL:-http://localhost:3000}"
TEST_USER_EMAIL="${TEST_USER_EMAIL:-test@example.com}"
TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-testpassword123}"

echo "🧪 Testing /api/v1/usage endpoint"
echo "API URL: $API_URL"
echo ""

# Step 1: Login and get token
echo "1. Logging in as test user..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_USER_EMAIL\",\"password\":\"$TEST_USER_PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token // .accessToken // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed. Response:"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Login successful"
echo ""

# Step 2: Get usage data
echo "2. Fetching usage data from /api/v1/usage..."
USAGE_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/usage" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Response:"
echo "$USAGE_RESPONSE" | jq '.'

# Validate response structure
SUCCESS=$(echo "$USAGE_RESPONSE" | jq -r '.success // false')
TIER=$(echo "$USAGE_RESPONSE" | jq -r '.tier // empty')
PERIOD_START=$(echo "$USAGE_RESPONSE" | jq -r '.period.start // empty')
PERIOD_END=$(echo "$USAGE_RESPONSE" | jq -r '.period.end // empty')

if [ "$SUCCESS" != "true" ]; then
  echo "❌ Usage endpoint returned success=false"
  exit 1
fi

if [ -z "$TIER" ]; then
  echo "❌ Missing tier in response"
  exit 1
fi

if [ -z "$PERIOD_START" ] || [ -z "$PERIOD_END" ]; then
  echo "❌ Missing period dates in response"
  exit 1
fi

echo ""
echo "✅ Usage endpoint test passed!"
echo "   Tier: $TIER"
echo "   Period: $PERIOD_START to $PERIOD_END"
echo ""

# Step 3: Test with query parameters
echo "3. Testing with custom period query..."
CUSTOM_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/usage?period=custom&startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

CUSTOM_SUCCESS=$(echo "$CUSTOM_RESPONSE" | jq -r '.success // false')

if [ "$CUSTOM_SUCCESS" = "true" ]; then
  echo "✅ Custom period query works"
else
  echo "⚠️  Custom period query returned success=false (may not be implemented)"
fi

echo ""
echo "🎉 All tests completed!"
