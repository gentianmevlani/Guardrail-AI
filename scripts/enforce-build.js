#!/usr/bin/env node

/**
 * Build Enforcer
 * 
 * Enforces strictness rules during build
 */

const { buildEnforcer } = require('../src/lib/build-enforcer.js');

async function main() {
  const projectPath = process.argv[2] || process.cwd();

  try {
    await buildEnforcer.hookBuild(projectPath);
    console.log('✅ Build checks passed!\n');
  } catch (error) {
    process.exit(1);
  }
}

main();

