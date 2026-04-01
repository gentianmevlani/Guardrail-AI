# Compliance Package Fix Plan

## Overview
The compliance package has numerous errors due to missing database tables, missing modules, and type mismatches. This plan addresses all issues systematically.

## Phase 1: Database Schema Updates

### 1.1 Add Missing Tables to Prisma Schema
Add the following models to `prisma/schema.prisma`:

```prisma
// ==========================================
// COMPLIANCE MODULE
// ==========================================

model ComplianceReport {
  id                String   @id @default(cuid())
  projectId         String
  frameworkId       String
  type              String   // 'compliance' | 'audit' | 'executive' | 'technical' | 'remediation'
  format            String   // 'pdf' | 'html' | 'json' | 'csv'
  generatedAt       DateTime @default(now())
  periodStart       DateTime?
  periodEnd         DateTime?
  summary           Json     // Compliance summary
  evidence          Json?    // Evidence data
  controls          Json     // Control assessments
  gaps              Json?    // Compliance gaps
  status            String   @default("draft") // 'draft' | 'reviewing' | 'approved' | 'archived'
  
  // Relations
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  schedules         ReportSchedule[]
  
  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@map("compliance_reports")
}

model ReportSchedule {
  id                String   @id @default(cuid())
  reportId          String   @unique
  projectId         String
  frameworkId       String
  frequency         String   // 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  nextRun           DateTime
  isActive          Boolean  @default(true)
  recipients        Json?    // Array of email addresses
  options           Json?    // Additional scheduling options
  
  // Relations
  report            ComplianceReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@map("report_schedules")
}

model EvidenceCollection {
  id                String   @id @default(cuid())
  projectId         String
  controlId         String?
  type              String   // 'screenshot' | 'log' | 'document' | 'test-result' | 'config'
  description       String
  filePath          String?
  fileUrl           String?
  metadata          Json?    // Additional evidence metadata
  collectedAt       DateTime @default(now())
  collectedBy       String   // User ID
  
  // Relations
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@map("evidence_collections")
}

model AuditEvent {
  id                String   @id @default(cuid())
  projectId         String?
  userId            String?
  eventType         String   // 'login' | 'access' | 'modification' | 'export' | 'delete'
  resource          String?  // Resource type that was accessed
  resourceId        String?  // ID of resource
  action            String   // Action performed
  details           Json?    // Event details
  ipAddress         String?
  userAgent         String?
  timestamp         DateTime @default(now())
  
  // Relations
  project           Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  user              User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  @@map("audit_events")
}

model ComplianceSchedule {
  id                String   @id @default(cuid())
  projectId         String
  frameworkId       String
  assessmentType    String   // 'automated' | 'manual' | 'hybrid'
  frequency         String   // 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  nextAssessment    DateTime
  isActive          Boolean  @default(true)
  assignees         Json?    // Array of user IDs
  checklist         Json?    // Assessment checklist
  
  // Relations
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@map("compliance_schedules")
}
```

### 1.2 Update Existing Models
Add these relations to existing models:

```prisma
model User {
  // ... existing fields ...
  auditEvents       AuditEvent[]
  @@map("users")
}

model Project {
  // ... existing fields ...
  complianceReports ComplianceReport[]
  reportSchedules   ReportSchedule[]
  evidenceCollections EvidenceCollection[]
  auditEvents       AuditEvent[]
  complianceSchedules ComplianceSchedule[]
  @@map("projects")
}
```

## Phase 2: Create Missing Modules

### 2.1 Create Evidence Collector
Create `packages/compliance/src/automation/evidence-collector.ts`:

```typescript
import { prisma } from '@guardrail/database';

export interface EvidenceArtifact {
  id: string;
  type: string;
  description: string;
  data: any;
  timestamp: Date;
}

export class EvidenceCollector {
  async collectEvidence(
    projectId: string,
    controlId: string,
    type: string,
    description: string,
    data: any
  ): Promise<EvidenceArtifact> {
    const evidence = await prisma.evidenceCollection.create({
      data: {
        projectId,
        controlId,
        type,
        description,
        metadata: data,
        collectedBy: 'system' // TODO: Get actual user ID
      }
    });

    return {
      id: evidence.id,
      type: evidence.type,
      description: evidence.description,
      data: evidence.metadata,
      timestamp: evidence.collectedAt
    };
  }

  async getProjectEvidence(projectId: string): Promise<EvidenceArtifact[]> {
    const evidence = await prisma.evidenceCollection.findMany({
      where: { projectId },
      orderBy: { collectedAt: 'desc' }
    });

    return evidence.map(e => ({
      id: e.id,
      type: e.type,
      description: e.description,
      data: e.metadata,
      timestamp: e.collectedAt
    }));
  }
}

export const evidenceCollector = new EvidenceCollector();
```

### 2.2 Create Audit Logger
Create `packages/compliance/src/automation/audit-logger.ts`:

