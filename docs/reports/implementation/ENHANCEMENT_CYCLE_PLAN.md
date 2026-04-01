# guardrail Enhancement Cycle Plan
## High-Output Mode: 2 Cycles × 10 Improvements

**Date**: 2026-01-05  
**Engineer**: Product Engineering + UX + Systems Architecture  
**Mode**: HIGH-OUTPUT (10 improvements per cycle, 2 cycles)

---

## 1. Quick Reality Scan

### What Was Inspected

**Core Workflows**:
- ✅ Authentication flow (OAuth + JWT) - Working
- ✅ Scan submission → Queue → Worker → Results - Working with BullMQ
- ✅ Billing checkout → Stripe → Webhook handling - Partially complete
- ✅ Dashboard → Scan results → Findings display - Working
- ✅ GitHub integration → Repository selection → Scan - Working

**Auth + Permissions**:
- ✅ JWT-based auth middleware - Working
- ✅ Tier-based feature gating - Partially hardcoded (needs improvement)
- ✅ API key authentication - Working
- ⚠️ Offline mode entitlement - Needs hardening (free-tier-only enforcement)

**Data Model Integrity**:
- ✅ Prisma schema comprehensive (Users, Scans, Findings, Subscriptions, etc.)
- ✅ Indexes present on hot queries
- ✅ Foreign key constraints in place
- ⚠️ Some nullable fields could use better defaults

**UX State Correctness**:
- ✅ Loading states in dashboard
- ✅ Error boundaries in React components
- ⚠️ Empty states could be more helpful
- ⚠️ Success confirmations inconsistent
- ⚠️ Form validation needs improvement

**Performance**:
- ✅ BullMQ job queue for async processing
- ✅ Redis rate limiting
- ⚠️ Incremental scan caching not fully implemented
- ⚠️ N+1 queries possible in some list endpoints
- ⚠️ Large scan results could benefit from pagination

**Operational Reliability**:
- ✅ Health check endpoints
- ✅ Graceful shutdown handling
- ✅ Structured logging with correlation IDs
- ⚠️ Scheduled scans exist in schema but automation incomplete
- ⚠️ Notification automation triggers missing
- ⚠️ Webhook retry logic needs improvement

### Biggest Risks & Holes (Ranked)

1. **P0: Billing Webhook Verification Incomplete** - Risk of subscription sync failures
2. **P0: Scheduled Scans Not Automated** - Schema exists but no cron/worker
3. **P0: Feature Gating Hardcoded** - Some routes bypass tier checks
4. **P1: Missing Social Proof on Landing** - Conversion friction
5. **P1: No Demo/Playground** - Trial barrier
6. **P1: Notification Automation Missing** - Users don't get alerts
7. **P1: Incremental Scan Cache Not Used** - Performance waste
8. **P2: Empty States Not Helpful** - UX friction
9. **P2: Form Validation Inconsistent** - Data quality issues
10. **P2: WebSocket Real-Time Updates Incomplete** - Perceived performance

---

## 2. Top 10 Enhancements - Cycle 1 (Critical + Leverage)

### Feature Improvements (4)

#### 1. Complete Stripe Webhook Verification & Idempotency
**Goal**: Ensure all Stripe webhooks are verified, idempotent, and properly sync subscription state  
**User Value**: Prevents billing issues, ensures users get correct tier access  
**Effort**: Medium (2-3 days)  
**Risk**: Medium (touches billing - critical path)  
**Dependencies**: Stripe webhook secret, database transactions  
**Done Criteria**:
- All webhook handlers verify signature
- Idempotency keys prevent duplicate processing
- Subscription state always matches Stripe
- Tests cover all webhook event types
- Rollback plan for failed webhooks

**Telemetry**: `billing.webhook.received`, `billing.webhook.verified`, `billing.webhook.processed`, `billing.webhook.failed`

