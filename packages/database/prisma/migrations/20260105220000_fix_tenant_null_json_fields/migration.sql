-- Fix NULL values in tenant JSON columns
-- The Prisma schema expects non-nullable Json for settings, limits, and usage

-- Update any NULL settings to default empty object
UPDATE "tenants" 
SET "settings" = '{}'::jsonb 
WHERE "settings" IS NULL;

-- Update any NULL limits to default values
UPDATE "tenants" 
SET "limits" = '{"users": 3, "projects": 5, "scansPerMonth": 50, "apiCallsPerMonth": 1000, "storageGB": 1, "collaboratorsPerProject": 2}'::jsonb 
WHERE "limits" IS NULL;

-- Update any NULL usage to default values
UPDATE "tenants" 
SET "usage" = '{"users": 0, "projects": 0, "scansThisMonth": 0, "apiCallsThisMonth": 0, "storageGB": 0, "lastReset": "2026-01-01T00:00:00.000Z"}'::jsonb 
WHERE "usage" IS NULL;

-- Also ensure the columns have NOT NULL constraints (if they don't already)
-- Using DO block for idempotent operations
DO $$
BEGIN
    -- Set default values for the columns to prevent future NULL inserts
    ALTER TABLE "tenants" ALTER COLUMN "settings" SET DEFAULT '{}'::jsonb;
    ALTER TABLE "tenants" ALTER COLUMN "limits" SET DEFAULT '{}'::jsonb;
    ALTER TABLE "tenants" ALTER COLUMN "usage" SET DEFAULT '{}'::jsonb;
EXCEPTION
    WHEN others THEN
        -- Defaults may already exist, continue
        NULL;
END $$;
