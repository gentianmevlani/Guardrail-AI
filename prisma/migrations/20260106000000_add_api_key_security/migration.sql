-- Alter table
ALTER TABLE "api_keys" ADD COLUMN     "allowedIpCidrs" TEXT[],
ADD COLUMN     "allowedCountries" TEXT[],
ADD COLUMN     "allowedHoursUtc" JSONB,
ADD COLUMN     "sensitiveScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "fingerprintHash" TEXT,
ADD COLUMN     "lastFingerprint" TEXT,
ADD COLUMN     "requestsPerDay" INTEGER DEFAULT -1,
ADD COLUMN     "expensivePerDay" INTEGER DEFAULT -1,
ADD COLUMN     "currentDayRequests" INTEGER DEFAULT 0,
ADD COLUMN     "currentDayExpensive" INTEGER DEFAULT 0,
ADD COLUMN     "lastDayReset" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "rotatedFromId" TEXT,
ADD COLUMN     "rotationOverlapDays" INTEGER DEFAULT 0;

-- Add indexes
CREATE INDEX "api_keys_rotatedFromId_idx" ON "api_keys"("rotatedFromId");

-- Add foreign key constraint for rotation
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_rotatedFromId_fkey') THEN
        ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_rotatedFromId_fkey" FOREIGN KEY ("rotatedFromId") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Add default values for existing records
UPDATE "api_keys" SET 
  "allowedIpCidrs" = ARRAY[]::TEXT[],
  "allowedCountries" = ARRAY[]::TEXT[],
  "sensitiveScopes" = ARRAY[]::TEXT[],
  "requestsPerDay" = -1,
  "expensivePerDay" = -1,
  "currentDayRequests" = 0,
  "currentDayExpensive" = 0,
  "lastDayReset" = CURRENT_TIMESTAMP,
  "rotationOverlapDays" = 0
WHERE "allowedIpCidrs" IS NULL;
