# Dashboard + Integrations Tighten & Polish Report
## Feature-Freeze Hardening Pass

**Date**: 2025-01-08  
**Engineer**: Dashboard Polish Team  
**Scope**: Dashboard UX correctness, integration reliability (GitHub + Stripe + Auth + Scan Ingestion), data integrity

---

## 1. Quick Reality Scan

### What Was Inspected

**Core Dashboard Flows:**
- ✅ Login/Auth: `apps/web-ui/src/app/(dashboard)/auth/page.tsx`, `apps/api/src/middleware/fastify-auth.ts`
- ✅ Org/Team Selection: `apps/web-ui/src/app/(dashboard)/team/page.tsx`, `apps/api/src/routes/organizations.ts`
- ✅ GitHub Connection: `apps/web-ui/src/app/api/auth/github/route.ts`, `apps/api/src/routes/github.ts`
- ✅ Scan Results Display: `apps/web-ui/src/app/(dashboard)/runs/[id]/page.tsx`, `apps/web-ui/src/components/scans/ScanDashboard.tsx`
- ✅ Billing Display: `apps/web-ui/src/app/(dashboard)/billing/page.tsx`

**Data Model:**
- ✅ Schema: `prisma/schema.prisma` - Scans, Findings, Users, Orgs, Subscriptions, Webhooks
- ✅ Scan Ingestion: `apps/api/src/db/scans.ts`, `apps/api/src/db/transactions.ts`
- ✅ Relationships: User → Scans, Scans → Findings, User → Subscription

**API Contracts:**
- ✅ Scan endpoints: `apps/api/src/routes/scans.ts`, `apps/api/src/routes/runs.ts`
- ✅ Billing endpoints: `apps/api/src/routes/billing.ts`
- ✅ GitHub endpoints: `apps/api/src/routes/github.ts`
- ⚠️ Pagination: Present but inconsistent patterns
- ⚠️ Error handling: Present but not standardized

**Plan Gating:**
- ✅ Middleware exists: `apps/api/src/middleware/plan-gating.ts`
- ⚠️ Applied to: `license-keys.ts`, `intelligence.ts`, `exports.ts`, `fixes.ts`, `ship.ts`, `reality-check.ts`, `autopilot.ts`
- ❌ **MISSING FROM**: `scans.ts` (some endpoints), `runs.ts` (some endpoints), `findings.ts`, `dashboard.ts`, `projects.ts`

**GitHub Integration:**
- ✅ OAuth flow: `apps/api/src/routes/auth-fastify.ts`
- ✅ Webhook signature verification: `apps/api/src/routes/webhooks.ts:91-109`
- ✅ Idempotency tracking: `apps/api/src/routes/webhooks.ts:160-184` (GitHubWebhookEvent table)
- ⚠️ Retry logic: Basic error handling, no exponential backoff for failed webhook processing
- ⚠️ Scan ingestion: Uses queue but no explicit durability guarantees

**Stripe Integration:**
- ✅ Webhook signature verification: `apps/api/src/routes/billing-webhooks.ts:190-212`
- ✅ Event handling: `apps/api/src/routes/billing-webhooks.ts:250-351`
- ✅ Retry logic: `apps/api/src/services/webhook-processor.ts:38-85`
- ❌ **MISSING**: Subscription state reconciliation job (no scheduled job to sync Stripe → DB)
- ⚠️ Idempotency: No explicit idempotency keys for Stripe events (relies on Stripe event IDs)

**Security:**
- ✅ Auth middleware: `apps/api/src/middleware/fastify-auth.ts`
- ✅ Role enforcement: `apps/api/src/middleware/rbac.ts`, `apps/api/src/middleware/require-admin.ts`
- ⚠️ Audit logging: Exists (`apps/api/src/services/admin-service.ts:143-172`) but not comprehensive
- ❌ **MISSING**: Audit logs for billing changes, scan deletions, subscription cancellations

