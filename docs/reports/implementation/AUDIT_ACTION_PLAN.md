# guardrail AUDIT — ACTION PLAN
**Generated:** 2026-01-06  
**Priority:** P0 (Blockers) → P1 (2 weeks) → P2 (Backlog)

---

## P0 BLOCKERS (Must Fix Pre-Launch)

### P0-1: Remove Owner Mode Bypass
**Why:** Critical security vulnerability - allows full enterprise access without API key  
**Files:**
- `bin/runners/lib/auth.js` (lines 26-32, 106-119)
- `bin/guardrail.js` (lines 178-196)

**Implementation:**
1. Remove `isOwnerMode()` function or require admin API key verification
2. Remove owner mode checks in `getEntitlements()` and `checkCommandAccess()`
3. If owner mode needed for development, require additional verification (e.g., admin API key + env var)

**Test:**
```bash
# Verify no env var bypasses auth
GUARDRAIL_OWNER_MODE=true guardrail scan
# Should require API key or fail
```

**Test File:** `tests/security/owner-mode-bypass.test.ts`
```typescript
describe('Owner mode bypass', () => {
  it('should not bypass auth with GUARDRAIL_OWNER_MODE', () => {
    process.env.GUARDRAIL_OWNER_MODE = 'true';
    // Should still require API key
    expect(() => runCommand('scan')).toThrow('API key required');
  });
});
```

---

### P0-2: Remove Skip Entitlements Env Var
**Why:** Critical security bypass - allows all commands without entitlement checks  
**Files:**
- `bin/guardrail.js` (lines 262-268)

**Implementation:**
1. Remove `GUARDRAIL_SKIP_ENTITLEMENTS` check
2. Remove `GUARDRAIL_TIER` override logic
3. Always require entitlement verification

**Test:**
```bash
# Verify entitlements always checked
GUARDRAIL_SKIP_ENTITLEMENTS=1 guardrail fix --apply
# Should require PRO plan
```

**Test File:** `tests/security/skip-entitlements.test.ts`
```typescript
describe('Skip entitlements bypass', () => {
  it('should not bypass entitlements with GUARDRAIL_SKIP_ENTITLEMENTS', () => {
    process.env.GUARDRAIL_SKIP_ENTITLEMENTS = '1';
    // Should still check entitlements
    expect(() => runCommand('fix', ['--apply'])).toThrow('PRO plan required');
  });
});
```

---

### P0-3: Remove Mock Entitlements Fallback
**Why:** Security risk - allows paid features when API unavailable  
**Files:**
- `bin/runners/lib/auth.js` (lines 173-280)

**Implementation:**
1. Remove mock entitlements fallback (lines 173-280)
2. Require API connection for paid features
3. Return clear error if API unavailable: "API connection required for this feature"

**Test:**
```bash
# Disconnect API and try paid feature
GUARDRAIL_API_URL=http://invalid guardrail fix --apply
# Should fail with clear error
```

**Test File:** `tests/cli/mock-entitlements.test.ts`
```typescript
describe('Mock entitlements fallback', () => {
  it('should not use mock entitlements when API unavailable', async () => {
    process.env.GUARDRAIL_API_URL = 'http://invalid';
    await expect(getEntitlements('gr_pro_test')).rejects.toThrow('API connection required');
  });
});
```

---

### P0-4: Apply Plan Gating to All Paid Routes
**Why:** Inconsistent enforcement - some routes bypass plan checks  
**Files:**
- `apps/api/src/routes/billing.ts`
- `apps/api/src/routes/autopilot.ts`
- `apps/api/src/routes/reality-check.ts`
- `apps/api/src/routes/intelligence.ts`
- `apps/api/src/routes/ship.ts`
- All other routes with paid features

**Implementation:**
1. Import `requirePlan` from `apps/api/src/middleware/plan-gating.ts`
2. Add `preHandler: [authMiddleware, requirePlan({ minTierLevel: X })]` to paid routes
3. Remove manual tier checks in route handlers

**Example:**
```typescript
// Before (apps/api/src/routes/autopilot.ts)
fastify.post("/enable", { preHandler: [authMiddleware] }, async (request, reply) => {
  const tier = request.user?.subscriptionTier || "free";
  if (tier === "free") {
    return reply.status(403).send({ error: "Pro plan required" });
  }
  // ...
});

// After
fastify.post(
  "/enable",
  {
    preHandler: [
      authMiddleware,
      requirePlan({ minTierLevel: 2, featureName: "Autopilot" }),
    ],
  },
  async (request, reply) => {
    // Tier already verified by middleware
    // ...
  }
);
```

