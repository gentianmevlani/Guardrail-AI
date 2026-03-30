-- CreateTable: Server-authoritative usage counters
-- This table is the source of truth for usage enforcement.
-- Local ~/.guardrail/usage.json is only a cache, never authoritative.

CREATE TABLE "usage_counters" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "scan_count" INTEGER NOT NULL DEFAULT 0,
    "reality_count" INTEGER NOT NULL DEFAULT 0,
    "agent_count" INTEGER NOT NULL DEFAULT 0,
    "gate_count" INTEGER NOT NULL DEFAULT 0,
    "fix_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one counter record per user per billing period
CREATE UNIQUE INDEX "usage_counters_user_id_period_start_key" ON "usage_counters"("user_id", "period_start");

-- Index for efficient lookups
CREATE INDEX "usage_counters_user_id_idx" ON "usage_counters"("user_id");
CREATE INDEX "usage_counters_period_start_idx" ON "usage_counters"("period_start");

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Signed usage tokens for anti-tamper caching
CREATE TABLE "usage_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "usage_tokens_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on token hash
CREATE UNIQUE INDEX "usage_tokens_token_hash_key" ON "usage_tokens"("token_hash");

-- Index for lookups
CREATE INDEX "usage_tokens_user_id_idx" ON "usage_tokens"("user_id");
CREATE INDEX "usage_tokens_expires_at_idx" ON "usage_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "usage_tokens" ADD CONSTRAINT "usage_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Offline usage queue for sync
CREATE TABLE "offline_usage_queue" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "machine_id" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3),
    "synced" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "offline_usage_queue_pkey" PRIMARY KEY ("id")
);

-- Index for sync operations
CREATE INDEX "offline_usage_queue_user_id_synced_idx" ON "offline_usage_queue"("user_id", "synced");