**UX Correctness:**
- ✅ Loading states: Present in billing, runs, settings pages
- ✅ Error handling: Present but inconsistent (some use toast, some use inline errors)
- ⚠️ Empty states: Present in some components (`RealityMap.tsx:26-45`) but missing in others
- ❌ **MISSING**: Empty states for: scans list, findings list (when no filters match), billing history
- ⚠️ Optimistic updates: Not consistently implemented
- ⚠️ Double-submit prevention: Not consistently implemented (e.g., upgrade buttons)

**Performance:**
- ⚠️ N+1 queries: Potential in scans list (checking subscription for each user)
- ✅ Indexes: Present on critical fields (user_id, status, createdAt)
- ⚠️ Client-side rendering: Some heavy computations (findings filtering) done client-side

**Observability:**
- ✅ Structured logging: `apps/api/src/logger.ts`
- ✅ Security events: `apps/api/src/services/security-event-service.ts`
- ⚠️ Audit trail: Admin actions logged, but not all sensitive actions (billing changes, scan deletions)

### Biggest Holes Identified

1. **P0 - Plan Gating Gaps**: Not all premium endpoints enforce plan gating (scans, runs, findings)
2. **P0 - Missing Subscription Reconciliation**: No scheduled job to sync Stripe subscription state → DB
3. **P0 - Stripe Webhook Idempotency**: No explicit idempotency keys (relies on event ID uniqueness)
4. **P1 - Missing Empty States**: Several list views lack empty state UI
5. **P1 - Inconsistent Error Handling**: Mix of toast notifications and inline errors
6. **P1 - Missing Audit Logs**: Billing changes, scan deletions not logged
7. **P2 - GitHub Webhook Retry**: No exponential backoff for failed webhook processing
8. **P2 - Double-Submit Prevention**: Missing on upgrade/cancel buttons
9. **P2 - N+1 Query Risk**: Potential in scans/runs list queries

---

## 2. Definition of Done: Dashboard v1 Polish Checklist

### Must-Have Criteria (P0)

- [ ] **No Broken Buttons**: All interactive elements work, no dead links, no "coming soon" buttons
- [ ] **Real Loading States**: Every async operation shows loading indicator
- [ ] **Real Error States**: Every error shows user-friendly message with recovery action
- [ ] **Real Empty States**: Every list/table shows empty state when no data
- [ ] **Data Integrity**: All displayed data is real, traceable to source-of-truth (scan IDs, timestamps)
- [ ] **Plan Gating Enforced**: All premium features gated at API level (not just UI)
- [ ] **AuthZ Correct**: Org/team/user scoping enforced everywhere
- [ ] **Billing Correct**: Subscription status reflects Stripe state (reconciliation job running)
- [ ] **Webhook Security**: All webhooks signature-verified and idempotent
- [ ] **Audit Trail**: Sensitive actions (billing changes, deletions, admin actions) logged

### Should-Have Criteria (P1)

- [ ] **Consistent UX Patterns**: Loading/error/empty states use consistent design
- [ ] **Optimistic Updates**: UI updates optimistically where safe (e.g., scan status)
- [ ] **Double-Submit Prevention**: Buttons disabled during async operations
- [ ] **Performance**: No N+1 queries, pagination works correctly
- [ ] **Observability**: Structured logs + audit events for all sensitive actions
- [ ] **Retry Strategy**: External API calls (GitHub, Stripe) have retry with backoff

### Nice-to-Have Criteria (P2)

- [ ] **Telemetry**: Feature usage metrics tracked
- [ ] **Accessibility**: Keyboard navigation, screen reader support
- [ ] **Performance Monitoring**: Slow endpoint detection

---

## 3. Ranked Punchlist (P0/P1/P2)

### P0 - Critical (Must Fix)

1. **Plan Gating Missing on Scans/Runs/Findings Endpoints**
   - Files: `apps/api/src/routes/scans.ts`, `apps/api/src/routes/runs.ts`, `apps/api/src/routes/findings.ts`
   - Impact: Free users can access premium features
   - Fix: Add `requirePlan` middleware to premium endpoints

2. **Missing Stripe Subscription Reconciliation Job**
   - Files: `apps/api/src/services/scheduled-jobs.ts` (create new), `apps/api/src/services/stripe-metered-billing.ts` (if exists)
   - Impact: DB subscription state can drift from Stripe
   - Fix: Scheduled job (hourly) to sync subscription status from Stripe