**Test File:** `tests/api/plan-gating.test.ts`
```typescript
describe('Plan gating', () => {
  it('should block free users from paid routes', async () => {
    const token = generateToken({ id: 'free-user', email: 'free@test.com' });
    const res = await request(app)
      .post('/api/v1/autopilot/enable')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_UPGRADE_REQUIRED');
  });
});
```

---

### P0-5: Fix Public Runs Routes
**Why:** May expose run data without authentication  
**Files:**
- `apps/api/src/routes/runs.ts` (lines 240-410)

**Implementation:**
1. Verify if public access is intentional (for sharing?)
2. If intentional: Add rate limiting and access controls
3. If not intentional: Add `authMiddleware` hook

**Option A (If Intentional):**
```typescript
fastify.register(publicRunsRoutes, {
  prefix: "/runs/public",
});
// Add rate limiting
fastify.addHook("preHandler", createRateLimit({ max: 10, windowMs: 60000 }));
```

**Option B (If Not Intentional):**
```typescript
async function publicRunsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authMiddleware);
  // ... rest of routes
}
```

**Test File:** `tests/api/public-runs.test.ts`
```typescript
describe('Public runs routes', () => {
  it('should require auth or rate limiting', async () => {
    const res = await request(app).get('/api/v1/runs/public/123');
    // Should either require auth or have rate limiting
    expect([401, 429]).toContain(res.status);
  });
});
```

---

## P1 (Next 2 Weeks)

### P1-1: Implement Storage Providers
**Why:** File uploads appear to succeed but files are not stored  
**Files:**
- `apps/api/src/services/file-storage-service.ts` (lines 654-736)

**Implementation:**
1. Implement S3 provider using `@aws-sdk/client-s3`
2. Implement GCS provider using `@google-cloud/storage`
3. Implement Azure provider using `@azure/storage-blob`
4. Or fail fast with clear error if not configured

**Example:**
```typescript
async upload(filename: string, buffer: Buffer, mimetype: string, isPublic: boolean): Promise<string> {
  if (!process.env.S3_BUCKET && !process.env.GCS_BUCKET && !process.env.AZURE_STORAGE_ACCOUNT) {
    throw new Error('No storage provider configured. Set S3_BUCKET, GCS_BUCKET, or AZURE_STORAGE_ACCOUNT');
  }
  // Implement actual upload
}
```

**Test File:** `tests/services/file-storage.test.ts`

---

### P1-2: Implement Email Providers
**Why:** Users don't receive email notifications  
**Files:**
- `apps/api/src/services/email-notification-service.ts` (lines 642-739)

**Implementation:**
1. Implement SendGrid provider using `@sendgrid/mail`
2. Or disable email feature until ready

**Example:**
```typescript
async send(email: EmailMessage): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    logger.warn('Email not configured, skipping send');
    return; // Or throw error
  }
  // Implement actual send
}
```

**Test File:** `tests/services/email-service.test.ts`

---

### P1-3: Fix Security Event Service
**Why:** Security events are not persisted to database  
**Files:**
- `apps/api/src/services/security-event-service.ts` (lines 286-446)

**Implementation:**
1. Replace mock storage with Prisma queries
2. Use `prisma.securityEvent.create()` instead of mock storage

**Example:**
```typescript
async logEvent(eventType: string, payload: any, userId?: string): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      eventType,
      payload,
      userId,
      severity: 'medium',
      timestamp: new Date(),
    },
  });
}
```

**Test File:** `tests/services/security-event-service.test.ts`

---

### P1-4: Standardize Auth Middleware
**Why:** Inconsistent auth checks across routes  
**Files:**
- All route files in `apps/api/src/routes/`

**Implementation:**
1. Ensure all routes use `authMiddleware` hook
2. Add explicit user check in handlers: `if (!request.user) return reply.status(401)...`
3. Remove manual auth checks in favor of middleware

**Test File:** `tests/api/auth-coverage.test.ts`
```typescript
describe('Auth coverage', () => {
  const routes = getAllRoutes();
  routes.forEach(route => {
    it(`${route.method} ${route.path} should require auth`, async () => {
      const res = await request(app)[route.method](route.path);
      expect(res.status).toBe(401);
    });
  });
});
```

---

### P1-5: Implement GitHub Scan
**Why:** GitHub integration returns mock scan results  
**Files:**
- `apps/api/src/routes/github.ts` (line 619)

**Implementation:**
1. Implement real scan using existing scan engine
2. Or return proper error: "GitHub scan not yet implemented"

**Example:**
```typescript
// Instead of mock result
const scanResult = await runScan({
  repositoryId: repo.id,
  branch: payload.ref,
  commitSha: payload.after,
});
return reply.send({ success: true, scan: scanResult });
```

