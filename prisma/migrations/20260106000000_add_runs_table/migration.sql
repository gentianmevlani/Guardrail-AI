-- CreateTable
CREATE TABLE IF NOT EXISTS "runs" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "repository_id" TEXT,
    "repo" TEXT NOT NULL,
    "branch" TEXT,
    "commit_sha" TEXT,
    "verdict" TEXT DEFAULT 'pending',
    "score" INTEGER DEFAULT 0,
    "status" TEXT DEFAULT 'pending',
    "progress" INTEGER DEFAULT 0,
    "security_result" JSONB,
    "reality_result" JSONB,
    "guardrail_result" JSONB,
    "report_json" JSONB,
    "trace_url" TEXT,
    "video_url" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "runs_user_id_idx" ON "runs"("user_id");
CREATE INDEX IF NOT EXISTS "runs_repository_id_idx" ON "runs"("repository_id");
CREATE INDEX IF NOT EXISTS "runs_status_idx" ON "runs"("status");
CREATE INDEX IF NOT EXISTS "runs_created_at_idx" ON "runs"("created_at" DESC);

-- AddForeignKey (optional, depends on if users table exists)
-- ALTER TABLE "runs" ADD CONSTRAINT "runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