3. **Stripe Webhook Idempotency Not Explicit**
   - Files: `apps/api/src/routes/billing-webhooks.ts`
   - Impact: Duplicate webhook processing possible
   - Fix: Track processed event IDs in `BillingEvent` table, skip duplicates

4. **Missing Empty States in Key Views**
   - Files: `apps/web-ui/src/app/(dashboard)/runs/page.tsx`, `apps/web-ui/src/app/(dashboard)/findings/page.tsx`
   - Impact: Confusing UX when no data
   - Fix: Add empty state components

5. **Missing Audit Logs for Billing Changes**
   - Files: `apps/api/src/routes/billing.ts`, `apps/api/src/routes/billing-webhooks.ts`
   - Impact: No audit trail for subscription changes
   - Fix: Log all subscription status changes to `AdminAuditLog` or `SecurityEvent`

### P1 - High Priority (Should Fix)

6. **Inconsistent Error Handling Patterns**
   - Files: Multiple dashboard pages
   - Impact: Inconsistent UX
   - Fix: Standardize on toast notifications with inline error fallback

7. **GitHub Webhook Retry Logic Missing**
   - Files: `apps/api/src/routes/webhooks.ts`
   - Impact: Failed webhooks not retried
   - Fix: Add exponential backoff retry for failed webhook processing

8. **Double-Submit Prevention Missing**
   - Files: `apps/web-ui/src/app/(dashboard)/billing/page.tsx`
   - Impact: Multiple subscription charges possible
   - Fix: Disable buttons during async operations

9. **N+1 Query Risk in Scans List**
   - Files: `apps/api/src/routes/scans.ts`, `apps/api/src/routes/runs.ts`
   - Impact: Slow queries with many scans
   - Fix: Eager load user subscriptions in list queries

10. **Missing Empty State for Billing History**
    - Files: `apps/web-ui/src/app/(dashboard)/billing/page.tsx`
    - Impact: Confusing UX when no invoices
    - Fix: Add empty state component

### P2 - Medium Priority (Nice to Fix)

11. **Optimistic Updates Not Consistent**
    - Files: Multiple dashboard pages
    - Impact: Slower perceived performance
    - Fix: Add optimistic updates where safe

12. **Missing Feature Usage Telemetry**
    - Files: `apps/api/src/lib/feature-metrics.ts` (exists but not comprehensive)
    - Impact: No visibility into feature usage
    - Fix: Add telemetry for key actions (scan starts, upgrade clicks, etc.)

---

## 4. The 12 Tightening Changes (Ranked by Impact)

### Change 1: Add Plan Gating to Scans/Runs/Findings Endpoints (P0)
**Goal**: Prevent free users from accessing premium scan/run/finding features  
**Done Criteria**: All premium endpoints return 403 with upgrade message for free users  
**Files Changed**: 
- `apps/api/src/routes/scans.ts` - Add `requirePlan` to POST /scans, GET /scans/:id/explain
- `apps/api/src/routes/runs.ts` - Add `requirePlan` to premium run endpoints
- `apps/api/src/routes/findings.ts` - Add `requirePlan` to premium finding endpoints  
**Tests Added**: 
- `apps/api/src/routes/__tests__/scans.test.ts` - Test plan gating on premium endpoints
- `apps/api/src/routes/__tests__/runs.test.ts` - Test plan gating
**Telemetry/Audit**: Log plan gate blocks to `SecurityEvent` table

### Change 2: Implement Stripe Subscription Reconciliation Job (P0)
**Goal**: Keep DB subscription state in sync with Stripe  
**Done Criteria**: Hourly job syncs all active subscriptions from Stripe → DB  
**Files Changed**: 
- `apps/api/src/services/subscription-reconciliation.ts` (new) - Reconciliation logic
- `apps/api/src/services/scheduled-jobs.ts` - Add hourly reconciliation job
- `apps/api/src/worker.ts` - Register reconciliation job  
**Tests Added**: 
- `apps/api/src/services/__tests__/subscription-reconciliation.test.ts` - Test sync logic
**Telemetry/Audit**: Log reconciliation results (synced count, errors) to structured logs

