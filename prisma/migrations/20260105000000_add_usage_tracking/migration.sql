-- CreateTable: usage_records for metered billing
CREATE TABLE IF NOT EXISTS "usage_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint for user, type, period
CREATE UNIQUE INDEX IF NOT EXISTS "usage_records_user_type_period_unique" 
ON "usage_records"("user_id", "type", "period_start");

-- CreateIndex: For querying by user
CREATE INDEX IF NOT EXISTS "usage_records_user_id_idx" ON "usage_records"("user_id");

-- CreateIndex: For querying by period
CREATE INDEX IF NOT EXISTS "usage_records_period_start_idx" ON "usage_records"("period_start");

-- CreateTable: organizations for team billing
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "owner_id" UUID NOT NULL,
    "tier" VARCHAR(50) NOT NULL DEFAULT 'free',
    "stripe_customer_id" VARCHAR(255),
    "stripe_subscription_id" VARCHAR(255),
    "max_seats" INTEGER NOT NULL DEFAULT 1,
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique slug
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex: Stripe customer lookup
CREATE INDEX IF NOT EXISTS "organizations_stripe_customer_id_idx" ON "organizations"("stripe_customer_id");

-- CreateTable: organization_members for team management
CREATE TABLE IF NOT EXISTS "organization_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'member',
    "invited_by" UUID,
    "invited_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique membership
CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_org_user_unique" 
ON "organization_members"("organization_id", "user_id");

-- CreateIndex: For querying by user
CREATE INDEX IF NOT EXISTS "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateTable: organization_invites for pending invitations
CREATE TABLE IF NOT EXISTS "organization_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'member',
    "token" VARCHAR(255) NOT NULL,
    "invited_by" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Token lookup
CREATE UNIQUE INDEX IF NOT EXISTS "organization_invites_token_key" ON "organization_invites"("token");

-- CreateIndex: Email lookup within org
CREATE INDEX IF NOT EXISTS "organization_invites_org_email_idx" 
ON "organization_invites"("organization_id", "email");

-- Add tier column to subscriptions if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscriptions' AND column_name = 'tier') THEN
        ALTER TABLE "subscriptions" ADD COLUMN "tier" VARCHAR(50) DEFAULT 'free';
    END IF;
END $$;

-- Add organization_id column to subscriptions for org billing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'subscriptions' AND column_name = 'organization_id') THEN
        ALTER TABLE "subscriptions" ADD COLUMN "organization_id" UUID;
    END IF;
END $$;
