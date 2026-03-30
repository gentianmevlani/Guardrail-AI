#!/usr/bin/env node
/**
 * Database Initial Migration Script
 * 
 * This script helps developers create the initial migration for a new database.
 * It is BLOCKED in production to prevent accidental schema changes.
 * 
 * Usage:
 *   node scripts/db-init-migration.js
 *   
 * What it does:
 *   1. Checks NODE_ENV is not production
 *   2. Runs prisma migrate dev to create initial migration
 *   3. Generates Prisma client
 */

const { execSync } = require('child_process');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

console.log('🗄️  Database Initial Migration Script');
console.log('=====================================\n');

// Block in production
if (isProduction) {
  console.error('❌ FATAL: This script cannot run in production!');
  console.error('   Use "prisma migrate deploy" to apply existing migrations.');
  console.error('   Create migrations in development only.\n');
  process.exit(1);
}

// Check for DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL environment variable is not set.');
  console.error('   Set it in your .env file or environment.\n');
  process.exit(1);
}

const databaseDir = path.join(__dirname, '..', 'packages', 'database');
const prismaDir = path.join(databaseDir, 'prisma');

console.log(`📁 Working directory: ${databaseDir}`);
console.log(`📁 Prisma directory: ${prismaDir}\n`);

try {
  // Check if migrations already exist
  const fs = require('fs');
  const migrationsDir = path.join(prismaDir, 'migrations');
  
  if (fs.existsSync(migrationsDir)) {
    const migrations = fs.readdirSync(migrationsDir).filter(f => f !== '.gitkeep');
    if (migrations.length > 0) {
      console.log('⚠️  Migrations already exist:');
      migrations.forEach(m => console.log(`   - ${m}`));
      console.log('\n   Use "pnpm db:migrate" to create a new migration.');
      console.log('   Use "pnpm db:migrate:deploy" to apply migrations.\n');
      process.exit(0);
    }
  }

  console.log('🔄 Creating initial migration...\n');
  
  execSync('npx prisma migrate dev --name init', {
    cwd: databaseDir,
    stdio: 'inherit',
    env: { ...process.env }
  });

  console.log('\n✅ Initial migration created successfully!');
  console.log('\n📝 Next steps:');
  console.log('   1. Review the migration in packages/database/prisma/migrations/');
  console.log('   2. Commit the migration to version control');
  console.log('   3. In production, migrations will be applied automatically via start.sh\n');

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.error('\n💡 Troubleshooting:');
  console.error('   - Check DATABASE_URL is correct');
  console.error('   - Ensure database server is running');
  console.error('   - Check for schema syntax errors\n');
  process.exit(1);
}