### Change 3: Add Idempotency Keys to Stripe Webhooks (P0)
**Goal**: Prevent duplicate webhook processing  
**Done Criteria**: Stripe events processed only once, tracked in `BillingEvent` table  
**Files Changed**: 
- `apps/api/src/routes/billing-webhooks.ts` - Check `BillingEvent` for existing `stripeEventId` before processing
- `prisma/schema.prisma` - Ensure `BillingEvent.stripeEventId` is unique (already is)  
**Tests Added**: 
- `apps/api/src/routes/__tests__/billing-webhooks.test.ts` - Test idempotency (process same event twice)
**Telemetry/Audit**: Log duplicate event detection to structured logs

### Change 4: Add Empty States to Runs and Findings Pages (P0)
**Goal**: Clear UX when no data available  
**Done Criteria**: Runs and Findings pages show helpful empty state UI  
**Files Changed**: 
- `apps/web-ui/src/app/(dashboard)/runs/page.tsx` - Add empty state component
- `apps/web-ui/src/app/(dashboard)/findings/page.tsx` - Add empty state component
- `apps/web-ui/src/components/ui/empty-state.tsx` (new) - Reusable empty state component  
**Tests Added**: 
- `apps/web-ui/src/app/(dashboard)/runs/__tests__/page.test.tsx` - Test empty state rendering
**Telemetry/Audit**: None (UX only)

### Change 5: Add Audit Logs for Billing Changes (P0)
**Goal**: Complete audit trail for subscription changes  
**Done Criteria**: All subscription status changes logged to `AdminAuditLog`  
**Files Changed**: 
- `apps/api/src/routes/billing.ts` - Log subscription changes
- `apps/api/src/routes/billing-webhooks.ts` - Log webhook-processed changes
- `apps/api/src/services/admin-service.ts` - Use existing `logAdminAction`  
**Tests Added**: 
- `apps/api/src/routes/__tests__/billing.test.ts` - Test audit log creation
**Telemetry/Audit**: All changes logged to `AdminAuditLog` table

### Change 6: Standardize Error Handling with Toast + Inline Fallback (P1)
**Goal**: Consistent error UX across dashboard  
**Done Criteria**: All errors use toast notifications, with inline fallback for critical errors  
**Files Changed**: 
- `apps/web-ui/src/lib/api/index.ts` - Add error handling wrapper
- Multiple dashboard pages - Update error handling to use standard pattern  
**Tests Added**: 
- `apps/web-ui/src/lib/api/__tests__/error-handling.test.ts` - Test error handling
**Telemetry/Audit**: Log errors to client logger

### Change 7: Add Retry Logic to GitHub Webhook Processing (P1)
**Goal**: Retry failed webhook processing with exponential backoff  
**Done Criteria**: Failed webhook processing retried up to 3 times with exponential backoff  
**Files Changed**: 
- `apps/api/src/routes/webhooks.ts` - Add retry wrapper for webhook handlers
- `apps/api/src/lib/webhook-retry.ts` (new) - Retry utility with exponential backoff  
**Tests Added**: 
- `apps/api/src/routes/__tests__/webhooks.test.ts` - Test retry logic
**Telemetry/Audit**: Log retry attempts to structured logs

### Change 8: Add Double-Submit Prevention to Billing Actions (P1)
**Goal**: Prevent duplicate subscription charges  
**Done Criteria**: Upgrade/cancel buttons disabled during async operations  
**Files Changed**: 
- `apps/web-ui/src/app/(dashboard)/billing/page.tsx` - Add loading state to buttons, disable during operations  
**Tests Added**: 
- `apps/web-ui/src/app/(dashboard)/billing/__tests__/page.test.tsx` - Test button state
**Telemetry/Audit**: None (UX only)

### Change 9: Fix N+1 Queries in Scans/Runs List (P1)
**Goal**: Improve query performance  
**Done Criteria**: Scans/runs list queries eager load user subscriptions  
**Files Changed**: 
- `apps/api/src/routes/scans.ts` - Eager load user subscriptions in list query
- `apps/api/src/routes/runs.ts` - Eager load user subscriptions  
**Tests Added**: 
- `apps/api/src/routes/__tests__/scans.test.ts` - Test query performance
**Telemetry/Audit**: Log query execution time

