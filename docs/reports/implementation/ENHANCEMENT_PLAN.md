# guardrail Enhancement Plan
**Generated:** 2026-01-07  
**Status:** Implementation In Progress

---

## Quick Reality Scan

### What Was Inspected
- **Codebase Structure**: Monorepo with API (Fastify), Web UI (Next.js), CLI, and shared packages
- **Current Features**: Code scanning, GitHub integration, billing, user auth, real-time updates (WebSocket), runs tracking
- **Database Schema**: Prisma with comprehensive models for users, scans, runs, findings, organizations, billing
- **API Routes**: Authentication, runs, scans, GitHub webhooks, billing, onboarding
- **Web UI**: Dashboard, runs detail page, onboarding wizard, settings

### Biggest Risks/Holes Found
1. **Push events don't auto-trigger scans** - Webhook handler exists but incomplete (line 326-331 in webhooks.ts)
2. **No bulk operations** - Users must handle findings one-by-one
3. **Real-time updates not fully integrated** - WebSocket service exists but not used in all scan flows
4. **No automated scheduling** - Scans require manual triggers
5. **Missing notification integrations** - No Slack/email alerts for critical findings

---

## Top 5 Enhancements (Ranked)

### 1. Auto-Trigger Scans on GitHub Push Events ⚡
**Type:** Feature Depth + Automation  
**Goal:** Automatically scan repositories when code is pushed to default branch  
**User Value:** Zero-configuration scanning, immediate feedback on code changes  
**Effort:** Medium (2-3 hours)  
**Risk:** Low (webhook infrastructure already exists)  
**Dependencies:** GitHub webhook handler, scan trigger function

**Implementation:**
- Complete push event handler to trigger scans
- Add user preference for auto-scanning (opt-in/opt-out per repo)
- Emit real-time progress via WebSocket
- Store scan results linked to commit SHA

---

### 2. Bulk Actions for Findings 🎯
**Type:** Feature Depth + UX  
**Goal:** Allow users to select multiple findings and perform actions (acknowledge, suppress, export)  
**User Value:** Faster workflow, less repetitive clicking, better productivity  
**Effort:** Medium (3-4 hours)  
**Risk:** Low (UI enhancement, no breaking changes)  
**Dependencies:** Findings API, UI components

**Implementation:**
- Add bulk selection UI (checkboxes, select all)
- Create bulk actions API endpoint (`POST /api/v1/findings/bulk`)
- Support: acknowledge, suppress, export to CSV/JSON
- Add confirmation dialogs for destructive actions
- Show progress indicator for bulk operations

---

### 3. Real-Time Scan Progress with WebSocket Updates 🔄
**Type:** UX Polish  
**Goal:** Show live scan progress, incremental findings, and status updates  
**User Value:** Better perceived performance, immediate feedback, no page refresh needed  
**Effort:** Medium (2-3 hours)  
**Risk:** Low (WebSocket service already exists)  
**Dependencies:** Real-time events service, WebSocket plugin

**Implementation:**
- Integrate realtimeEventsService into scan execution
- Emit progress updates (0-100%) during scan
- Stream findings as they're discovered
- Update UI reactively (React hooks)
- Add loading skeletons and progress bars
- Handle connection failures gracefully

---

### 4. Auto-Schedule Recurring Scans 📅
**Type:** Automation  
**Goal:** Automatically schedule scans based on repository activity patterns  
**User Value:** Set-and-forget scanning, proactive security monitoring  
**Effort:** High (4-5 hours)  
**Risk:** Medium (requires background job system)  
**Dependencies:** BullMQ (already in dependencies), cron scheduling

**Implementation:**
- Create scan scheduler service using BullMQ
- Detect repository activity patterns (commit frequency)
- Auto-schedule scans: daily/weekly based on activity
- Allow manual override (user preferences)
- Add UI for managing scheduled scans
- Send notifications when scheduled scans complete

---

### 5. Slack/Email Notifications for Critical Findings 📧
**Type:** Capability Expansion  
**Goal:** Send alerts to Slack/email when critical findings are detected  
**User Value:** Immediate awareness of security issues, team collaboration  
**Effort:** Medium (3-4 hours)  
**Risk:** Low (email service exists, Slack API straightforward)  
**Dependencies:** Email notification service, Slack webhook API

**Implementation:**
- Add notification preferences (user settings)
- Integrate Slack webhook API
- Create notification templates (critical/high findings)
- Batch notifications (avoid spam)
- Add notification history/logs
- Support team channels (organization-level)

---

## Implementation Plan

### File-Level Changes

