#!/usr/bin/env node
/**
 * CI Check: Prevent Duplicate Entitlements Implementations
 * 
 * This script ensures that:
 * 1. No hand-maintained entitlements.js files exist in src/ directories
 * 2. The canonical source is packages/core/src/entitlements.ts
 * 3. bin/runners/lib/entitlements.js is the generated wrapper (not hand-maintained)
 * 
 * Run this in CI to prevent drift between TypeScript and JavaScript implementations.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Files that should NOT exist (hand-maintained JS entitlements)
const FORBIDDEN_FILES = [
  'src/lib/entitlements.js',
  'packages/core/src/entitlements.js',
  'packages/cli/src/entitlements.js',
  'apps/api/src/entitlements.js',
];

// The canonical TypeScript source
const CANONICAL_SOURCE = 'packages/core/src/entitlements.ts';

// The allowed generated wrapper
const ALLOWED_WRAPPER = 'bin/runners/lib/entitlements.js';
const WRAPPER_MARKER = 'AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY';

let exitCode = 0;

console.log('🔍 Checking for entitlements drift...\n');

// Check 1: Ensure canonical source exists
const canonicalPath = path.join(ROOT, CANONICAL_SOURCE);
if (!fs.existsSync(canonicalPath)) {
  console.error(`❌ FAIL: Canonical source missing: ${CANONICAL_SOURCE}`);
  console.error('   The TypeScript entitlements source must exist at this location.');
  exitCode = 1;
} else {
  console.log(`✅ Canonical source exists: ${CANONICAL_SOURCE}`);
}

// Check 2: Ensure no forbidden files exist
for (const file of FORBIDDEN_FILES) {
  const filePath = path.join(ROOT, file);
  if (fs.existsSync(filePath)) {
    console.error(`❌ FAIL: Forbidden file found: ${file}`);
    console.error('   Hand-maintained entitlements.js files are not allowed.');
    console.error('   Use the TypeScript source in packages/core/src/entitlements.ts');
    exitCode = 1;
  }
}

if (exitCode === 0) {
  console.log('✅ No forbidden entitlements.js files found');
}

// Check 3: Ensure the CLI wrapper is generated (not hand-maintained)
const wrapperPath = path.join(ROOT, ALLOWED_WRAPPER);
if (fs.existsSync(wrapperPath)) {
  const content = fs.readFileSync(wrapperPath, 'utf8');
  if (!content.includes(WRAPPER_MARKER)) {
    console.error(`❌ FAIL: CLI wrapper appears to be hand-maintained: ${ALLOWED_WRAPPER}`);
    console.error(`   The file must contain the marker: "${WRAPPER_MARKER}"`);
    console.error('   This ensures the file is the generated wrapper, not a duplicate implementation.');
    exitCode = 1;
  } else {
    console.log(`✅ CLI wrapper is properly marked as generated: ${ALLOWED_WRAPPER}`);
  }
} else {
  console.warn(`⚠️  WARN: CLI wrapper not found: ${ALLOWED_WRAPPER}`);
  console.warn('   This may be expected if the CLI is not yet set up.');
}

// Check 4: Search for any other entitlements.js files in src directories
const srcDirs = ['src', 'packages', 'apps'];
const foundFiles = [];

function searchForEntitlementsJs(dir, relativePath = '') {
  if (!fs.existsSync(dir)) return;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(relativePath, entry.name);
    
    // Skip node_modules and dist directories
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
      continue;
    }
    
    if (entry.isDirectory()) {
      searchForEntitlementsJs(fullPath, relPath);
    } else if (entry.name === 'entitlements.js' && relPath !== ALLOWED_WRAPPER) {
      foundFiles.push(relPath);
    }
  }
}

for (const srcDir of srcDirs) {
  searchForEntitlementsJs(path.join(ROOT, srcDir), srcDir);
}

// Also check bin directory but exclude the allowed wrapper
searchForEntitlementsJs(path.join(ROOT, 'bin'), 'bin');

// Filter out the allowed wrapper (normalize path separators)
const normalizePath = (p) => p.replace(/\\/g, '/');
const allowedWrapperNormalized = normalizePath(ALLOWED_WRAPPER);
const unexpectedFiles = foundFiles.filter(f => normalizePath(f) !== allowedWrapperNormalized);

if (unexpectedFiles.length > 0) {
  console.error('\n❌ FAIL: Unexpected entitlements.js files found:');
  for (const file of unexpectedFiles) {
    console.error(`   - ${file}`);
  }
  console.error('\n   All entitlements logic must be in packages/core/src/entitlements.ts');
  console.error('   Remove these files and import from @guardrail/core instead.');
  exitCode = 1;
} else {
  console.log('✅ No unexpected entitlements.js files found');
}

// Summary
console.log('\n' + '─'.repeat(50));
if (exitCode === 0) {
  console.log('✅ All entitlements drift checks passed!');
  console.log('   TypeScript is the single source of truth.');
} else {
  console.error('❌ Entitlements drift detected!');
  console.error('   Fix the issues above before merging.');
}

process.exit(exitCode);
