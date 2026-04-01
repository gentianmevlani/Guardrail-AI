-- CreateTable: Scans
CREATE TABLE IF NOT EXISTS "scans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "repository_id" TEXT,
    "project_path" TEXT,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "commit_sha" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "verdict" TEXT,
    "score" INTEGER,
    "files_scanned" INTEGER NOT NULL DEFAULT 0,
    "lines_scanned" INTEGER NOT NULL DEFAULT 0,
    "issues_found" INTEGER NOT NULL DEFAULT 0,
    "critical_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "info_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "error" TEXT,
    "error_details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable: Findings
CREATE TABLE IF NOT EXISTS "findings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scan_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "line" INTEGER NOT NULL,
    "column" INTEGER,
    "end_line" INTEGER,
    "end_column" INTEGER,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "code_snippet" TEXT,
    "suggestion" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "ai_explanation" TEXT,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "rule_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "findings_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: User LLM Keys
CREATE TABLE IF NOT EXISTS "user_llm_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scans_user_id_created_at_idx" ON "scans"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "scans_repository_id_idx" ON "scans"("repository_id");
CREATE INDEX IF NOT EXISTS "scans_status_idx" ON "scans"("status");

CREATE INDEX IF NOT EXISTS "findings_scan_id_idx" ON "findings"("scan_id");
CREATE INDEX IF NOT EXISTS "findings_type_idx" ON "findings"("type");
CREATE INDEX IF NOT EXISTS "findings_severity_idx" ON "findings"("severity");
CREATE INDEX IF NOT EXISTS "findings_file_idx" ON "findings"("file");

CREATE UNIQUE INDEX IF NOT EXISTS "user_llm_keys_user_id_provider_key" ON "user_llm_keys"("user_id", "provider");
CREATE INDEX IF NOT EXISTS "user_llm_keys_user_id_idx" ON "user_llm_keys"("user_id");