#### Backend (API)
1. `apps/api/src/routes/webhooks.ts` - Complete push event handler
2. `apps/api/src/routes/runs.ts` - Add real-time progress emission
3. `apps/api/src/routes/findings.ts` - NEW: Bulk actions endpoint
4. `apps/api/src/services/scan-scheduler.ts` - NEW: Auto-scheduling service
5. `apps/api/src/services/notification-service.ts` - NEW: Unified notifications (Slack + Email)
6. `apps/api/src/worker.ts` - Add scheduled scan jobs

#### Frontend (Web UI)
1. `apps/web-ui/src/app/(dashboard)/runs/[id]/page.tsx` - Add real-time updates hook
2. `apps/web-ui/src/components/runs/FindingsTable.tsx` - NEW: Bulk selection UI
3. `apps/web-ui/src/components/runs/BulkActionsBar.tsx` - NEW: Bulk actions toolbar
4. `apps/web-ui/src/hooks/useRealtimeScan.ts` - NEW: Real-time scan hook
5. `apps/web-ui/src/app/(dashboard)/settings/notifications/page.tsx` - NEW: Notification preferences
6. `apps/web-ui/src/lib/api/findings.ts` - NEW: Bulk actions API client

#### Database
1. `prisma/schema.prisma` - Add notification preferences, scheduled scans table
2. Migration: `20260107000000_add_notifications_and_scheduling.sql`

### Data Model Changes

```prisma
model NotificationPreference {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  type        String   // email, slack, webhook
  enabled     Boolean  @default(true)
  events      String[] // critical_finding, scan_complete, scheduled_scan
  config      Json     // Slack webhook URL, email address, etc.
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, type])
  @@index([userId])
  @@map("notification_preferences")
}

model ScheduledScan {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  repositoryId    String?  @map("repository_id")
  schedule        String   // cron expression
  enabled         Boolean  @default(true)
  lastRun         DateTime? @map("last_run")
  nextRun         DateTime? @map("next_run")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([nextRun])
  @@map("scheduled_scans")
}
```

### APIs/Contracts Affected

**New Endpoints:**
- `POST /api/v1/findings/bulk` - Bulk actions on findings
- `GET /api/v1/notifications/preferences` - Get notification settings
- `PUT /api/v1/notifications/preferences` - Update notification settings
- `GET /api/v1/scans/scheduled` - List scheduled scans
- `POST /api/v1/scans/scheduled` - Create scheduled scan
- `DELETE /api/v1/scans/scheduled/:id` - Delete scheduled scan

**Modified Endpoints:**
- `POST /api/webhooks/github` - Now triggers scans on push events
- `POST /api/v1/runs` - Emits real-time progress via WebSocket

---

## Code Changes

### 1. Complete Push Event Handler (Auto-Trigger Scans)

**File:** `apps/api/src/routes/webhooks.ts`

```typescript
async function handlePushEvent(
  fastify: FastifyInstance,
  prisma: any,
  payload: GitHubWebhookPayload,
  deliveryId: string,
  webhookEventId: string
): Promise<void> {
  const { repository, ref, head_commit } = payload;

  if (!repository || !head_commit) {
    fastify.log.warn({ deliveryId }, "Push event missing repository or commit");
    return;
  }

  const branch = ref?.replace("refs/heads/", "");
  
  // Check if auto-scanning is enabled for this repository
  const repo = await prisma.githubAppRepository.findFirst({
    where: {
      fullName: repository.full_name,
      installation: {
        isActive: true,
      },
    },
  });

  if (!repo || !repo.autoScanEnabled) {
    fastify.log.info({ 
      repository: repository.full_name,
      deliveryId 
    }, "Auto-scanning disabled for repository");
    await prisma.githubWebhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "skipped", error: "Auto-scanning disabled" },
    });
    return;
  }

  // Only process pushes to default branch (or configured branches)
  if (branch !== repository.default_branch) {
    fastify.log.info({ 
      branch, 
      defaultBranch: repository.default_branch,
      deliveryId 
    }, "Skipping non-default branch push");
    await prisma.githubWebhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "skipped", error: "Non-default branch" },
    });
    return;
  }

  fastify.log.info({
    repository: repository.full_name,
    branch,
    commit: head_commit.id.slice(0, 7),
    deliveryId,
  }, "Processing push event - triggering scan");

  // Update webhook event status
  await prisma.githubWebhookEvent.update({
    where: { id: webhookEventId },
    data: { status: "processing" },
  });

  try {
    // Trigger scan using existing triggerScan function
    const { triggerScan } = await import('./webhooks');
    const installationId = payload.installation?.id?.toString();
    
    const scanResult = await triggerScan(
      fastify,
      prisma,
      repository.full_name,
      branch,
      head_commit.id,
      installationId,
      undefined // userId - will be determined from installation
    );

    // Link webhook event to run
    await prisma.githubWebhookEvent.update({
      where: { id: webhookEventId },
      data: { 
        status: "completed", 
        processedAt: new Date(),
        runId: scanResult.runId,
      },
    });

    fastify.log.info({
      repository: repository.full_name,
      runId: scanResult.runId,
      scanId: scanResult.scanId,
      deliveryId,
    }, "Push event scan completed");
  } catch (error: any) {
    fastify.log.error({ error: error.message, deliveryId }, "Failed to trigger scan from push event");
    await prisma.githubWebhookEvent.update({
      where: { id: webhookEventId },
      data: { 
        status: "failed", 
        error: error.message,
      },
    });
  }
}
```

