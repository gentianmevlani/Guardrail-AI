-- CreateTable: usage_records for metered billing
-- Matches Prisma model UsageRecord (@@map("usage_records"))
-- Column names are camelCase (no @map directives on fields)
CREATE TABLE IF NOT EXISTS "usage_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: For querying by user + time
CREATE INDEX IF NOT EXISTS "usage_records_userId_createdAt_idx"
ON "usage_records"("userId", "createdAt");

-- CreateIndex: For querying by project + time
CREATE INDEX IF NOT EXISTS "usage_records_projectId_createdAt_idx"
ON "usage_records"("projectId", "createdAt");

-- Foreign keys
ALTER TABLE "usage_records"
    DROP CONSTRAINT IF EXISTS "usage_records_userId_fkey";
ALTER TABLE "usage_records"
    ADD CONSTRAINT "usage_records_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usage_records"
    DROP CONSTRAINT IF EXISTS "usage_records_projectId_fkey";
ALTER TABLE "usage_records"
    ADD CONSTRAINT "usage_records_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
