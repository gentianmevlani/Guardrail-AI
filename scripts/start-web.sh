#!/bin/bash
set -e

# =============================================================================
# Web UI Startup Script with Environment Validation
# =============================================================================

echo "🚀 Starting Guardrail Web UI..."

# Validate environment variables (web-ui has different requirements)
echo "🔍 Validating environment variables..."

# Check required Next.js env vars
if [ -z "$NEXT_PUBLIC_API_URL" ]; then
  echo "❌ NEXT_PUBLIC_API_URL is required"
  exit 1
fi

if [ -z "$NEXT_PUBLIC_APP_URL" ]; then
  echo "❌ NEXT_PUBLIC_APP_URL is required"
  exit 1
fi

# Check for localhost in production
if [ "$NODE_ENV" = "production" ]; then
  if [[ "$NEXT_PUBLIC_API_URL" == *"localhost"* ]]; then
    echo "❌ NEXT_PUBLIC_API_URL should not use localhost in production"
    exit 1
  fi
  
  if [[ "$NEXT_PUBLIC_APP_URL" == *"localhost"* ]]; then
    echo "❌ NEXT_PUBLIC_APP_URL should not use localhost in production"
    exit 1
  fi
fi

echo "✅ Environment validation passed"

# Start the web UI
echo "✅ Starting Web UI..."
cd apps/web-ui
exec pnpm run start