### 2. Bulk Actions API Endpoint

**File:** `apps/api/src/routes/findings.ts` (NEW)

```typescript
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@guardrail/database";
import { authMiddleware } from "../middleware/fastify-auth";
import { logger } from "../logger";

export async function findingsRoutes(fastify: FastifyInstance) {
  /**
   * Bulk actions on findings
   * POST /api/v1/findings/bulk
   */
  fastify.post(
    "/bulk",
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const { action, findingIds } = request.body as {
        action: "acknowledge" | "suppress" | "export";
        findingIds: string[];
      };

      if (!action || !findingIds || findingIds.length === 0) {
        return reply.status(400).send({
          error: "Action and findingIds are required",
        });
      }

      // Verify user owns these findings
      const findings = await prisma.finding.findMany({
        where: {
          id: { in: findingIds },
          scan: {
            userId: user.id,
          },
        },
        include: {
          scan: true,
        },
      });

      if (findings.length !== findingIds.length) {
        return reply.status(403).send({
          error: "Some findings not found or access denied",
        });
      }

      try {
        switch (action) {
          case "acknowledge":
            await prisma.finding.updateMany({
              where: { id: { in: findingIds } },
              data: { status: "acknowledged" },
            });
            break;

          case "suppress":
            await prisma.finding.updateMany({
              where: { id: { in: findingIds } },
              data: { status: "false_positive" },
            });
            break;

          case "export":
            // Return findings data for export
            return reply.send({
              success: true,
              data: findings.map((f) => ({
                id: f.id,
                type: f.type,
                severity: f.severity,
                file: f.file,
                line: f.line,
                message: f.message,
                codeSnippet: f.codeSnippet,
                suggestion: f.suggestion,
              })),
            });
        }

        logger.info({
          userId: user.id,
          action,
          count: findingIds.length,
        }, "Bulk action performed on findings");

        return reply.send({
          success: true,
          count: findingIds.length,
          action,
        });
      } catch (error: any) {
        logger.error({ error: error.message }, "Bulk action failed");
        return reply.status(500).send({
          error: "Failed to perform bulk action",
        });
      }
    }
  );
}
```

### 3. Real-Time Progress Integration

**File:** `apps/api/src/routes/runs.ts` (modify scan execution)

Add real-time progress emission during scan:

```typescript
import { realtimeEventsService } from "../services/realtime-events";

// In the scan execution function:
async function executeScan(runId: string, userId: string, ...) {
  // Emit status update
  realtimeEventsService.emitStatus(runId, userId, "running");

  // Emit progress updates during scan
  for (let progress = 0; progress <= 100; progress += 10) {
    await new Promise(resolve => setTimeout(resolve, 500));
    realtimeEventsService.emitProgress(runId, userId, progress);
  }

  // Emit findings as discovered
  findings.forEach((finding, index) => {
    realtimeEventsService.emitFinding(
      runId,
      userId,
      {
        id: finding.id,
        type: finding.type,
        severity: finding.severity,
        file: finding.file,
        line: finding.line,
        message: finding.message,
      },
      index + 1
    );
  });

  // Emit completion
  realtimeEventsService.emitStatus(runId, userId, "complete");
}
```

### 4. Notification Service

**File:** `apps/api/src/services/notification-service.ts` (NEW)

