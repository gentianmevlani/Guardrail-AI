-- Secure API Keys Migration
-- Adds fields for secure server-side API key validation

-- Add prefix column for display (first 8-12 chars of key)
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "prefix" TEXT;

-- Add tierOverride for admin-granted tier overrides
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "tierOverride" TEXT;

-- Add revokedAt for soft delete (revocation tracking)
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

-- Create index on key column for fast hash lookups
CREATE INDEX IF NOT EXISTS "api_keys_key_idx" ON "api_keys"("key");

-- Create index on userId for listing user's keys
CREATE INDEX IF NOT EXISTS "api_keys_userId_idx" ON "api_keys"("userId");

-- Drop the old keyHash index if it exists (we now use key column for hash)
DROP INDEX IF EXISTS "api_keys_keyHash_idx";
