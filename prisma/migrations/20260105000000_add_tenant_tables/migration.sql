-- CreateTable: tenants (using snake_case to match Prisma @map directives)
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "settings" JSONB DEFAULT '{}',
    "limits" JSONB DEFAULT '{}',
    "usage" JSONB DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tenant_users (using snake_case to match Prisma @map directives)
CREATE TABLE IF NOT EXISTS "tenant_users" (
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("tenant_id", "user_id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "tenants_domain_idx" ON "tenants"("domain");
CREATE INDEX IF NOT EXISTS "tenant_users_tenant_id_idx" ON "tenant_users"("tenant_id");
CREATE INDEX IF NOT EXISTS "tenant_users_user_id_idx" ON "tenant_users"("user_id");

-- Insert default tenant
INSERT INTO "tenants" ("id", "name", "domain", "plan", "settings", "limits", "usage", "status", "updated_at")
VALUES (
    'tenant-default',
    'Default Tenant',
    'default',
    'free',
    '{"features": ["scanning", "reports"], "limits": {"scans": 10, "projects": 5}}'::jsonb,
    '{"scans": 10, "projects": 5, "users": 5, "apiCalls": 1000}'::jsonb,
    '{"scans": 0, "projects": 0, "users": 0, "apiCalls": 0, "storageGB": 0, "lastReset": "2026-01-05T00:00:00.000Z"}'::jsonb,
    'active',
    NOW()
) ON CONFLICT ("id") DO NOTHING;