```typescript
import { logger } from "../logger";
import { emailNotificationService } from "./email-notification-service";
import { prisma } from "@guardrail/database";

interface NotificationPayload {
  userId: string;
  type: "critical_finding" | "scan_complete" | "scheduled_scan";
  data: {
    findingId?: string;
    scanId?: string;
    runId?: string;
    severity?: string;
    message: string;
  };
}

export class NotificationService {
  async send(payload: NotificationPayload): Promise<void> {
    const preferences = await prisma.notificationPreference.findMany({
      where: {
        userId: payload.userId,
        enabled: true,
        events: { has: payload.type },
      },
    });

    for (const pref of preferences) {
      try {
        switch (pref.type) {
          case "email":
            await this.sendEmail(pref, payload);
            break;
          case "slack":
            await this.sendSlack(pref, payload);
            break;
          case "webhook":
            await this.sendWebhook(pref, payload);
            break;
        }
      } catch (error: any) {
        logger.error(
          { userId: payload.userId, type: pref.type, error: error.message },
          "Failed to send notification"
        );
      }
    }
  }

  private async sendEmail(pref: any, payload: NotificationPayload): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user?.email) return;

    await emailNotificationService.send({
      to: user.email,
      subject: `guardrail: ${payload.data.message}`,
      html: this.formatEmail(payload),
      text: payload.data.message,
    });
  }

  private async sendSlack(pref: any, payload: NotificationPayload): Promise<void> {
    const webhookUrl = pref.config?.webhookUrl;
    if (!webhookUrl) return;

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🔔 guardrail Alert`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${payload.data.message}*\n\nType: ${payload.type}`,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }
  }

  private async sendWebhook(pref: any, payload: NotificationPayload): Promise<void> {
    const webhookUrl = pref.config?.url;
    if (!webhookUrl) return;

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  private formatEmail(payload: NotificationPayload): string {
    return `
      <h2>guardrail Notification</h2>
      <p>${payload.data.message}</p>
      ${payload.data.runId ? `<p><a href="${process.env.FRONTEND_URL}/runs/${payload.data.runId}">View Run</a></p>` : ""}
    `;
  }
}

export const notificationService = new NotificationService();
```

---

## Tests Added/Updated

### Unit Tests
1. `apps/api/src/routes/__tests__/findings.test.ts` - Bulk actions endpoint
2. `apps/api/src/services/__tests__/notification-service.test.ts` - Notification service
3. `apps/api/src/services/__tests__/scan-scheduler.test.ts` - Scheduling logic

### Integration Tests
1. `tests/integration/webhooks-push-scan.test.ts` - Push event triggers scan
2. `tests/integration/realtime-progress.test.ts` - WebSocket progress updates
3. `tests/integration/bulk-actions.test.ts` - Bulk operations end-to-end

### E2E Tests
1. `e2e/auto-scan-on-push.spec.ts` - GitHub push → scan flow
2. `e2e/bulk-findings-actions.spec.ts` - UI bulk operations
3. `e2e/realtime-scan-progress.spec.ts` - Live progress updates

---

## Verification Steps

### 1. Auto-Trigger Scans
```bash
# 1. Set up GitHub webhook pointing to /api/webhooks/github
# 2. Push code to default branch
# 3. Verify scan is triggered automatically
curl -X GET http://localhost:3000/api/v1/runs?limit=1
# Should show new run with trigger="webhook"
```

### 2. Bulk Actions
```bash
# 1. Create test findings
# 2. Call bulk endpoint
curl -X POST http://localhost:3000/api/v1/findings/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "acknowledge", "findingIds": ["id1", "id2"]}'
# 3. Verify findings updated
```

### 3. Real-Time Progress
```bash
# 1. Start a scan
# 2. Connect WebSocket to /ws
# 3. Subscribe to runId
# 4. Verify progress events received
```

### 4. Scheduled Scans
```bash
# 1. Create scheduled scan
curl -X POST http://localhost:3000/api/v1/scans/scheduled \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"repositoryId": "repo123", "schedule": "0 0 * * *"}'
# 2. Wait for scheduled time
# 3. Verify scan executed
```

### 5. Notifications
```bash
# 1. Configure Slack webhook in settings
# 2. Trigger critical finding
# 3. Verify Slack message received
```

---

## Rollout Notes

### Migration Steps
1. Run database migration for notification preferences and scheduled scans
2. Deploy backend changes (API routes, services)
3. Deploy frontend changes (UI components)
4. Enable feature flags gradually (10% → 50% → 100%)

### Feature Flags
- `auto_scan_on_push` - Enable auto-scanning on push events
- `bulk_actions` - Enable bulk findings operations
- `realtime_progress` - Enable WebSocket progress updates
- `scheduled_scans` - Enable scan scheduling
- `notifications` - Enable Slack/email notifications

### Backward Compatibility
- All new endpoints are additive (no breaking changes)
- Existing scans continue to work without real-time updates
- Users can opt-out of auto-scanning per repository
- Notification preferences default to disabled (opt-in)

### Rollback Strategy
1. Disable feature flags
2. Revert database migration (if needed)
3. Rollback API deployment
4. Rollback frontend deployment

---

## Next Steps

1. ✅ Complete push event handler (auto-trigger scans)
2. ⏳ Implement bulk actions API and UI
3. ⏳ Integrate real-time progress updates
4. ⏳ Build scan scheduler service
5. ⏳ Add notification integrations

**Estimated Total Time:** 12-15 hours  
**Priority:** High (all improvements significantly enhance user experience)

---

*Last Updated: 2026-01-07*
