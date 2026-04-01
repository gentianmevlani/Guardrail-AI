-- Add deduplication fields to Finding model
ALTER TABLE "findings" 
ADD COLUMN IF NOT EXISTS "occurrence_count" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "first_seen_at" TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS "deduplication_key" TEXT;

-- Add index for deduplication queries
CREATE INDEX IF NOT EXISTS "findings_deduplication_key_idx" ON "findings"("deduplication_key");
CREATE INDEX IF NOT EXISTS "findings_first_seen_at_idx" ON "findings"("first_seen_at");

-- Add retry fields to Scan model
ALTER TABLE "scans"
ADD COLUMN IF NOT EXISTS "retry_count" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "last_retry_at" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "max_retries" INTEGER DEFAULT 3;

-- Add index for retry queries
CREATE INDEX IF NOT EXISTS "scans_retry_status_idx" ON "scans"("retry_count", "status");