#### 2. Automated Scheduled Scans with Cron Worker
**Goal**: Enable users to schedule scans (daily/weekly) that run automatically  
**User Value**: Set-and-forget security monitoring  
**Effort**: Medium (2-3 days)  
**Risk**: Low (new feature, doesn't break existing)  
**Dependencies**: Cron library, worker process, ScheduledScan model  
**Done Criteria**:
- Users can create/edit/delete scheduled scans via API
- Worker process runs scheduled scans on time
- Notifications sent on completion/failure
- UI for managing scheduled scans
- Tests for cron execution

**Telemetry**: `scan.scheduled.created`, `scan.scheduled.triggered`, `scan.scheduled.completed`, `scan.scheduled.failed`

#### 3. Real-Time Scan Progress via WebSocket
**Goal**: Show live scan progress in dashboard without polling  
**User Value**: Better UX, instant feedback  
**Effort**: Medium (2 days)  
**Risk**: Low (additive feature)  
**Dependencies**: WebSocket plugin (exists), worker progress updates  
**Done Criteria**:
- Worker emits progress events to WebSocket
- Dashboard subscribes and shows live progress
- Handles reconnection gracefully
- Fallback to polling if WebSocket fails
- Tests for WebSocket connection lifecycle

**Telemetry**: `websocket.connected`, `websocket.disconnected`, `websocket.progress.sent`, `websocket.error`

#### 4. Incremental Scan Caching System
**Goal**: Only scan changed files, cache results for unchanged code  
**User Value**: 3-5x faster scans on unchanged code  
**Effort**: High (3-4 days)  
**Risk**: Medium (cache invalidation complexity)  
**Dependencies**: File hash tracking, cache storage (Redis)  
**Done Criteria**:
- File hashes stored per scan
- Only changed files rescanned
- Cache hit rate >50% on typical repos
- Cache invalidation on git commits
- Performance benchmarks show 3x+ improvement

**Telemetry**: `scan.cache.hit`, `scan.cache.miss`, `scan.cache.invalidated`, `scan.duration.cached`, `scan.duration.full`

### UX Improvements (2)

#### 5. Helpful Empty States with Clear CTAs
**Goal**: Every empty state tells users what to do next  
**User Value**: Reduces confusion, increases activation  
**Effort**: Low (1 day)  
**Risk**: Low (UI only)  
**Dependencies**: None  
**Done Criteria**:
- Empty states on: no scans, no findings, no repos, no projects
- Each includes: icon, message, primary CTA, secondary action
- Consistent design pattern
- Accessibility (keyboard nav, screen readers)
- A/B test shows improved activation

**Telemetry**: `empty_state.viewed`, `empty_state.cta_clicked`, `empty_state.secondary_clicked`

#### 6. Inline Form Validation with Human-Readable Messages
**Goal**: Validate forms as users type, show clear error messages  
**User Value**: Prevents submission errors, faster feedback  
**Effort**: Medium (2 days)  
**Risk**: Low (frontend only)  
**Dependencies**: Zod schemas (already exist)  
**Done Criteria**:
- Real-time validation on blur/change
- Error messages are human-readable (not "z.string.min")
- Success states shown (green checkmarks)
- Accessibility (aria-invalid, aria-describedby)
- All forms: scan config, billing, settings, scheduled scans

**Telemetry**: `form.validation.error`, `form.validation.success`, `form.submission.attempted`, `form.submission.success`

### Automation Improvements (2)

#### 7. Automated Notification System for Scan Events
**Goal**: Send email/Slack/webhook notifications on scan completion, failures, critical findings  
**User Value**: Users stay informed without checking dashboard  
**Effort**: Medium (2-3 days)  
**Risk**: Low (background job)  
**Dependencies**: Email service (exists), webhook service (exists), notification preferences  
**Done Criteria**:
- Notifications sent on: scan complete, scan failed, critical finding detected
- Users can configure: email, Slack, webhook, frequency
- Notification preferences UI
- Rate limiting to prevent spam
- Tests for all notification types

**Telemetry**: `notification.sent`, `notification.failed`, `notification.preference.updated`, `notification.rate_limited`

#### 8. Automated Onboarding Email Sequence
**Goal**: Send welcome emails, tips, and check-ins to new users  
**User Value**: Better activation, feature discovery  
**Effort**: Low (1-2 days)  
**Risk**: Low (email only)  
**Dependencies**: Email service, user onboarding tracking  
**Done Criteria**:
- Welcome email on signup
- Day 1: "Run your first scan" email
- Day 3: "Connect GitHub" email (if not connected)
- Day 7: "Explore features" email
- Unsubscribe link in all emails
- Tests for email delivery

**Telemetry**: `onboarding.email.sent`, `onboarding.email.opened`, `onboarding.email.clicked`, `onboarding.email.unsubscribed`

### Capability Expansions (2)

#### 9. Public API with API Key Management UI
**Goal**: Expose core functionality via REST API for integrations  
**User Value**: Enables CI/CD integrations, third-party tools  
**Effort**: High (3-4 days)  
**Risk**: Medium (security surface area)  
**Dependencies**: API key model (exists), rate limiting, auth middleware  
**Done Criteria**:
- REST API endpoints: `/api/v1/scans`, `/api/v1/findings`, `/api/v1/projects`
- API key creation/revocation UI
- Rate limiting per key
- API documentation (OpenAPI/Swagger)
- Tests for all endpoints

**Telemetry**: `api.request`, `api.key.created`, `api.key.revoked`, `api.rate_limited`, `api.error`

#### 10. GitHub App Integration for PR Comments
**Goal**: Automatically comment on PRs with scan results  
**User Value**: Scan results visible in PR workflow  
**Effort**: High (3-4 days)  
**Risk**: Medium (GitHub API rate limits)  
**Dependencies**: GitHub App (exists), webhook handling, PR comment logic  
**Done Criteria**:
- GitHub App comments on PRs with scan results
- Configurable: always comment, only on failures, summary format
- Handles PR updates (edit existing comment)
- Rate limiting to respect GitHub limits
- Tests for comment creation/updates

**Telemetry**: `github.pr.comment.created`, `github.pr.comment.updated`, `github.pr.comment.failed`, `github.rate_limited`

---

## 3. Top 10 Enhancements - Cycle 2 (Polish + Expansion)

### Feature Improvements (4)

#### 11. Advanced Finding Filters & Search
**Goal**: Powerful filtering and search for findings across scans  
**User Value**: Find specific issues quickly  
**Effort**: Medium (2 days)  
**Risk**: Low  
**Dependencies**: Database indexes  
**Done Criteria**:
- Filters: severity, type, file, date range, status
- Full-text search on title/message
- Saved filter presets
- Export filtered results
- Performance: <200ms for 10k findings

**Telemetry**: `findings.filter.applied`, `findings.search.executed`, `findings.export.requested`

#### 12. Scan Comparison & Diff View
**Goal**: Compare two scans to see what changed  
**User Value**: Track progress, see what was fixed  
**Effort**: High (3 days)  
**Risk**: Low  
**Dependencies**: Scan history  
**Done Criteria**:
- Select two scans to compare
- Show: new findings, resolved findings, unchanged
- Diff view with code snippets
- Export comparison report
- UI for scan selection

**Telemetry**: `scan.comparison.created`, `scan.comparison.exported`

#### 13. Bulk Finding Actions (Acknowledge, Resolve, False Positive)
**Goal**: Mark multiple findings as acknowledged/resolved/false positive at once  
**User Value**: Faster workflow for large scan results  
**Effort**: Low (1 day)  
**Risk**: Low  
**Dependencies**: Finding status updates  
**Done Criteria**:
- Select multiple findings
- Bulk actions: acknowledge, resolve, mark false positive
- Confirmation dialog
- Audit log for bulk actions
- Undo capability (last 5 minutes)

**Telemetry**: `findings.bulk.action`, `findings.bulk.undo`

#### 14. Custom Scan Profiles & Templates
**Goal**: Save and reuse scan configurations  
**User Value**: Faster setup, consistency  
**Effort**: Medium (2 days)  
**Risk**: Low  
**Dependencies**: Scan config storage  
**Done Criteria**:
- Create/edit/delete scan profiles
- Profiles include: checks enabled, severity thresholds, paths to ignore
- Apply profile to new scan
- Share profiles with team (if org)
- Default profiles: "Quick", "Full", "Security Only"

**Telemetry**: `scan.profile.created`, `scan.profile.applied`, `scan.profile.shared`

### UX Improvements (2)

#### 15. Interactive Landing Page Demo/Playground
**Goal**: Let visitors try guardrail without signing up  
**User Value**: Reduces trial friction, increases conversion  
**Effort**: High (3-4 days)  
**Risk**: Medium (performance, abuse)  
**Dependencies**: Demo repo, rate limiting  
**Done Criteria**:
- Interactive CLI simulator in browser
- Sample repo with known issues
- Run scan and see results
- "Sign up to scan your repo" CTA
- Rate limited to prevent abuse

**Telemetry**: `demo.scan.started`, `demo.scan.completed`, `demo.signup.clicked`

#### 16. Social Proof on Landing Page
**Goal**: Add testimonials, logos, usage stats to build trust  
**User Value**: Increases conversion, reduces bounce  
**Effort**: Low (1 day)  
**Risk**: Low  
**Dependencies**: Testimonial content, logos  
**Done Criteria**:
- Testimonials section with photos/quotes
- Company logos (even if early stage: "Used by teams at...")
- GitHub stars badge (real-time)
- "Trusted by X developers" counter
- Usage stats: scans run, issues found

**Telemetry**: `landing.testimonial.viewed`, `landing.logo.clicked`, `landing.stats.viewed`

### Automation Improvements (2)

#### 17. Automated Weekly Digest Emails
**Goal**: Send weekly summary of scan activity, findings, trends  
**User Value**: Stay informed without daily checks  
**Effort**: Medium (2 days)  
**Risk**: Low  
**Dependencies**: Email service, analytics aggregation  
**Done Criteria**:
- Weekly email with: scans run, findings summary, trends
- Sent Monday mornings
- Opt-out link
- Personalization based on activity
- Tests for email generation

**Telemetry**: `digest.email.sent`, `digest.email.opened`, `digest.email.clicked`

#### 18. Self-Healing Job Queue with Stuck Job Detection
**Goal**: Automatically detect and retry stuck/failed jobs  
**User Value**: Better reliability, less manual intervention  
**Effort**: Medium (2 days)  
**Risk**: Medium (could cause duplicate jobs)  
**Dependencies**: BullMQ, job monitoring  
**Done Criteria**:
- Detect jobs stuck >30 minutes
- Auto-retry with exponential backoff
- Dead-letter queue for permanently failed jobs
- Alert ops team on repeated failures
- Tests for stuck job detection

**Telemetry**: `job.stuck.detected`, `job.auto_retried`, `job.dead_lettered`

### Capability Expansions (2)

#### 19. Slack Integration for Notifications
**Goal**: Send scan notifications to Slack channels  
**User Value**: Team collaboration, real-time alerts  
**Effort**: Medium (2 days)  
**Risk**: Low  
**Dependencies**: Slack API, webhook service  
**Done Criteria**:
- Connect Slack workspace
- Configure channels for notifications
- Rich Slack messages with scan results
- Interactive buttons (acknowledge, view details)
- Tests for Slack webhook delivery

**Telemetry**: `slack.workspace.connected`, `slack.notification.sent`, `slack.button.clicked`

#### 20. SARIF Export & GitHub Code Scanning Integration
**Goal**: Export findings as SARIF for GitHub Code Scanning  
**User Value**: Native GitHub integration, security tab visibility  
**Effort**: Medium (2-3 days)  
**Risk**: Low  
**Dependencies**: SARIF format, GitHub API  
**Done Criteria**:
- Export scan results as SARIF 2.1.0
- Upload to GitHub Code Scanning via API
- Show in GitHub Security tab
- Configurable: which findings to include
- Tests for SARIF generation

**Telemetry**: `sarif.exported`, `sarif.github.uploaded`, `sarif.github.failed`

---

## 4. Implementation Plan - Cycle 1

### File-Level Changes

**Billing Webhook Verification**:
- `apps/api/src/routes/billing-webhooks.ts` - Add signature verification, idempotency
- `apps/api/src/services/billing-service.ts` - Improve subscription sync
- `apps/api/src/db/transactions.ts` - Add idempotency key tracking
- Tests: `apps/api/src/routes/__tests__/billing-webhooks.test.ts`

**Scheduled Scans**:
- `apps/api/src/routes/scheduled-scans.ts` - CRUD endpoints (new)
- `apps/api/src/services/scheduled-scan-service.ts` - Cron execution (new)
- `apps/api/src/worker.ts` - Add scheduled scan job handler
- `apps/web-ui/src/app/(dashboard)/scheduled-scans/page.tsx` - UI (new)
- Tests: `apps/api/src/services/__tests__/scheduled-scan-service.test.ts`

**WebSocket Real-Time Progress**:
- `apps/api/src/plugins/websocket.ts` - Emit progress events
- `apps/api/src/worker.ts` - Send progress to WebSocket
- `apps/web-ui/src/hooks/use-scan-progress.ts` - WebSocket hook (new)
- `apps/web-ui/src/components/dashboard/scan-progress.tsx` - Live progress UI (new)
- Tests: `apps/api/src/plugins/__tests__/websocket.test.ts`

**Incremental Scan Caching**:
- `packages/core/src/scan/cache-manager.ts` - Cache logic (new)
- `packages/core/src/scan/incremental-scanner.ts` - Incremental scan (new)
- `apps/api/src/worker.ts` - Use incremental scanner
- `apps/api/src/lib/redis-cache.ts` - Redis cache wrapper (new)
- Tests: `packages/core/src/scan/__tests__/cache-manager.test.ts`

**Empty States**:
- `apps/web-ui/src/components/ui/empty-state.tsx` - Enhanced component
- `apps/web-ui/src/app/(dashboard)/scans/page.tsx` - Add empty state
- `apps/web-ui/src/app/(dashboard)/findings/page.tsx` - Add empty state
- `apps/web-ui/src/app/(dashboard)/repositories/page.tsx` - Add empty state

**Form Validation**:
- `apps/web-ui/src/lib/form-validation.ts` - Validation utilities (new)
- `apps/web-ui/src/components/forms/validated-input.tsx` - Input component (new)
- Update all forms to use validated inputs

**Notification Automation**:
- `apps/api/src/services/notification-service.ts` - Notification orchestrator (new)
- `apps/api/src/jobs/notification-jobs.ts` - Background jobs (new)
- `apps/web-ui/src/app/(dashboard)/settings/notifications/page.tsx` - Settings UI (new)
- Tests: `apps/api/src/services/__tests__/notification-service.test.ts`

**Onboarding Emails**:
- `apps/api/src/services/onboarding-email-service.ts` - Email sequences (new)
- `apps/api/src/jobs/onboarding-jobs.ts` - Scheduled emails (new)
- Tests: `apps/api/src/services/__tests__/onboarding-email-service.test.ts`

**Public API**:
- `apps/api/src/routes/v1/public-api.ts` - API endpoints (new)
- `apps/web-ui/src/app/(dashboard)/settings/api-keys/page.tsx` - Key management UI (new)
- `apps/api/src/middleware/api-key-auth.ts` - API key auth (new)
- Tests: `apps/api/src/routes/v1/__tests__/public-api.test.ts`

**GitHub PR Comments**:
- `apps/api/src/services/github-pr-service.ts` - PR comment logic (new)
- `apps/api/src/routes/webhooks.ts` - Handle PR webhooks
- `apps/web-ui/src/app/(dashboard)/settings/github/page.tsx` - PR comment config (new)
- Tests: `apps/api/src/services/__tests__/github-pr-service.test.ts`

### Data Model Changes

**New Tables** (migrations):
- `scheduled_scans` - Already exists in schema
- `api_keys` - Already exists
- `notification_preferences` - Already exists
- `scan_cache` - New table for incremental caching

**New Indexes**:
- `scans(user_id, created_at DESC)` - For scan history
- `findings(scan_id, severity, status)` - For filtering
- `scheduled_scans(next_run)` - For cron queries

### APIs/Contracts Affected

**New Endpoints**:
- `POST /api/v1/scheduled-scans` - Create scheduled scan
- `GET /api/v1/scheduled-scans` - List scheduled scans
- `PUT /api/v1/scheduled-scans/:id` - Update scheduled scan
- `DELETE /api/v1/scheduled-scans/:id` - Delete scheduled scan
- `POST /api/v1/api-keys` - Create API key
- `GET /api/v1/api-keys` - List API keys
- `DELETE /api/v1/api-keys/:id` - Revoke API key
- `GET /api/v1/public/scans` - Public API: list scans
- `POST /api/v1/public/scans` - Public API: create scan
- `GET /api/v1/public/findings` - Public API: list findings

**Modified Endpoints**:
- `POST /api/billing/webhooks` - Add idempotency, better error handling
- `GET /api/scans/:id` - Add WebSocket progress subscription

### Feature Flags

- `ENABLE_SCHEDULED_SCANS` - Toggle scheduled scan feature
- `ENABLE_PUBLIC_API` - Toggle public API
- `ENABLE_GITHUB_PR_COMMENTS` - Toggle PR comments
- `ENABLE_INCREMENTAL_CACHING` - Toggle incremental scans

### Rollback Plan

**Billing Webhooks**: Revert to previous version, manually sync subscriptions if needed  
**Scheduled Scans**: Disable feature flag, stop cron worker  
**WebSocket**: Fallback to polling automatically  
**Incremental Caching**: Disable feature flag, fall back to full scans  
**Others**: Feature flags allow instant rollback

---

## 5. Code Changes

### Example: Billing Webhook Verification

```typescript
// apps/api/src/routes/billing-webhooks.ts

import Stripe from 'stripe';
import { prisma } from '@guardrail/database';
import { logger } from '../logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function billingWebhookRoutes(fastify: FastifyInstance) {
  fastify.post('/billing/webhooks', {
    config: {
      rawBody: true, // Required for signature verification
    },
  }, async (request: FastifyRequest<{ Body: Buffer }>, reply: FastifyReply) => {
    const sig = request.headers['stripe-signature'];
    
    if (!sig) {
      return reply.status(400).send({ error: 'Missing signature' });
    }

    let event: Stripe.Event;
    
    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        request.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      logger.warn({ error: err.message }, 'Webhook signature verification failed');
      return reply.status(400).send({ error: `Webhook Error: ${err.message}` });
    }

    // Check idempotency - prevent duplicate processing
    const existingEvent = await prisma.billingEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    if (existingEvent) {
      logger.info({ eventId: event.id }, 'Webhook already processed, skipping');
      return reply.send({ received: true, duplicate: true });
    }

    // Process event in transaction
    await prisma.$transaction(async (tx) => {
      // Log event for idempotency
      await tx.billingEvent.create({
        data: {
          stripeEventId: event.id,
          eventType: event.type,
          eventSource: 'stripe',
          metadata: event.data.object as any,
        },
      });

      // Handle event type
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, tx);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, tx);
          break;
        // ... other event types
      }
    });

    return reply.send({ received: true });
  });
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  tx: any
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    throw new Error('Missing userId in checkout session metadata');
  }

  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  // Upsert subscription with idempotency
  await tx.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      tier: session.metadata?.tier || 'starter',
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
    update: {
      stripeSubscriptionId: subscription.id,
      tier: session.metadata?.tier || 'starter',
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  logger.info({ userId, subscriptionId: subscription.id }, 'Subscription created/updated');
}
```

### Example: Scheduled Scan Service

```typescript
// apps/api/src/services/scheduled-scan-service.ts

import { CronJob } from 'cron';
import { prisma } from '@guardrail/database';
import { enqueueScan } from '../lib/queue';
import { logger } from '../logger';

export class ScheduledScanService {
  private cronJobs: Map<string, CronJob> = new Map();

  async start(): Promise<void> {
    // Load all enabled scheduled scans
    const schedules = await prisma.scheduledScan.findMany({
      where: { enabled: true },
      include: { user: true },
    });

    for (const schedule of schedules) {
      this.scheduleScan(schedule);
    }

    logger.info({ count: schedules.length }, 'Scheduled scans started');
  }

  private scheduleScan(schedule: any): void {
    const job = new CronJob(
      schedule.schedule,
      async () => {
        try {
          await this.executeScheduledScan(schedule);
        } catch (error: any) {
          logger.error({ error: error.message, scheduleId: schedule.id }, 'Scheduled scan failed');
        }
      },
      null,
      true,
      'UTC'
    );

    this.cronJobs.set(schedule.id, job);
  }

  private async executeScheduledScan(schedule: any): Promise<void> {
    logger.info({ scheduleId: schedule.id }, 'Executing scheduled scan');

    // Enqueue scan job
    const scanId = await enqueueScan({
      userId: schedule.userId,
      repositoryId: schedule.repositoryId,
      branch: 'main',
    });

    // Update schedule
    await prisma.scheduledScan.update({
      where: { id: schedule.id },
      data: {
        lastRun: new Date(),
        nextRun: this.calculateNextRun(schedule.schedule),
      },
    });

    logger.info({ scheduleId: schedule.id, scanId }, 'Scheduled scan enqueued');
  }

  private calculateNextRun(cronExpression: string): Date {
    // Parse cron and calculate next run time
    // Implementation depends on cron library
    return new Date();
  }

  async stop(): Promise<void> {
    for (const [id, job] of this.cronJobs) {
      job.stop();
    }
    this.cronJobs.clear();
  }
}

export const scheduledScanService = new ScheduledScanService();
```

---

## 6. Tests Added/Updated

### Unit Tests

- `apps/api/src/routes/__tests__/billing-webhooks.test.ts` - Webhook verification, idempotency
- `apps/api/src/services/__tests__/scheduled-scan-service.test.ts` - Cron execution
- `apps/api/src/plugins/__tests__/websocket.test.ts` - Progress events
- `packages/core/src/scan/__tests__/cache-manager.test.ts` - Cache hit/miss
- `apps/api/src/services/__tests__/notification-service.test.ts` - Notification delivery
- `apps/api/src/routes/v1/__tests__/public-api.test.ts` - API key auth, rate limiting

### Integration Tests

- `tests/integration/billing-webhook-flow.test.ts` - End-to-end webhook processing
- `tests/integration/scheduled-scan-flow.test.ts` - Scheduled scan execution
- `tests/integration/websocket-progress.test.ts` - Real-time progress updates
- `tests/integration/public-api.test.ts` - API key authentication flow

### E2E Tests

- `e2e/scheduled-scans.spec.ts` - Create, edit, delete scheduled scans
- `e2e/api-keys.spec.ts` - Create, use, revoke API keys
- `e2e/github-pr-comments.spec.ts` - PR comment creation

---

## 7. Verification Steps

### Commands to Run

```bash
# Lint and typecheck
pnpm lint
pnpm type-check

# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# Smoke test key workflows
pnpm test:smoke
```

### Expected Outputs

- All tests pass
- No TypeScript errors
- No linting errors
- Coverage >80% for new code

### Smoke Test Checklist

- [ ] Create scheduled scan → Verify cron job created
- [ ] Run scan → Verify WebSocket progress updates
- [ ] Stripe webhook → Verify subscription synced
- [ ] Create API key → Verify authentication works
- [ ] GitHub PR → Verify comment posted
- [ ] Empty state → Verify CTA works
- [ ] Form validation → Verify errors shown
- [ ] Notification sent → Verify delivery
- [ ] Onboarding email → Verify sent
- [ ] Incremental scan → Verify cache hit

---

## 8. Rollout Notes

### Migration Steps

1. **Database Migrations**:
   ```bash
   pnpm prisma migrate dev --name add_scan_cache
   ```

2. **Environment Variables**:
   - `STRIPE_WEBHOOK_SECRET` - Required for webhook verification
   - `REDIS_URL` - Required for cache and job queue
   - `CRON_ENABLED=true` - Enable scheduled scans

3. **Feature Flags**:
   - Enable features gradually via feature flags
   - Monitor error rates before full rollout

### Backward Compatibility

- All new endpoints are additive (no breaking changes)
- Existing webhook handlers remain functional
- Old scan flow still works (incremental is opt-in)

### Breaking Changes

- None in Cycle 1

### Runbook Updates

**New Operational Tasks**:
- Monitor scheduled scan execution (logs, failures)
- Monitor WebSocket connections (connection count, errors)
- Monitor API key usage (rate limits, abuse)
- Monitor cache hit rates (performance metrics)

**Alerts to Add**:
- Scheduled scan failures >5 in 1 hour
- WebSocket connection errors >10%
- API key rate limit violations
- Cache hit rate <30%

### Release Notes Draft

```markdown
# guardrail v1.1.0 - Cycle 1 Enhancements

## 🎉 New Features

### Scheduled Scans
- Schedule scans to run automatically (daily, weekly, custom cron)
- Manage scheduled scans from dashboard
- Email notifications on completion

### Real-Time Scan Progress
- Live progress updates via WebSocket
- No more polling - instant feedback
- Automatic reconnection on disconnect

### Public API
- REST API for integrations
- API key management UI
- Rate limiting and authentication

### GitHub PR Comments
- Automatic scan results in PR comments
- Configurable comment format
- Respects GitHub rate limits

## 🚀 Performance Improvements

### Incremental Scan Caching
- 3-5x faster scans on unchanged code
- Only scans modified files
- Automatic cache invalidation

## 🎨 UX Improvements

### Helpful Empty States
- Clear CTAs on empty screens
- Guidance for next steps
- Consistent design

### Form Validation
- Real-time validation
- Human-readable error messages
- Success confirmations

## 🔧 Reliability Improvements

### Billing Webhook Verification
- Signature verification for all webhooks
- Idempotency prevents duplicate processing
- Better subscription sync

### Automated Notifications
- Email/Slack/webhook notifications
- Configurable preferences
- Rate limiting

### Onboarding Emails
- Welcome sequence
- Feature discovery
- Activation tips

## 📊 Telemetry

All new features include comprehensive telemetry for monitoring and optimization.

## 🔒 Security

- API key authentication
- Webhook signature verification
- Rate limiting on all endpoints

---

**Upgrade**: `pnpm install guardrail@latest`  
**Migration**: Run `pnpm prisma migrate deploy`  
**Docs**: [Full Documentation](https://guardrailai.dev/docs)
```

---

## Next Steps

1. Review and approve this plan
2. Start Cycle 1 implementation (10 improvements)
3. Complete Cycle 1 → Verify → Deploy
4. Start Cycle 2 implementation (10 improvements)
5. Complete Cycle 2 → Verify → Deploy
6. Monitor telemetry and iterate

---

**Status**: Ready for implementation  
**Estimated Timeline**: Cycle 1: 2-3 weeks | Cycle 2: 2-3 weeks  
**Total**: 4-6 weeks for both cycles
