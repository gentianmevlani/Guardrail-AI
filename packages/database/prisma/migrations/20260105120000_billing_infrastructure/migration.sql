-- Billing Infrastructure Migration
-- Adds license keys, invoices, billing events, and updates usage tracking

-- ==========================================
-- LICENSE KEYS
-- ==========================================

CREATE TABLE IF NOT EXISTS "license_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'pro',
    "status" TEXT NOT NULL DEFAULT 'active',
    "activations" INTEGER NOT NULL DEFAULT 0,
    "maxActivations" INTEGER NOT NULL DEFAULT 3,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "license_keys_key_key" ON "license_keys"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "license_keys_keyHash_key" ON "license_keys"("keyHash");
CREATE INDEX IF NOT EXISTS "license_keys_userId_idx" ON "license_keys"("userId");
CREATE INDEX IF NOT EXISTS "license_keys_status_idx" ON "license_keys"("status");

-- ==========================================
-- LICENSE ACTIVATIONS (Device/IP tracking)
-- ==========================================

CREATE TABLE IF NOT EXISTS "license_activations" (
    "id" TEXT NOT NULL,
    "licenseKeyId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "machineId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "hostname" TEXT,
    "platform" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_activations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "license_activations_licenseKeyId_idx" ON "license_activations"("licenseKeyId");
CREATE UNIQUE INDEX IF NOT EXISTS "license_activations_licenseKeyId_fingerprint_key" ON "license_activations"("licenseKeyId", "fingerprint");

-- ==========================================
-- INVOICES (Local copy synced from Stripe)
-- ==========================================

CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "stripeInvoiceId" TEXT,
    "stripeCustomerId" TEXT,
    "number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "amountDue" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "hostedInvoiceUrl" TEXT,
    "invoicePdf" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_stripeInvoiceId_key" ON "invoices"("stripeInvoiceId");
CREATE INDEX IF NOT EXISTS "invoices_userId_idx" ON "invoices"("userId");
CREATE INDEX IF NOT EXISTS "invoices_subscriptionId_idx" ON "invoices"("subscriptionId");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");

-- ==========================================
-- BILLING EVENTS (Audit Trail)
-- ==========================================

CREATE TABLE IF NOT EXISTS "billing_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "subscriptionId" TEXT,
    "invoiceId" TEXT,
    "licenseKeyId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventSource" TEXT NOT NULL DEFAULT 'system',
    "stripeEventId" TEXT,
    "previousState" JSONB,
    "newState" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_events_stripeEventId_key" ON "billing_events"("stripeEventId");
CREATE INDEX IF NOT EXISTS "billing_events_userId_idx" ON "billing_events"("userId");
CREATE INDEX IF NOT EXISTS "billing_events_eventType_idx" ON "billing_events"("eventType");
CREATE INDEX IF NOT EXISTS "billing_events_createdAt_idx" ON "billing_events"("createdAt");

-- ==========================================
-- USAGE LOGS (Enhanced tracking)
-- ==========================================

CREATE TABLE IF NOT EXISTS "usage_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "usage_logs_userId_periodStart_idx" ON "usage_logs"("userId", "periodStart");
CREATE INDEX IF NOT EXISTS "usage_logs_type_idx" ON "usage_logs"("type");
CREATE UNIQUE INDEX IF NOT EXISTS "usage_logs_userId_type_periodStart_key" ON "usage_logs"("userId", "type", "periodStart");

-- ==========================================
-- UPDATE SUBSCRIPTIONS TABLE
-- ==========================================

-- Add new columns if they don't exist
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "priceId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "quantity" INTEGER DEFAULT 1;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "trialEnd" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- ==========================================
-- TEAM SEATS (for Team plan)
-- ==========================================

CREATE TABLE IF NOT EXISTS "team_seats" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_seats_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "team_seats_subscriptionId_idx" ON "team_seats"("subscriptionId");
CREATE INDEX IF NOT EXISTS "team_seats_userId_idx" ON "team_seats"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "team_seats_subscriptionId_email_key" ON "team_seats"("subscriptionId", "email");

-- ==========================================
-- FOREIGN KEY CONSTRAINTS
-- ==========================================

ALTER TABLE "license_keys" 
    DROP CONSTRAINT IF EXISTS "license_keys_userId_fkey";
ALTER TABLE "license_keys" 
    ADD CONSTRAINT "license_keys_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "license_activations" 
    DROP CONSTRAINT IF EXISTS "license_activations_licenseKeyId_fkey";
ALTER TABLE "license_activations" 
    ADD CONSTRAINT "license_activations_licenseKeyId_fkey" 
    FOREIGN KEY ("licenseKeyId") REFERENCES "license_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices" 
    DROP CONSTRAINT IF EXISTS "invoices_userId_fkey";
ALTER TABLE "invoices" 
    ADD CONSTRAINT "invoices_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices" 
    DROP CONSTRAINT IF EXISTS "invoices_subscriptionId_fkey";
ALTER TABLE "invoices" 
    ADD CONSTRAINT "invoices_subscriptionId_fkey" 
    FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "usage_logs" 
    DROP CONSTRAINT IF EXISTS "usage_logs_userId_fkey";
ALTER TABLE "usage_logs" 
    ADD CONSTRAINT "usage_logs_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_seats" 
    DROP CONSTRAINT IF EXISTS "team_seats_subscriptionId_fkey";
ALTER TABLE "team_seats" 
    ADD CONSTRAINT "team_seats_subscriptionId_fkey" 
    FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_seats" 
    DROP CONSTRAINT IF EXISTS "team_seats_userId_fkey";
ALTER TABLE "team_seats" 
    ADD CONSTRAINT "team_seats_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
