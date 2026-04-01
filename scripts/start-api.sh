#!/bin/bash
set -e

# =============================================================================
# API Startup Script with Environment Validation
# =============================================================================

echo "🚀 Starting Guardrail API..."

# Validate environment variables
echo "🔍 Validating environment variables..."
node scripts/validate-env.js

# Run database migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy --schema=./packages/database/prisma/schema.prisma || {
  echo "❌ Database migration failed"
  exit 1
}

# Start the API
echo "✅ Starting API server..."
cd apps/api
# Use the built start.js if it exists, otherwise use index.js
if [ -f "dist/start.js" ]; then
  exec node dist/start.js
else
  exec node dist/index.js
fi
