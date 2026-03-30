#!/usr/bin/env node

/**
 * Validate Paths
 * 
 * Validate API paths between frontend and backend
 */

const { pathValidator } = require('../src/lib/path-validator.js');
const { apiEndpointTracker } = require('../src/lib/api-endpoint-tracker.js');

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         ✅ guardrail AI - Path Validator                     ║
║                                                              ║
║  Validating API paths between frontend and backend          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.argv[2] || process.cwd();
  const autoFix = process.argv.includes('--fix');

  // Show registered endpoints
  const endpoints = apiEndpointTracker.getEndpoints();
  console.log(`\n📋 Registered API Endpoints (${endpoints.length}):\n`);
  endpoints.forEach(endpoint => {
    console.log(`   ${endpoint.method.padEnd(6)} ${endpoint.fullPath}`);
  });

  // Validate paths
  console.log('\n🔍 Validating frontend paths...\n');
  const result = pathValidator.validateFrontendPaths(projectPath);

  if (result.valid && result.warnings.length === 0) {
    console.log('✅ All paths are valid!\n');
    return;
  }

  // Show errors
  if (result.errors.length > 0) {
    console.log(`❌ Found ${result.errors.length} error(s):\n`);
    result.errors.forEach(error => {
      console.log(`   File: ${error.file}:${error.line || '?'}`);
      console.log(`   Path: ${error.method} ${error.path}`);
      console.log(`   Issue: ${error.issue}`);
      if (error.suggestion) {
        console.log(`   💡 Suggestion: ${error.suggestion}`);
      }
      console.log('');
    });
  }

  // Show warnings
  if (result.warnings.length > 0) {
    console.log(`⚠️  Found ${result.warnings.length} warning(s):\n`);
    result.warnings.forEach(warning => {
      console.log(`   File: ${warning.file}:${warning.line || '?'}`);
      console.log(`   Path: ${warning.path}`);
      console.log(`   Issue: ${warning.issue}`);
      console.log('');
    });
  }

  // Auto-fix if requested
  if (autoFix && result.errors.length > 0) {
    console.log('🔧 Attempting to auto-fix...\n');
    // Would implement auto-fix logic here
    console.log('Auto-fix feature coming soon!\n');
  }
}

main();

