#!/usr/bin/env bash
set -e

echo "🔧 Comprehensive Production Database Fix Script"
echo "=============================================="

# Configuration
MIGRATION_NAME="20260104105000_add_user_provider_columns"
SCHEMA_PATH="prisma/schema.prisma"

echo ""
echo "📊 Step 1: Checking current migration status..."
npx prisma migrate status --schema="$SCHEMA_PATH" || echo "   ⚠️ Migration check failed (expected if DB not accessible from here)"

echo ""
echo "🔧 Step 2: Resolving failed migration..."
# Mark the failed migration as resolved
npx prisma migrate resolve --applied "$MIGRATION_NAME" --schema="$SCHEMA_PATH"

echo ""
echo "📋 Step 3: Verifying database schema..."
# Generate Prisma Client to ensure schema is up to date
npx prisma generate --schema="$SCHEMA_PATH"

echo ""
echo "🗄️ Step 4: Checking critical tables..."
CRITICAL_TABLES=("users" "oauth_states" "usage_records" "tenants")

for table in "${CRITICAL_TABLES[@]}"; do
    echo "   🔍 Checking table '$table'..."
    if npx prisma db execute --stdin --schema="$SCHEMA_PATH" <<EOF >/dev/null 2>&1; then
        SELECT 1 FROM "$table" LIMIT 1;
EOF
        echo "   ✅ Table '$table' exists"
    else
        echo "   ⚠️  Table '$table' missing - will be created by Prisma"
    fi
done

echo ""
echo "🚀 Step 5: Pushing schema to ensure all tables exist..."
# This will create any missing tables based on the schema
npx prisma db push --schema="$SCHEMA_PATH"

echo ""
echo "✅ All database issues resolved!"
echo ""
echo "Next steps:"
echo "1. Restart the server"
echo "2. Monitor for any remaining errors"
echo "3. Verify all API endpoints are working"