### Change 10: Add Empty State for Billing History (P1)
**Goal**: Clear UX when no invoices  
**Done Criteria**: Billing history shows empty state when no invoices  
**Files Changed**: 
- `apps/web-ui/src/app/(dashboard)/billing/page.tsx` - Add empty state for billing history tab
- `apps/web-ui/src/components/ui/empty-state.tsx` - Reuse empty state component  
**Tests Added**: 
- `apps/web-ui/src/app/(dashboard)/billing/__tests__/page.test.tsx` - Test empty state
**Telemetry/Audit**: None (UX only)

### Change 11: Add Optimistic Updates to Scan Status (P2)
**Goal**: Improve perceived performance  
**Done Criteria**: Scan status updates optimistically in UI  
**Files Changed**: 
- `apps/web-ui/src/hooks/useScan.ts` - Add optimistic update logic
- `apps/web-ui/src/app/(dashboard)/runs/[id]/page.tsx` - Use optimistic updates  
**Tests Added**: 
- `apps/web-ui/src/hooks/__tests__/useScan.test.ts` - Test optimistic updates
**Telemetry/Audit**: None (UX only)

### Change 12: Add Feature Usage Telemetry (P2)
**Goal**: Track feature usage for product insights  
**Done Criteria**: Key actions (scan starts, upgrades, etc.) tracked to `Analytics` table  
**Files Changed**: 
- `apps/api/src/lib/feature-metrics.ts` - Add telemetry tracking
- Multiple routes - Add telemetry calls  
**Tests Added**: 
- `apps/api/src/lib/__tests__/feature-metrics.test.ts` - Test telemetry
**Telemetry/Audit**: Events logged to `Analytics` table

---

## 5. Code Diffs (PR-Ready)

[Implementation will be provided in separate files due to size]

---

## 6. Tests Added/Updated

### API Integration Tests

1. **Plan Gating Tests**
   - `apps/api/src/routes/__tests__/scans-plan-gating.test.ts` (new)
   - `apps/api/src/routes/__tests__/runs-plan-gating.test.ts` (new)
   - Tests: Free user gets 403 on premium endpoints, Pro user can access

2. **Webhook Idempotency Tests**
   - `apps/api/src/routes/__tests__/billing-webhooks.test.ts` (updated)
   - Tests: Processing same Stripe event twice only processes once

3. **Subscription Reconciliation Tests**
   - `apps/api/src/services/__tests__/subscription-reconciliation.test.ts` (new)
   - Tests: Reconciliation syncs Stripe → DB correctly

4. **GitHub Webhook Retry Tests**
   - `apps/api/src/routes/__tests__/webhooks.test.ts` (updated)
   - Tests: Failed webhook processing retries with backoff

### UI/E2E Tests

5. **Empty State Tests**
   - `apps/web-ui/src/app/(dashboard)/runs/__tests__/page.test.tsx` (new)
   - `apps/web-ui/src/app/(dashboard)/findings/__tests__/page.test.tsx` (new)
   - Tests: Empty states render correctly

6. **Double-Submit Prevention Tests**
   - `apps/web-ui/src/app/(dashboard)/billing/__tests__/page.test.tsx` (updated)
   - Tests: Buttons disabled during async operations

### E2E Flow Tests

7. **Core Flow: Login → Connect GitHub → Trigger Scan → View Results → Billing Status**
   - `e2e/dashboard-core-flow.test.ts` (new)
   - Tests: Complete user journey works end-to-end

---

## 7. Verification Steps + Expected Output

### Pre-Deployment Checks

```bash
# 1. Lint/Typecheck
pnpm run lint
# Expected: No errors

pnpm run typecheck
# Expected: No type errors

# 2. Unit Tests
pnpm run test
# Expected: All tests pass (including new tests)

# 3. API Integration Tests
cd apps/api && pnpm run test:integration
# Expected: All integration tests pass

# 4. E2E Tests
cd e2e && pnpm run test
# Expected: All e2e tests pass (including dashboard-core-flow.test.ts)
```