```typescript
import { prisma } from '@guardrail/database';

export interface AuditLogEntry {
  id: string;
  userId?: string;
  projectId?: string;
  eventType: string;
  resource?: string;
  resourceId?: string;
  action: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export class AuditLogger {
  async log(entry: Partial<AuditLogEntry>): Promise<void> {
    await prisma.auditEvent.create({
      data: {
        userId: entry.userId,
        projectId: entry.projectId,
        eventType: entry.eventType!,
        resource: entry.resource,
        resourceId: entry.resourceId,
        action: entry.action!,
        details: entry.details,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent
      }
    });
  }

  async getAuditTrail(
    projectId?: string,
    userId?: string,
    limit: number = 100
  ): Promise<AuditLogEntry[]> {
    const events = await prisma.auditEvent.findMany({
      where: {
        AND: [
          projectId ? { projectId } : {},
          userId ? { userId } : {}
        ]
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    });

    return events.map(e => ({
      id: e.id,
      userId: e.userId || undefined,
      projectId: e.projectId || undefined,
      eventType: e.eventType,
      resource: e.resource || undefined,
      resourceId: e.resourceId || undefined,
      action: e.action,
      details: e.details || undefined,
      ipAddress: e.ipAddress || undefined,
      userAgent: e.userAgent || undefined,
      timestamp: e.timestamp
    }));
  }
}

export const auditLogger = new AuditLogger();
```

### 2.3 Create Cron Job Helper
Create `packages/compliance/src/utils/cron-helper.ts`:

```typescript
export interface CronSchedule {
  minute?: string;
  hour?: string;
  dayOfMonth?: string;
  month?: string;
  dayOfWeek?: string;
}

export class CronHelper {
  static frequencyToCron(frequency: string): string {
    switch (frequency) {
      case 'daily':
        return '0 0 * * *'; // At midnight every day
      case 'weekly':
        return '0 0 * * 0'; // At midnight on Sunday
      case 'monthly':
        return '0 0 1 * *'; // At midnight on 1st day of month
      case 'quarterly':
        return '0 0 1 */3 *'; // At midnight on 1st day every quarter
      case 'yearly':
        return '0 0 1 1 *'; // At midnight on Jan 1st
      default:
        return '0 0 * * *'; // Default to daily
    }
  }

  static nextRunDate(frequency: string): Date {
    const now = new Date();
    const cron = this.frequencyToCron(frequency);
    
    // Simple calculation - in production, use a proper cron parser
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      case 'quarterly':
        const nextQuarter = new Date(now);
        nextQuarter.setMonth(nextQuarter.getMonth() + 3);
        return nextQuarter;
      case 'yearly':
        const nextYear = new Date(now);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear;
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }
}
```

## Phase 3: Fix Type Issues

### 3.1 Update ComplianceAssessmentResult Interface
Update `packages/compliance/src/frameworks/engine.ts`:

```typescript
export interface ComplianceAssessmentResult {
  id?: string; // Optional for database records
  projectId: string;
  frameworkId: string;
  createdAt?: Date; // Optional for database records
  summary: {
    totalControls: number;
    compliant: number;
    partial: number;
    nonCompliant: number;
    score: number; // 0-100
  };
  controls: ControlAssessment[];
  gaps: ComplianceGap[];
  evidence: ComplianceEvidence[];
}
```

### 3.2 Fix Reporting Engine
Update `packages/compliance/src/automation/reporting-engine.ts` to handle undefined values:

```typescript
// In generateReport method, add null checks:
if (!assessment) {
  throw new Error('No assessment found');
}

// Use assessment directly instead of spreading undefined
const reportData = {
  ...assessment,
  generatedAt: new Date()
};
```

## Phase 4: Update Compliance Scheduler

### 4.1 Fix DateTime Issues
Replace `toDate()` with `toJSDate()` in compliance-scheduler.ts

### 4.2 Add CronJob Import
Add at the top of compliance-scheduler.ts:
```typescript
import { CronJob } from 'node-cron';
```

## Phase 5: Database Migration

### 5.1 Generate Migration
```bash
cd packages/database
npx prisma migrate dev --name add-compliance-tables
```

### 5.2 Generate Client
```bash
npx prisma generate
```

## Phase 6: Testing

### 6.1 Unit Tests
Create tests for each new module
Test database operations
Test type safety

### 6.2 Integration Tests
Test compliance workflow end-to-end
Verify database relations work correctly

## Implementation Order

1. **Database Schema** - Update Prisma schema and run migrations
2. **Create Modules** - Build missing modules (evidence-collector, audit-logger)
3. **Fix Types** - Update interfaces and handle undefined values
4. **Update Scheduler** - Fix cron and datetime issues
5. **Test Everything** - Ensure all functionality works

## Dependencies Needed
```bash
cd packages/compliance
npm install node-cron
npm install -D @types/node-cron
```

## Notes
- All database operations should use the centralized prisma client
- Type safety is priority - use proper TypeScript types
- Add error handling for all database operations
- Consider adding indexes for performance on frequently queried fields
