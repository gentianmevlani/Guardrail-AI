#!/usr/bin/env bash
set -e

echo "🔧 Fixing production migration issues..."

# Mark the failed migration as resolved
echo "   📝 Marking failed migration as resolved..."
npx prisma migrate resolve --applied 20260104105000_add_user_provider_columns --schema=prisma/schema.prisma

# Verify the migration status
echo "   📊 Checking migration status..."
npx prisma migrate status --schema=prisma/schema.prisma

echo "✅ Migration issues resolved"