### Post-Deployment Verification

```bash
# 1. Test Plan Gating
curl -H "Authorization: Bearer <free-user-token>" \
  https://api.example.com/api/scans \
  -X POST -d '{"repositoryId": "test"}'
# Expected: 403 {"error": "Plan upgrade required", "code": "PLAN_UPGRADE_REQUIRED"}

# 2. Test Stripe Webhook Idempotency
# Send same Stripe event twice
curl -X POST https://api.example.com/api/billing/webhook \
  -H "stripe-signature: <sig>" \
  -d '<stripe-event>'
# Send again
curl -X POST https://api.example.com/api/billing/webhook \
  -H "stripe-signature: <sig>" \
  -d '<stripe-event>'
# Expected: Second request processes quickly (skipped as duplicate)

# 3. Test Subscription Reconciliation
# Manually trigger reconciliation job
curl -X POST https://api.example.com/api/admin/jobs/reconcile-subscriptions \
  -H "Authorization: Bearer <admin-token>"
# Expected: Job runs, logs show synced subscriptions

# 4. Test Empty States
# Visit /dashboard/runs with no runs
# Expected: Shows empty state UI with "Start your first scan" message

# 5. Test Audit Logs
# Make a subscription change (upgrade/downgrade)
# Query AdminAuditLog table
# Expected: Entry exists with action="subscription_updated"
```

---

## 8. Rollout Notes + Rollback + Release Notes Draft

### Rollout Plan

**Phase 1: Internal Testing (Day 1)**
- Deploy to staging environment
- Run full test suite
- Manual QA of all 12 changes

**Phase 2: Gradual Rollout (Day 2-3)**
- Deploy to production
- Monitor error rates, webhook processing times
- Watch for subscription reconciliation job success rate

**Phase 3: Full Rollout (Day 4)**
- All changes live
- Monitor for 24 hours
- Collect user feedback

### Rollback Plan

**If Issues Detected:**

1. **Plan Gating Issues**: Revert plan gating middleware (allows free users access temporarily)
   ```bash
   git revert <plan-gating-commit>
   ```

2. **Webhook Issues**: Disable new webhook processing, fall back to old logic
   ```bash
   # Set feature flag
   export DISABLE_NEW_WEBHOOK_PROCESSING=true
   ```

3. **Reconciliation Job Issues**: Disable reconciliation job
   ```bash
   # Disable in worker.ts
   ```

4. **Full Rollback**: Revert entire deployment
   ```bash
   git revert <deployment-commit>
   ```

### Release Notes Draft

```markdown
# Dashboard v1 Polish Release

## Improvements

### Security & Reliability
- ✅ Plan gating now enforced on all premium features (scans, runs, findings)
- ✅ Stripe subscription state automatically synchronized with database
- ✅ Webhook processing now idempotent (prevents duplicate processing)

### User Experience
- ✅ Added empty states to runs and findings pages
- ✅ Standardized error handling across dashboard
- ✅ Prevented duplicate subscription charges (double-submit protection)

### Performance
- ✅ Optimized database queries (fixed N+1 queries in scans list)
- ✅ Added retry logic for GitHub webhook processing

### Observability
- ✅ Added audit logs for all billing changes
- ✅ Improved structured logging for webhook processing

## Breaking Changes

None - all changes are backward compatible.

## Migration Notes

No migration required. Subscription reconciliation job will automatically sync existing subscriptions.
```

---

## Appendix: Dashboard Scope Statement

**The dashboard exists to:**
1. Show scan history + receipts (runs, scans, findings)
2. Manage team/org + integrations (GitHub, settings)
3. Manage billing (subscriptions, invoices, usage)

**Out of Scope (for this hardening pass):**
- New product features
- Advanced analytics
- Custom reports
- Integration with new services (beyond GitHub + Stripe)

**Scope Violations Identified:**
- Some pages include "coming soon" features (acceptable if clearly marked)
- Some advanced features may be partially implemented (acceptable if gated)

---

**End of Report**
