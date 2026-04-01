# guardrail AI - Enhancement Implementation Plan

**Generated:** 2026-01-07  
**Status:** In Progress

---

## Quick Reality Scan

### What Was Inspected
- **API Routes**: Runs, findings, webhooks, billing, security reports
- **Services**: Webhook integration, security report generator, email notifications
- **Database Schema**: Scans, findings, security events, subscriptions
- **Web UI**: Run detail pages, dashboard, loading/error states
- **CLI**: Scan commands, auth flows

### Biggest Risks/Holes Found
1. **Webhook delivery only logs** - No actual HTTP delivery to subscribers
2. **Security reports use mock data** - Not fetching from database
3. **No auto-retry for failed scans** - Manual intervention required
4. **Missing Slack integration** - No notification channel
5. **Scan results page lacks error recovery** - Users stuck on failures

---

## Top 5 Enhancements (Ranked)

### 1. Complete Webhook Delivery System ⭐⭐⭐
**Goal**: Replace logging with actual HTTP webhook delivery to subscribers  
**User Value**: Integrations actually work - Slack, Discord, custom webhooks receive real events  
**Effort**: Medium (2-3 hours)  
**Risk**: Low (already has HTTP helper, just needs DB persistence)  
**Dependencies**: Add WebhookSubscription/WebhookEvent models to schema

### 2. Real Security Report Data Fetching ⭐⭐⭐
**Goal**: Replace mock data with real database queries  
**User Value**: Accurate security reports based on actual scan results  
**Effort**: Medium (2-3 hours)  
**Risk**: Low (database models exist, just need queries)  
**Dependencies**: None

### 3. Enhanced Scan Results UX ⭐⭐
**Goal**: Better real-time updates, error recovery, optimistic UI  
**User Value**: Faster feedback, fewer confusing states, auto-recovery  
**Effort**: Medium (2-3 hours)  
**Risk**: Low (UI components exist, just need enhancement)  
**Dependencies**: None

### 4. Auto-Retry Failed Scans ⭐⭐
**Goal**: Automatic retry with exponential backoff for failed scans  
**User Value**: Fewer manual interventions, better reliability  
**Effort**: Medium (2-3 hours)  
**Risk**: Medium (need to avoid infinite loops)  
**Dependencies**: Queue system or scheduled jobs

### 5. Slack Integration for Notifications ⭐
**Goal**: Send scan completion notifications to Slack  
**User Value**: Team awareness without checking dashboard  
**Effort**: Low (1-2 hours)  
**Risk**: Low (webhook system already supports it)  
**Dependencies**: Slack webhook URL configuration

---

## Implementation Plan

### Phase 1: Database Schema Updates

**File**: `prisma/schema.prisma`

Add models:
- `WebhookSubscription` - Store webhook endpoints and config
- `WebhookEvent` - Store webhook events for delivery tracking
- `WebhookDelivery` - Track delivery attempts and results

### Phase 2: Webhook Delivery System

**Files**:
- `apps/api/src/services/webhook-integration-service.ts` - Update to use DB
- `apps/api/src/routes/webhook-config.ts` - Add subscription management routes
- `apps/api/src/services/webhook-processor.ts` - Background processor

**Changes**:
- Replace in-memory storage with Prisma queries
- Add webhook subscription CRUD endpoints
- Implement background job for webhook delivery
- Add delivery tracking and retry logic

### Phase 3: Security Report Data Fetching

**File**: `apps/api/src/services/security-report-generator.ts`

**Changes**:
- Replace `generateExecutiveSummary` mock data with real queries
- Fetch from `Scan`, `Finding`, `SecurityEvent` tables
- Calculate real metrics (risk scores, trends, etc.)
- Add proper error handling for missing data

### Phase 4: Scan Results UX Enhancement

**Files**:
- `apps/web-ui/src/app/(dashboard)/runs/[id]/page.tsx`
- `apps/web-ui/src/hooks/useRealtimeScan.ts`
- `apps/web-ui/src/components/runs/LiveScanConsole.tsx`

**Changes**:
- Add auto-refresh on error recovery
- Improve loading skeleton states
- Add optimistic updates for fix applications
- Better error messages with retry buttons
- Progressive loading (show partial results)

### Phase 5: Auto-Retry System

**Files**:
- `apps/api/src/services/scheduled-jobs.ts`
- `apps/api/src/routes/runs.ts`
- `apps/api/src/worker.ts`

**Changes**:
- Add failed scan detection
- Implement exponential backoff retry logic
- Add max retry limit (3 attempts)
- Update scan status appropriately
- Send notifications on final failure

### Phase 6: Slack Integration

**Files**:
- `apps/api/src/services/slack-notification-service.ts` (new)
- `apps/api/src/routes/settings.ts` - Add Slack webhook config
- `apps/api/src/services/webhook-integration-service.ts` - Add Slack provider

**Changes**:
- Create Slack notification service
- Add Slack webhook URL to user settings
- Send formatted messages on scan completion
- Support rich formatting (blocks, attachments)

---

## Code Changes

### 1. Database Schema Addition

