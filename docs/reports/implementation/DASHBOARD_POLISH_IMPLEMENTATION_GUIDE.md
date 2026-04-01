# Dashboard Polish Implementation Guide

This document provides detailed implementation guidance for the 12 tightening improvements identified in the audit.

## Implementation Priority

### P0 - Critical (Implement First)
1. **GitHub Webhook Raw Body Parsing** (Security)
2. **Stripe Webhook Idempotency** (Data Integrity)
3. **Plan Gating Coverage Audit** (Security)
4. **Scan Ingestion Durability** (Data Integrity)
5. **Findings Access Control** (Security)

### P1 - High Priority (Implement Next)
6. **Empty States Missing** (UX)
7. **Double-Submit Prevention** (UX)
8. **Stripe Subscription Reconciliation** (Data Integrity)
9. **Audit Logging for Sensitive Actions** (Security/Observability)
10. **Error Messages Not User-Friendly** (UX)

### P2 - Nice to Have
11. **Optimistic Updates** (UX)
12. **Retry Strategy for External APIs** (Reliability)

## Detailed Implementation Notes

### 1. GitHub Webhook Raw Body Parsing (P0)

**Issue:** GitHub webhook signature verification uses `JSON.stringify(request.body)` which is incorrect - Fastify has already parsed the JSON body. Signature verification requires the original raw body bytes.

**Current Code (apps/api/src/routes/webhooks.ts:139):**
```typescript
const rawBody = JSON.stringify(request.body); // ❌ WRONG - body already parsed
```

**Solution Options:**

**Option A: Use `@fastify/raw-body` plugin (Recommended)**
1. Install: `pnpm add @fastify/raw-body`
2. Register plugin in webhook routes or globally
3. Access raw body via `request.rawBody`
4. Update signature verification to use `request.rawBody`

**Option B: Custom content type parser (Alternative)**
1. Register custom parser that preserves raw body
2. Store raw body on request object
3. Use stored raw body for signature verification

**Files to Change:**
- `apps/api/src/routes/webhooks.ts`
- `apps/api/src/index.ts` (if registering plugin globally)
- `apps/api/package.json` (if installing plugin)

**Implementation Notes:**
- This requires understanding Fastify's plugin system
- The Stripe webhook handler uses `config: { rawBody: true }` but this appears non-functional without a supporting plugin
- Both GitHub and Stripe webhook handlers need the same fix
- Complexity: Medium-High (requires plugin setup and testing)

**Testing:**
- Unit test: Verify signature verification with raw body
- Integration test: Send webhook with valid/invalid signatures
- Manual test: Send actual GitHub webhook and verify signature validation works

### 2. Stripe Webhook Idempotency (P0)

**Issue:** Stripe webhook events processed multiple times if Stripe retries.

**Solution:** Check `BillingEvent` table for existing `stripeEventId` before processing.

**Files to Change:**
- `apps/api/src/routes/billing-webhooks.ts`
- `apps/api/src/services/webhook-processor.ts`

**Implementation:**
- Before processing event, check if `BillingEvent` with same `stripeEventId` exists
- If exists, return early (event already processed)
- If not, process event and create `BillingEvent` record

**Testing:**
- Integration test: Send duplicate webhook events, verify only processed once

### 3. Plan Gating Coverage Audit (P0)

**Issue:** Some premium routes may not use `requirePlan()` middleware.

**Solution:** Audit all routes, add `requirePlan()` where needed.

**Files to Audit:**
- All routes in `apps/api/src/routes/`
- Check for premium features: intelligence, autopilot, ship, reality-check, fixes, exports, license-keys

**Implementation:**
- Create checklist of all premium endpoints
- Verify each uses `requirePlan()` middleware
- Add middleware where missing

**Testing:**
- Integration test: Verify free users cannot access premium endpoints
- Verify premium users can access premium endpoints

### 4. Scan Ingestion Durability (P0)

**Issue:** Scan record created, then job queued - if job queue fails, scan record exists but no job.

**Solution:** Wrap scan creation and job queueing in transaction, or verify scan exists before queueing.

**Files to Change:**
- `apps/api/src/routes/scans.ts`
- `apps/api/src/db/scans.ts`

**Implementation:**
- Use transaction for scan creation + job queueing
- OR: Create scan first, verify it exists, then queue job
- Add error handling if job queue fails

**Testing:**
- Integration test: Simulate job queue failure, verify scan still exists
- Verify scan can be retried

### 5. Findings Access Control (P0)

**Issue:** Need to verify all findings endpoints check user ownership.

**Solution:** Audit findings endpoints, add user scoping checks where missing.

**Files to Change:**
- `apps/api/src/routes/findings.ts`

**Implementation:**
- Verify all endpoints filter by `scan.userId` or check ownership
- Add user scoping checks where missing

**Testing:**
- Integration test: Verify users cannot access other users' findings

### 6-12. Remaining Improvements

See main audit document for detailed implementation notes for each improvement.

## Next Steps

1. **Review Audit:** Review `DASHBOARD_POLISH_AUDIT_AND_IMPLEMENTATION.md`
2. **Prioritize:** Implement P0 fixes first
3. **Implement:** Follow implementation notes for each fix
4. **Test:** Write/update tests for each fix
5. **Verify:** Run verification steps from audit document
6. **Deploy:** Follow rollout plan from audit document
