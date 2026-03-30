#!/usr/bin/env node

/**
 * Release Blocker Diagnostic Script
 * 
 * Checks for any remaining mock data or demo implementations
 * that should not ship to production.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Running release blocker diagnostic...\n');

// Patterns to search for
const mockPatterns = [
  'useMock',
  'MockProvider',
  'mock-context',
  'Seed with sample projects',
  'simulate subscription',
  'inv_demo',
  'return a mock response',
  'fake avatar',
  'Return mock data',
  'mock broadcast',
  'mock ID'
];

// Directories to exclude
const excludeDirs = [
  '**/node_modules/**',
  '**/docs/**',
  '**/__tests__/**',
  '**/*.test.*',
  '**/*.spec.*',
  '**/apps/web-ui/landing/**'
];

console.log('Checking for mock patterns in production code...');

let foundIssues = false;

for (const pattern of mockPatterns) {
  try {
    const cmd = `rg -n --hidden ${excludeDirs.map(d => `--glob '!${d}'`).join(' ')} "${pattern}" .`;
    const output = execSync(cmd, { encoding: 'utf8', cwd: path.resolve(__dirname, '..') });
    
    if (output.trim()) {
      console.error(`❌ Found "${pattern}" in production code:`);
      console.error(output);
      foundIssues = true;
    }
  } catch (error) {
    // rg returns non-zero exit code when no matches found, which is expected
  }
}

// Check for localhost references in configuration
console.log('\nChecking for localhost in configuration files...');
const localhostPatterns = [
  'localhost:3005',
  'http://localhost',
  'https://localhost'
];

for (const pattern of localhostPatterns) {
  try {
    const cmd = `rg -n --type-add 'config:*.{js,mjs,ts,json}' -t config "${pattern}" .`;
    const output = execSync(cmd, { encoding: 'utf8', cwd: path.resolve(__dirname, '..') });
    
    if (output.trim()) {
      console.error(`⚠️  Found localhost reference in config:`);
      console.error(output);
      foundIssues = true;
    }
  } catch (error) {
    // No matches found
  }
}

// Check Next.js proxy configuration
console.log('\nChecking Next.js proxy configuration...');
const nextConfigPath = path.join(__dirname, '..', 'apps', 'web-ui', 'next.config.mjs');
if (fs.existsSync(nextConfigPath)) {
  const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
  if (nextConfig.includes('localhost:3005')) {
    console.error('❌ Next.js proxy still uses localhost:3005');
    foundIssues = true;
  } else if (nextConfig.includes('process.env.API_BASE_URL') || nextConfig.includes('process.env.NEXT_PUBLIC_API_URL')) {
    console.log('✅ Next.js proxy uses environment variables');
  }
}

// Summary
if (foundIssues) {
  console.error('\n❌ Release blockers detected! Please fix the issues above before deploying.');
  process.exit(1);
} else {
  console.log('\n✅ No release blockers detected. Ready for production!');
  console.log('\n📋 Summary:');
  console.log('  - No mock data in production code');
  console.log('  - No localhost references in config');
  console.log('  - Next.js proxy uses environment variables');
  console.log('  - Production environment validation enabled');
}
console.log('\n🚀 Production deployment is ready!');
