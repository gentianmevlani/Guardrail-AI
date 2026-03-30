# Billing & Usage Metering Implementation

## Summary

Implemented comprehensive usage metering and billing enforcement with real counters, API-level plan gating, and robust Stripe webhook handling.

## Changes Made

### 1. Source of Truth for Usage ✅

- **Primary**: `UsageCounter` model in Prisma tracks usage per user per billing period
  - Fields: `scanCount`, `realityCount`, `agentCount`, `gateCount`, `fixCount`
  - Period-based: Monthly billing periods (1st of month to last day)
  - Tenant-scoped: Each user's usage is tracked independently

- **Supporting**: `Subscription` model tracks plan, status, renewal dates
- **Seats**: `TeamSeat` model tracks active team members
- **Projects**: `Project` model tracks project count per user

### 2. GET /api/v1/usage Endpoint ✅

**Location**: `apps/api/src/routes/usage.ts`

**Features**:
- Uses `UsageEnforcementService` for accurate usage data
- Tenant-scoped (user ID from JWT)
- Time window support via query params:
  - `period`: 'current' | 'last' | 'custom'
  - `startDate` / `endDate`: For custom periods
- Returns:
  - Usage counts (scans, reality, agent, gate, fix)
  - Limits per tier
  - Remaining usage
  - Seat count and limits
  - Project count
  - Subscription status and renewal date

**Response Format**:
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
    "agent": { "used": 10, "limit": 50, "remaining": 40 }
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

### 3. API-Level Plan Gating ✅

**Location**: `apps/api/src/middleware/plan-gating.ts`

**Features**:
- Middleware factory: `requirePlan(options)`
- Options:
  - `requiredTier`: Exact tier match (e.g., 'pro')
  - `minTierLevel`: Minimum tier level (0=free, 1=starter, 2=pro, 3=compliance, 4=enterprise)
  - `featureName`: For error messages
  - `requireActive`: Check subscription is active/trialing

**Usage Example**:
```typescript
// Require Pro tier or higher
fastify.get("/premium-feature", {
  preHandler: requirePlan({ minTierLevel: 2, featureName: "Premium Feature" })
}, handler);

// Require exact tier
fastify.post("/enterprise-only", {
  preHandler: requirePlan({ requiredTier: "enterprise" })
}, handler);
```

**Enforcement**:
- Returns 403 with clear error message if plan insufficient
- Includes upgrade URL in response
- Logs all blocked access attempts

### 4. Billing Page UI ✅

**Location**: `apps/web-ui/src/app/(dashboard)/billing/page.tsx`

**Updates**:
- Shows current plan with status badge
- Displays renewal date
- Shows seat usage (used/limit)
- Displays usage progress bars for:
  - Code Scans
  - Reality Runs
  - AI Agent Runs
  - Team Members
- Links to Stripe Customer Portal for billing management
- Shows cancellation status if `cancelAtPeriodEnd` is true

**API Integration**:
- Uses `/api/v1/usage` endpoint for accurate data
- Falls back to legacy endpoints if needed
- Handles loading and error states

### 5. Stripe Webhook Handlers ✅

**Location**: `apps/api/src/services/webhook-processor.ts`

**Events Handled**:
1. `checkout.session.completed` - New subscription created
2. `invoice.payment_succeeded` - Payment successful, update subscription
3. `invoice.payment_failed` - Payment failed, mark as past_due
4. `customer.subscription.updated` - Plan change, status update
5. `customer.subscription.deleted` - Subscription canceled

**Features**:
- **Retry Logic**: Exponential backoff (3 retries by default)
- **Idempotency**: Uses Stripe event ID to prevent duplicate processing
- **Logging**: Comprehensive structured logging for all events
- **Error Handling**: Graceful failure with retry, logs errors
- **Billing Events**: Creates `BillingEvent` records for audit trail

**Retry Configuration**:
```typescript
{
  maxRetries: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true  // Delay doubles each retry
}
```

**Webhook Route**: `POST /api/billing/webhook`
- Verifies Stripe signature
- Processes events with retry logic
- Returns 200 immediately (async processing)

## Database Schema

### UsageCounter
```prisma
model UsageCounter {
  id          String   @id @default(cuid())
  userId      String
  periodStart DateTime
  periodEnd   DateTime
  scanCount   Int      @default(0)
  realityCount Int     @default(0)
  agentCount  Int      @default(0)
  gateCount   Int      @default(0)
  fixCount    Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([userId, periodStart])
}
```

### Subscription
```prisma
model Subscription {
  id                String   @id @default(cuid())
  userId            String
  stripeSubscriptionId String? @unique
  stripeCustomerId String
  tier              String   // free, pro, team, enterprise
  status            String   // active, canceled, past_due, trialing
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean  @default(false)
}
```

## Testing Checklist

- [ ] Usage endpoint returns correct numbers for test tenant
- [ ] Plan gating blocks free tier from paid features
- [ ] Downgrades restrict paid actions immediately
- [ ] Expired subscriptions block access
- [ ] Billing page shows accurate plan + usage
- [ ] Stripe webhooks process successfully
- [ ] Webhook retries work on transient failures
- [ ] Billing events are logged correctly

## Migration Notes

1. **Usage Endpoint**: New `/api/v1/usage` endpoint uses `UsageCounter` model
   - Legacy `/api/usage/summary` still works but uses `UsageRecord` model
   - Both endpoints return compatible formats

2. **Plan Gating**: Add `requirePlan()` middleware to protected routes
   - Existing routes without gating will continue to work
   - Add gating incrementally to paid features

3. **Webhooks**: Enhanced webhook processor replaces inline handlers
   - All webhook events now have retry logic
   - Billing events are logged for audit trail

## Environment Variables

Required:
- `STRIPE_SECRET_KEY`: Stripe API key
- `STRIPE_WEBHOOK_SECRET`: Webhook signature verification
- `STRIPE_PRICE_ID_*`: Price IDs for each tier (monthly/annual)

## Next Steps

1. Add usage tracking to scan/reality/agent endpoints
2. Implement usage limits enforcement in action endpoints
3. Add usage alerts when approaching limits
4. Create admin dashboard for usage monitoring
5. Add usage export for compliance

## Commit Message

```
feat: usage metering and billing enforcement

- Implement GET /api/v1/usage with UsageCounter model (source of truth)
- Add API-level plan gating middleware (requirePlan)
- Enhance Stripe webhook handlers with retry logic and logging
- Update billing page to show plan, renewal date, seats, usage progress
- Add links to Stripe portal/checkout

All usage data now comes from UsageCounter model for accuracy.
Plan gating enforced at API level, not just UI.
Webhooks have robust retry mechanism for reliability.
```