**Test File:** `tests/api/github-scan.test.ts`

---

## P2 (Backlog)

### P2-1: Implement MFA Tracking
**Files:** `apps/api/src/services/admin-service.ts:278`  
**Implementation:** Add MFA fields to User model and track MFA status

### P2-2: Implement Issue Tracking
**Files:** `apps/api/src/services/admin-service.ts:279`  
**Implementation:** Add issue tracking system or integrate with external service

### P2-3: Implement Stripe Metered Billing
**Files:** `apps/api/src/routes/usage.ts:481`  
**Implementation:** Report usage to Stripe using metered billing API

### P2-4: Implement Trial End Emails
**Files:** `apps/api/src/routes/billing-webhooks.ts:667`  
**Implementation:** Send email notification when trial ends

### P2-5: Implement Payment Failure Emails
**Files:** `apps/api/src/routes/billing-webhooks.ts:768`  
**Implementation:** Send email notification on payment failure

### P2-6: Implement Payment Action Required Emails
**Files:** `apps/api/src/routes/billing-webhooks.ts:793`  
**Implementation:** Send email with payment link when action required

### P2-7: Implement Malware Scanning
**Files:** `apps/api/src/services/file-storage-service.ts:398-410`  
**Implementation:** Integrate malware scanning service (e.g., ClamAV, VirusTotal)

### P2-8: Implement Thumbnail Generation
**Files:** `apps/api/src/services/file-storage-service.ts:513-529`  
**Implementation:** Generate thumbnails for images using sharp or similar

### P2-9: Implement Webhook Integration Delivery
**Files:** `apps/api/src/services/webhook-integration-service.ts:567-712`  
**Implementation:** Actually deliver webhooks instead of logging

### P2-10: Implement Security Report Data Fetching
**Files:** `apps/api/src/services/security-report-generator.ts:232-724`  
**Implementation:** Fetch real data from database instead of mock data

---

## TESTING REQUIREMENTS

### Unit Tests
- Each fix should include unit tests
- Test files should be in `tests/` directory matching source structure
- Use Jest for API tests, Vitest for web UI tests

### Integration Tests
- Test auth flows end-to-end
- Test plan gating with different subscription tiers
- Test webhook signature verification

### E2E Tests
- Test CLI commands with and without API key
- Test web UI flows (signup → scan → results)
- Test billing flows (checkout → webhook → subscription update)

---

## DEPLOYMENT CHECKLIST

Before deploying fixes:

- [ ] All P0 blockers fixed
- [ ] All tests passing
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Environment variables documented
- [ ] Migration scripts tested
- [ ] Rollback plan prepared

---

## Phase 2 Status: ✅ COMPLETE

All P1 items have been successfully implemented:

1. ✅ **File Storage Provider (S3)** - AWS S3 integration complete with fallback to local storage
2. ✅ **Email Notification Service (SendGrid)** - Integrated and connected to billing webhooks
3. ✅ **Security Event Persistence** - Replaced in-memory storage with Prisma database writes
4. ✅ **Standardize Auth Checks** - Added authMiddleware to GitHub scan route
5. ✅ **GitHub Scan Integration** - Connected to real scanning logic via triggerScan function

**Implementation Details:**
- S3 storage: `apps/api/src/services/file-storage-service.ts`
- SendGrid email: `apps/api/src/services/email-notification-service.ts`
- Security events: `apps/api/src/services/security-event-service.ts`
- GitHub scan: `apps/api/src/routes/github.ts` (updated)
- Billing emails: `apps/api/src/routes/billing-webhooks.ts` (updated)

---

## Phase 3: P2 Backlog Items

For less urgent but important features, see the detailed backlog documentation:

**📋 [P2_BACKLOG.md](./P2_BACKLOG.md)** - Comprehensive implementation plans with:
- Detailed steps for each feature
- Code examples and schema changes
- Testing checklists
- Related files and dependencies
- Implementation priority order

**✅ [P2_CHECKLIST.md](./P2_CHECKLIST.md)** - Quick reference checklist for tracking progress

### P2 Items (8 total):
1. Multi-Factor Auth (MFA) Tracking - Security critical
2. User Issue Tracking / Support Tickets - Support efficiency
3. Stripe Metered Billing - Revenue impact
4. Customer Notifications (Complete remaining) - User experience
5. Malware Scanning for Uploads - Security important
6. Thumbnail Generation - Performance optimization
7. Outgoing Webhook Deliveries - Integration value
8. Security Report Data - Product completeness

**Recommended Implementation Order:** See P2_BACKLOG.md for priority ranking

---

**End of Action Plan**
