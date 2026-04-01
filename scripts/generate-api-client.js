#!/usr/bin/env node

/**
 * Generate API Client
 * 
 * Generate frontend API client from registered endpoints
 */

const { apiEndpointTracker } = require('../src/lib/api-endpoint-tracker.js');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         🔧 guardrail AI - API Client Generator              ║
║                                                              ║
║  Generate frontend API client from registered endpoints     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.argv[2] || process.cwd();
  const basePath = process.argv[3] || '/api/v1';
  const outputPath = process.argv[4] || path.join(projectPath, 'src', 'lib', 'api-client.ts');

  // Generate client code
  const code = apiEndpointTracker.generateAPIClient(basePath);

  // Write to file
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, code);

  console.log(`\n✅ API client generated!\n`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Base path: ${basePath}`);
  console.log(`   Endpoints: ${apiEndpointTracker.getEndpoints().length}\n`);
}

main();

