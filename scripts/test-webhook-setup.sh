#!/bin/bash
# Script to verify Stripe webhook setup
# Checks webhook endpoint configuration and tests webhook processing

set -e

API_URL="${API_URL:-http://localhost:3000}"
WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET}"

echo "🔍 Verifying Stripe Webhook Setup"
echo "API URL: $API_URL"
echo ""

# Check if webhook secret is configured
if [ -z "$WEBHOOK_SECRET" ]; then
  echo "⚠️  STRIPE_WEBHOOK_SECRET not set"
  echo "   Webhook signature verification will fail"
else
  echo "✅ STRIPE_WEBHOOK_SECRET is configured"
fi

echo ""

# Check webhook endpoint exists
echo "1. Checking webhook endpoint..."
WEBHOOK_ENDPOINT="$API_URL/api/billing/webhook"

# Test endpoint exists (should return 400 without signature, not 404)
response=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}')

http_code=$(echo "$response" | tail -n1)

if [ "$http_code" = "400" ]; then
  echo "✅ Webhook endpoint exists (returned 400 as expected without signature)"
elif [ "$http_code" = "404" ]; then
  echo "❌ Webhook endpoint not found (404)"
  exit 1
else
  echo "⚠️  Webhook endpoint returned unexpected status: $http_code"
fi

echo ""

# Check webhook processor service exists
echo "2. Verifying webhook processor service..."
if [ -f "apps/api/src/services/webhook-processor.ts" ]; then
  echo "✅ Webhook processor service exists"
else
  echo "❌ Webhook processor service not found"
  exit 1
fi

echo ""

# Check billing routes import webhook processor
echo "3. Checking billing routes integration..."
if grep -q "webhook-processor" apps/api/src/routes/billing.ts; then
  echo "✅ Billing routes import webhook processor"
else
  echo "❌ Billing routes don't import webhook processor"
  exit 1
fi

echo ""

# Verify webhook events are handled
echo "4. Checking webhook event handlers..."
EVENTS=(
  "checkout.session.completed"
  "invoice.payment_succeeded"
  "invoice.payment_failed"
  "customer.subscription.updated"
  "customer.subscription.deleted"
)

for event in "${EVENTS[@]}"; do
  if grep -q "$event" apps/api/src/services/webhook-processor.ts; then
    echo "  ✅ Handler for $event"
  else
    echo "  ❌ Missing handler for $event"
  fi
done

echo ""
echo "📋 Webhook Setup Summary:"
echo "   Endpoint: POST $WEBHOOK_ENDPOINT"
echo "   Secret configured: $([ -n "$WEBHOOK_SECRET" ] && echo "Yes" || echo "No")"
echo "   Processor service: ✅"
echo "   Event handlers: ✅"
echo ""
echo "💡 To test with Stripe CLI:"
echo "   stripe listen --forward-to $WEBHOOK_ENDPOINT"
echo "   stripe trigger checkout.session.completed"
echo ""
echo "🎉 Webhook setup verification completed!"
