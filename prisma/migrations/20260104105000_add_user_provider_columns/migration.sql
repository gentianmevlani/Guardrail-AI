-- AlterTable: Add provider and role columns to users table
-- Using DO block for idempotent column addition (PostgreSQL doesn't support IF NOT EXISTS for ADD COLUMN)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'provider') THEN
        ALTER TABLE "users" ADD COLUMN "provider" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'provider_id') THEN
        ALTER TABLE "users" ADD COLUMN "provider_id" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
    END IF;
END $$;
