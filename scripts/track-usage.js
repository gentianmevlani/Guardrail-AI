#!/usr/bin/env node

/**
 * Track Project Usage
 * 
 * Tracks codebase size for subscription management
 */

const { usageTracker } = require('../src/lib/usage-tracker');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  const tier = (process.argv[3] || 'free').toLowerCase();

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║            📊 Track Project Usage                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  try {
    console.log(`Tracking: ${projectPath}`);
    console.log(`Tier: ${tier}\n`);

    const usage = await usageTracker.trackProject(projectPath, tier);

    console.log('✅ Usage tracked successfully!\n');
    console.log('📊 Project Metrics:');
    console.log(`   Files: ${usage.metrics.files.toLocaleString()}`);
    console.log(`   Lines: ${usage.metrics.lines.toLocaleString()}`);
    console.log(`   Size: ${(usage.metrics.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Last Updated: ${usage.lastUpdated}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

