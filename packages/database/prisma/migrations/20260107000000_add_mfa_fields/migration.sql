-- AlterTable
ALTER TABLE "users" ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfa_secret" TEXT,
ADD COLUMN "mfa_backup_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "mfa_verified_at" TIMESTAMP(3);
