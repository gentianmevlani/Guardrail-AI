#!/usr/bin/env node

/**
 * Launch Checklist
 * 
 * Interactive checklist for pre-launch validation
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

const checklist = require('../LAUNCH-CHECKLIST.md');

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║            🚀 Project Launch Checklist                      ║
║                                                              ║
║  Validates your project is ready for production launch      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log('📋 See LAUNCH-CHECKLIST.md for complete checklist\n');
  console.log('💡 Run "npm run polish" first to find missing items\n');
  console.log('Press Ctrl+C to exit\n');

  const projectPath = process.argv[2] || process.cwd();
  console.log(`Project: ${projectPath}\n`);

  // Quick validation
  console.log('🔍 Quick validation...\n');

  const checks = [
    { name: 'Health check endpoint', file: /health/i, critical: true },
    { name: 'Error reporting', file: /sentry|error.*report/i, critical: true },
    { name: 'Structured logging', file: /pino|winston|structured/i, critical: true },
    { name: 'Error boundary', file: /ErrorBoundary/i, critical: false },
    { name: '.env.example', file: '.env.example', critical: false },
    { name: 'README.md', file: 'README.md', critical: false },
  ];

  const results = [];
  for (const check of checks) {
    const found = await findFile(projectPath, check.file);
    results.push({
      name: check.name,
      found,
      critical: check.critical,
    });
  }

  console.log('Results:\n');
  for (const result of results) {
    const icon = result.found ? '✅' : (result.critical ? '🔴' : '🟡');
    console.log(`   ${icon} ${result.name}`);
  }

  const criticalMissing = results.filter(r => r.critical && !r.found);
  if (criticalMissing.length > 0) {
    console.log(`\n⚠️  ${criticalMissing.length} critical item(s) missing!\n`);
    console.log('💡 Run "npm run polish" for detailed analysis\n');
  } else {
    console.log('\n✅ All critical items found!\n');
  }

  rl.close();
}

async function findFile(dir, pattern) {
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(item.name)) {
        if (await findFile(fullPath, pattern)) return true;
      } else if (item.isFile()) {
        if (typeof pattern === 'string') {
          if (item.name === pattern) return true;
        } else if (pattern.test(item.name) || pattern.test(fullPath)) {
          return true;
        }
      }
    }
  } catch {}
  return false;
}

main();

