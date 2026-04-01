-- Fix tenant table column names to match Prisma schema mappings
-- The original migration used camelCase but Prisma expects snake_case

-- Rename columns in tenants table
ALTER TABLE "tenants" 
  RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "tenants" 
  RENAME COLUMN "updatedAt" TO "updated_at";

-- Rename columns in tenant_users table
ALTER TABLE "tenant_users" 
  RENAME COLUMN "tenantId" TO "tenant_id";

ALTER TABLE "tenant_users" 
  RENAME COLUMN "userId" TO "user_id";

ALTER TABLE "tenant_users" 
  RENAME COLUMN "createdAt" TO "joined_at";

-- Drop the updatedAt column from tenant_users (not in schema)
ALTER TABLE "tenant_users" 
  DROP COLUMN IF EXISTS "updatedAt";

-- Drop the id column from tenant_users (uses composite key now)
-- First drop the primary key constraint
ALTER TABLE "tenant_users" 
  DROP CONSTRAINT IF EXISTS "tenant_users_pkey";

-- Add composite primary key
ALTER TABLE "tenant_users" 
  ADD PRIMARY KEY ("tenant_id", "user_id");

-- Drop the old id column
ALTER TABLE "tenant_users" 
  DROP COLUMN IF EXISTS "id";

-- Recreate indexes with new column names
DROP INDEX IF EXISTS "tenant_users_tenantId_idx";
DROP INDEX IF EXISTS "tenant_users_userId_idx";
CREATE INDEX IF NOT EXISTS "tenant_users_tenant_id_idx" ON "tenant_users"("tenant_id");
CREATE INDEX IF NOT EXISTS "tenant_users_user_id_idx" ON "tenant_users"("user_id");