```prisma
model WebhookSubscription {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  url             String
  events          String[] // Array of event types to subscribe to
  secret          String?  // HMAC secret for signature verification
  isActive        Boolean  @default(true) @map("is_active")
  timeout         Int      @default(10000) // milliseconds
  retryConfig     Json?    @map("retry_config") // Retry configuration
  headers         Json?    // Custom headers
  rateLimit       Json?    @map("rate_limit") // Rate limit config
  lastDeliveryAt  DateTime? @map("last_delivery_at")
  failureCount    Int      @default(0) @map("failure_count")
  metadata        Json?
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  deliveries      WebhookDelivery[]
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  @@index([userId])
  @@index([isActive])
  @@map("webhook_subscriptions")
}

model WebhookEvent {
  id              String   @id @default(cuid())
  type            String   // scan.completed, scan.failed, etc.
  data            Json     // Event payload
  source          String   @default("system") // system, user, integration
  version         String   @default("1.0")
  signature       String?
  metadata        Json?
  
  deliveries      WebhookDelivery[]
  
  createdAt       DateTime @default(now()) @map("created_at")
  
  @@index([type, createdAt])
  @@map("webhook_events")
}

model WebhookDelivery {
  id              String   @id @default(cuid())
  subscriptionId  String   @map("subscription_id")
  eventId         String   @map("event_id")
  attempt         Int      @default(1)
  status          String   // pending, delivered, failed
  statusCode      Int?
  responseTime    Int?     @map("response_time") // milliseconds
  error           String?
  responseBody     String?  @db.Text @map("response_body")
  retryAt         DateTime? @map("retry_at")
  
  subscription    WebhookSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  event           WebhookEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  
  createdAt       DateTime @default(now()) @map("created_at")
  deliveredAt     DateTime? @map("delivered_at")
  
  @@index([subscriptionId, status])
  @@index([eventId])
  @@index([retryAt])
  @@map("webhook_deliveries")
}
```

### 2. Webhook Service Updates

Update `webhook-integration-service.ts` to:
- Use Prisma for subscription storage
- Persist events to database
- Track deliveries with retry logic
- Add background job processor

### 3. Security Report Generator Updates

Replace mock data methods with:
- `getLatestScans(projectId, period)` - Fetch scans from DB
- `getFindingsBySeverity(projectId, period)` - Aggregate findings
- `calculateRiskScore(projectId)` - Real risk calculation
- `getComplianceStatus(projectId)` - From ComplianceAssessment table

### 4. Scan Retry Service

Create `scan-retry-service.ts`:
- Detect failed scans (status='failed', error set)
- Calculate retry delay (exponential backoff)
- Queue retry job
- Update scan status
- Send notifications

### 5. Slack Notification Service

Create `slack-notification-service.ts`:
- Format scan results as Slack blocks
- Send via webhook URL
- Handle errors gracefully
- Support rich formatting

---

## Tests Added/Updated

### Unit Tests
- `apps/api/src/services/__tests__/webhook-integration-service.test.ts`
- `apps/api/src/services/__tests__/security-report-generator.test.ts`
- `apps/api/src/services/__tests__/scan-retry-service.test.ts`
- `apps/api/src/services/__tests__/slack-notification-service.test.ts`

### Integration Tests
- `apps/api/src/routes/__tests__/webhook-config.test.ts`
- `apps/api/src/routes/__tests__/runs.test.ts` - Test retry logic

### E2E Tests
- `tests/e2e/webhook-delivery.test.ts`
- `tests/e2e/scan-retry.test.ts`

---

## Verification Steps

### 1. Webhook Delivery
```bash
# Create webhook subscription
curl -X POST http://localhost:5000/api/v1/webhooks/subscriptions \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"url": "https://example.com/webhook", "events": ["scan.completed"]}'

# Trigger scan
curl -X POST http://localhost:5000/api/v1/runs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"repo": "test/repo"}'

# Verify webhook delivered (check logs and webhook endpoint)
```

### 2. Security Report
```bash
# Generate report
curl -X POST http://localhost:5000/api/v1/reports/security \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"projectId": "proj_123", "period": {"start": "2025-01-01", "end": "2026-01-07"}}'

# Verify report contains real data (not mock)
```

### 3. Scan Retry
```bash
# Create scan that will fail
# Wait for retry (check scheduled jobs)
# Verify scan retried automatically
```

### 4. Slack Integration
```bash
# Configure Slack webhook
curl -X PUT http://localhost:5000/api/v1/settings/notifications \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"slackWebhookUrl": "https://hooks.slack.com/..."}'

# Trigger scan
# Verify Slack message received
```

---

## Rollout Notes

### Migration Steps
1. Run Prisma migration for new webhook tables
2. Deploy API with webhook service updates
3. Deploy web UI with UX enhancements
4. Enable scheduled jobs for retry system
5. Configure Slack integration (optional)

### Feature Flags
- `ENABLE_WEBHOOK_DELIVERY` - Toggle webhook delivery (default: true)
- `ENABLE_SCAN_RETRY` - Toggle auto-retry (default: true)
- `ENABLE_SLACK_NOTIFICATIONS` - Toggle Slack (default: false)

### Backward Compatibility
- Existing webhook subscriptions continue to work
- Old security reports still generate (with mock data fallback)
- Scan retry is opt-in (doesn't affect existing scans)

### Rollback Strategy
1. Disable feature flags
2. Revert API deployment
3. Keep database schema (no data loss)
4. Re-enable old webhook logging if needed

---

**Next Steps**: Begin implementation starting with database schema updates.
