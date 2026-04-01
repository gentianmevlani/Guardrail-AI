-- Subscriptions: optional tier default and org billing link.
--
-- The original migration attempted new `usage_records` / org tables with UUID keys.
-- `20260101172826_init` already creates `usage_records` with `userId` (TEXT); using
-- `CREATE TABLE IF NOT EXISTS` skipped the new DDL but still ran indexes on `user_id`,
-- causing ERROR 42703. Organization tables are created with the correct TEXT/cuid shape
-- in `20260106010000_add_scans_findings_organizations`.

-- Add tier column to subscriptions if not exists (init may already define tier)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'tier') THEN
        ALTER TABLE "subscriptions" ADD COLUMN "tier" VARCHAR(50) DEFAULT 'free';
    END IF;
END $$;

-- Add organization_id for org-scoped billing (TEXT to match Organization.id / cuid)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'organization_id') THEN
        ALTER TABLE "subscriptions" ADD COLUMN "organization_id" TEXT;
    END IF;
END $$;
