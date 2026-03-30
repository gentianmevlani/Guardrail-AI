#!/usr/bin/env node

/**
 * Build Hook
 * 
 * Hooks into npm run build to enforce strictness
 */

const { buildEnforcer } = require('../src/lib/build-enforcer.js');

// This script should be called before build
// Add to package.json: "build": "node scripts/hook-build.js && npm run build:actual"

async function main() {
  const projectPath = process.cwd();
  await buildEnforcer.hookBuild(projectPath);
}

main();

