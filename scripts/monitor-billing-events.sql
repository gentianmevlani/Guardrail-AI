-- SQL queries to monitor billing events in the database
-- Run these queries to verify webhook processing and billing activity

-- 1. Recent billing events (last 24 hours)
SELECT 
  id,
  "eventType",
  "eventSource",
  "stripeEventId",
  "userId",
  "subscriptionId",
  "createdAt",
  metadata
FROM billing_events
WHERE "createdAt" >= NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC
LIMIT 50;

-- 2. Failed webhook events (check for errors)
SELECT 
  id,
  "eventType",
  "eventSource",
  "stripeEventId",
  "userId",
  "createdAt",
  metadata
FROM billing_events
WHERE metadata->>'error' IS NOT NULL
  OR metadata->>'retryCount' IS NOT NULL
ORDER BY "createdAt" DESC
LIMIT 20;

-- 3. Subscription status changes
SELECT 
  be.id,
  be."eventType",
  be."createdAt",
  s.tier,
  s.status,
  s."currentPeriodStart",
  s."currentPeriodEnd",
  u.email
FROM billing_events be
LEFT JOIN subscriptions s ON be."subscriptionId" = s.id
LEFT JOIN users u ON be."userId" = u.id
WHERE be."eventType" IN (
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'checkout.session.completed'
)
ORDER BY be."createdAt" DESC
LIMIT 20;

-- 4. Payment events
SELECT 
  be.id,
  be."eventType",
  be."createdAt",
  be.metadata->>'amount' as amount,
  be.metadata->>'currency' as currency,
  s.tier,
  u.email
FROM billing_events be
LEFT JOIN subscriptions s ON be."subscriptionId" = s.id
LEFT JOIN users u ON be."userId" = u.id
WHERE be."eventType" IN (
  'invoice.payment_succeeded',
  'invoice.payment_failed'
)
ORDER BY be."createdAt" DESC
LIMIT 20;

-- 5. Active subscriptions summary
SELECT 
  s.tier,
  s.status,
  COUNT(*) as count,
  SUM(s.quantity) as total_seats
FROM subscriptions s
WHERE s.status IN ('active', 'trialing')
GROUP BY s.tier, s.status
ORDER BY s.tier, s.status;

-- 6. Usage counters for current period
SELECT 
  u.email,
  s.tier,
  uc."scanCount",
  uc."realityCount",
  uc."agentCount",
  uc."gateCount",
  uc."fixCount",
  uc."periodStart",
  uc."periodEnd"
FROM usage_counters uc
JOIN users u ON uc."userId" = u.id
LEFT JOIN subscriptions s ON s."userId" = u.id AND s.status = 'active'
WHERE uc."periodStart" >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY uc."scanCount" DESC
LIMIT 20;

-- 7. Users with expired/canceled subscriptions (should be restricted)
SELECT 
  u.email,
  s.tier,
  s.status,
  s."currentPeriodEnd",
  CASE 
    WHEN s."currentPeriodEnd" < NOW() THEN 'Expired'
    WHEN s.status = 'canceled' THEN 'Canceled'
    WHEN s.status = 'past_due' THEN 'Past Due'
    ELSE 'Other'
  END as restriction_reason
FROM subscriptions s
JOIN users u ON s."userId" = u.id
WHERE s.status IN ('canceled', 'past_due')
   OR s."currentPeriodEnd" < NOW()
ORDER BY s."currentPeriodEnd" DESC
LIMIT 20;

-- 8. Webhook processing stats (by event type)
SELECT 
  "eventType",
  COUNT(*) as total_events,
  COUNT(DISTINCT "userId") as affected_users,
  MIN("createdAt") as first_event,
  MAX("createdAt") as last_event
FROM billing_events
WHERE "createdAt" >= NOW() - INTERVAL '7 days'
GROUP BY "eventType"
ORDER BY total_events DESC;
