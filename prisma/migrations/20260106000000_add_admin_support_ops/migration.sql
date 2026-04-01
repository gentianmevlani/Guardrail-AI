-- Add Admin & Support Ops Module Tables
-- Migration: 20260106000000_add_admin_support_ops

-- Admin audit log for tracking all admin actions
CREATE TABLE "admin_audit_log" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetUserId" TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  
  CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- Indexes for audit log queries
CREATE INDEX "admin_audit_log_actorUserId_timestamp_idx" ON "admin_audit_log"("actorUserId", "timestamp" DESC);
CREATE INDEX "admin_audit_log_targetUserId_timestamp_idx" ON "admin_audit_log"("targetUserId", "timestamp" DESC);
CREATE INDEX "admin_audit_log_action_timestamp_idx" ON "admin_audit_log"("action", "timestamp" DESC);

-- Impersonation sessions for support mode
CREATE TABLE "impersonation_sessions" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "impersonationToken" TEXT NOT NULL UNIQUE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  
  CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- Indexes for impersonation queries
CREATE INDEX "impersonation_sessions_actorUserId_idx" ON "impersonation_sessions"("actorUserId");
CREATE INDEX "impersonation_sessions_targetUserId_idx" ON "impersonation_sessions"("targetUserId");
CREATE INDEX "impersonation_sessions_token_idx" ON "impersonation_sessions"("impersonationToken");
CREATE INDEX "impersonation_sessions_active_idx" ON "impersonation_sessions"("isActive", "startedAt" DESC);

-- Support notes for internal communication
CREATE TABLE "support_notes" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isInternal" BOOLEAN NOT NULL DEFAULT true,
  
  CONSTRAINT "support_notes_pkey" PRIMARY KEY ("id")
);

-- Indexes for support notes
CREATE INDEX "support_notes_targetUserId_idx" ON "support_notes"("targetUserId", "createdAt" DESC);
CREATE INDEX "support_notes_actorUserId_idx" ON "support_notes"("actorUserId", "createdAt" DESC);

-- Broadcast email jobs table
CREATE TABLE "broadcast_jobs" (
  "id" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "htmlContent" TEXT NOT NULL,
  "textContent" TEXT,
  "audienceFilter" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "totalRecipients" INTEGER,
  "sentCount" INTEGER DEFAULT 0,
  "failedCount" INTEGER DEFAULT 0,
  "errorMessage" TEXT,
  "metadata" JSONB,
  
  CONSTRAINT "broadcast_jobs_pkey" PRIMARY KEY ("id")
);

-- Indexes for broadcast jobs
CREATE INDEX "broadcast_jobs_status_idx" ON "broadcast_jobs"("status", "createdAt" DESC);
CREATE INDEX "broadcast_jobs_createdBy_idx" ON "broadcast_jobs"("createdBy", "createdAt" DESC);

-- Broadcast email recipients tracking
CREATE TABLE "broadcast_recipients" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, skipped
  "sentAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "retryCount" INTEGER DEFAULT 0,
  
  CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- Indexes for broadcast recipients
CREATE INDEX "broadcast_recipients_jobId_idx" ON "broadcast_recipients"("jobId", "status");
CREATE INDEX "broadcast_recipients_userId_idx" ON "broadcast_recipients"("userId");

-- Foreign key constraints
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "support_notes" ADD CONSTRAINT "support_notes_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_notes" ADD CONSTRAINT "support_notes_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "broadcast_jobs" ADD CONSTRAINT "broadcast_jobs_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "broadcast_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
