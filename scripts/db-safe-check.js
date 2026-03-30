#!/usr/bin/env node
/**
 * Database Safety Check Script
 * 
 * Validates that database operations are safe for the current environment.
 * Used by CI/CD and pre-commit hooks to prevent dangerous operations.
 */

const isProduction = process.env.NODE_ENV === 'production';
const allowDbPush = process.env.ALLOW_DB_PUSH === 'true';

const DANGEROUS_IN_PROD = [
  'db:push',
  'db:push:dev', 
  'migrate reset',
  'migrate dev',
  '--accept-data-loss',
  'prisma db push',
];

const args = process.argv.slice(2).join(' ');

console.log('🔒 Database Safety Check');
console.log('========================\n');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Command: ${args || '(none)'}\n`);

// Check for dangerous commands in production
if (isProduction) {
  for (const dangerous of DANGEROUS_IN_PROD) {
    if (args.includes(dangerous)) {
      console.error(`❌ BLOCKED: "${dangerous}" is not allowed in production!`);
      console.error('\n   Safe alternatives:');
      console.error('   - prisma migrate deploy (apply existing migrations)');
      console.error('   - prisma migrate status (check migration status)\n');
      process.exit(1);
    }
  }
  
  if (allowDbPush) {
    console.error('❌ BLOCKED: ALLOW_DB_PUSH=true is forbidden in production!');
    console.error('   Remove this environment variable.\n');
    process.exit(1);
  }
}

console.log('✅ Database operation is safe for this environment.\n');
process.exit(0);
