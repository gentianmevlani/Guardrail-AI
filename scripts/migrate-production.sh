#!/bin/bash

# Database Migration Script for Railway
# This script runs Prisma migrations on the production database

set -e

echo "🚀 Starting database migration..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set"
  exit 1
fi

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Seed the database if needed
echo "🌱 Seeding database..."
npm run db:seed || echo "⚠️ Seed script not found or failed"

echo "✅ Database migration completed successfully!"
