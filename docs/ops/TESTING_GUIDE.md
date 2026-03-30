# Testing Guide: Usage Metering & Billing Enforcement

## Overview

This guide covers testing the billing and usage metering implementation, including:
1. Testing the `/api/v1/usage` endpoint
2. Verifying plan gating on paid features
3. Testing Stripe webhook processing
4. Monitoring billing events

## Prerequisites

- API server running (default: `http://localhost:3000`)
- Database with test users:
  - Free tier user: `free@example.com`
  - Pro tier user: `pro@example.com`
- Stripe webhook secret configured (for webhook tests)

## 1. Test Usage Endpoint

### Manual Test

```bash
# Login and get token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.token')

# Get usage
curl -X GET http://localhost:3000/api/v1/usage \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

### Expected Response

```json
{
  "success": true,
  "tier": "pro",
  "period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "usage": {
    "scans": { "used": 150, "limit": 500, "remaining": 350 },
    "reality": { "used": 20, "limit": 100, "remaining": 80 },
    "agent": { "used": 10, "limit": 50, "remaining": 40 },
    "gate": { "used": 5, "limit": 500, "remaining": 495 },
    "fix": { "used": 2, "limit": 100, "remaining": 98 }
  },
  "seats": { "used": 3, "limit": 5 },
  "projects": { "used": 12, "limit": null },
  "subscription": {
    "status": "active",
    "renewalDate": "2024-02-01T00:00:00Z",
    "cancelAtPeriodEnd": false
  }
}
```

### Automated Test Script

```bash
# Run the test script
./scripts/test-usage-endpoint.sh

# Or with custom API URL
API_URL=http://localhost:3000 ./scripts/test-usage-endpoint.sh
```

## 2. Test Plan Gating

### Test Free User Access

Free users should be blocked from:
- Reality Check (requires Starter)
- Deep Reality Check (requires Pro)
- Autopilot (requires Pro)
- AI Intelligence (requires Pro)

```bash
# Login as free user
FREE_TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"free@example.com","password":"password"}' \
  | jq -r '.token')

# Try to access Reality Check (should return 403)
curl -X POST http://localhost:3000/api/v1/reality-check \
  -H "Authorization: Bearer $FREE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"test"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected**: HTTP 403 with error message:
```json
{
  "success": false,
  "error": "Plan upgrade required",
  "code": "PLAN_UPGRADE_REQUIRED",
  "message": "This feature requires at least the starter plan. Your current plan is free.",
  "currentTier": "free",
  "upgradeUrl": "/pricing"
}
```

### Test Pro User Access

Pro users should have access to all features:

```bash
# Login as pro user
PRO_TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"pro@example.com","password":"password"}' \
  | jq -r '.token')

# Access Reality Check (should return 200)
curl -X POST http://localhost:3000/api/v1/reality-check \
  -H "Authorization: Bearer $PRO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"test"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected**: HTTP 200 with analysis results

### Automated Test Script

```bash
./scripts/test-plan-gating.sh
```

## 3. Test Stripe Webhooks

### Verify Webhook Setup

```bash
./scripts/test-webhook-setup.sh
```

### Test with Stripe CLI

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli

2. Forward webhooks to local server:
```bash
stripe listen --forward-to http://localhost:3000/api/billing/webhook
```

3. Trigger test events:
```bash
# Test checkout completed
stripe trigger checkout.session.completed

# Test payment succeeded
stripe trigger invoice.payment_succeeded

# Test payment failed
stripe trigger invoice.payment_failed

# Test subscription updated
stripe trigger customer.subscription.updated

# Test subscription deleted
stripe trigger customer.subscription.deleted
```

### Verify Webhook Processing

Check the database for billing events:

```sql
-- Recent billing events
SELECT * FROM billing_events 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

Or use the monitoring script:

```bash
psql $DATABASE_URL -f scripts/monitor-billing-events.sql
```

## 4. Monitor Billing Events

### SQL Queries

Run the monitoring queries:

```bash
psql $DATABASE_URL -f scripts/monitor-billing-events.sql
```

Key queries:
1. **Recent billing events** - Last 24 hours of webhook activity
2. **Failed webhook events** - Events with errors or retries
3. **Subscription status changes** - Track plan upgrades/downgrades
4. **Payment events** - Successful and failed payments
5. **Active subscriptions summary** - Count by tier and status
6. **Usage counters** - Current period usage per user
7. **Expired subscriptions** - Users who should be restricted
8. **Webhook processing stats** - Event type breakdown

### Check Subscription Updates

After a webhook event, verify the subscription was updated:

```sql
SELECT 
  u.email,
  s.tier,
  s.status,
  s."currentPeriodStart",
  s."currentPeriodEnd",
  s."cancelAtPeriodEnd"
FROM subscriptions s
JOIN users u ON s."userId" = u.id
WHERE u.email = 'test@example.com';
```

## 5. Test Scenarios

### Scenario 1: New Subscription

1. User completes Stripe checkout
2. Webhook `checkout.session.completed` fires
3. Verify:
   - Subscription created in database
   - Tier set correctly
   - Status is "active" or "trialing"
   - Billing event logged

### Scenario 2: Payment Failed

1. Stripe payment fails
2. Webhook `invoice.payment_failed` fires
3. Verify:
   - Subscription status set to "past_due"
   - Billing event logged
   - User should be blocked from paid features (test with API)

### Scenario 3: Subscription Canceled

1. User cancels subscription
2. Webhook `customer.subscription.deleted` fires
3. Verify:
   - Subscription status set to "canceled"
   - Tier set to "free"
   - User blocked from paid features

### Scenario 4: Usage Limits

1. User exceeds scan limit
2. Verify:
   - Usage counter shows over limit
   - API should block further scans (if enforced)
   - Billing page shows usage warning

## 6. Acceptance Criteria Checklist

- [ ] Usage endpoint returns correct numbers for test tenant
- [ ] Free tier users blocked from paid features (403)
- [ ] Pro tier users have access to paid features (200)
- [ ] Downgrades restrict paid actions immediately
- [ ] Expired subscriptions block access
- [ ] Billing page shows accurate plan + usage
- [ ] Stripe webhooks process successfully
- [ ] Webhook retries work on transient failures
- [ ] Billing events are logged correctly
- [ ] Subscription updates reflect in database

## 7. Troubleshooting

### Usage endpoint returns 401
- Check JWT token is valid
- Verify user exists in database
- Check auth middleware is working

### Plan gating not working
- Verify `requirePlan` middleware is added to route
- Check subscription status is "active" or "trialing"
- Verify tier mapping is correct

### Webhooks not processing
- Check `STRIPE_WEBHOOK_SECRET` is set
- Verify webhook signature validation
- Check database connection
- Review logs for errors

### Usage counters not updating
- Verify `UsageCounter` model is being used
- Check billing period calculation
- Ensure usage tracking is called after actions

## 8. Next Steps

After successful testing:
1. Deploy to staging environment
2. Test with real Stripe test mode
3. Monitor production webhook processing
4. Set up alerts for failed webhooks
5. Create admin dashboard for usage monitoring
