#!/usr/bin/env node

/**
 * System Test
 * 
 * Validates that all systems are working correctly
 */

const { healthChecker } = require('../src/lib/health-checker.js');
const { performanceMonitor } = require('../src/lib/performance-monitor.js');

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         🧪 guardrail AI - System Test                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const tests = [
    {
      name: 'Health Check',
      test: async () => {
        const health = await healthChecker.checkHealth();
        return health.status === 'healthy' || health.status === 'degraded';
      },
    },
    {
      name: 'Performance Monitor',
      test: async () => {
        await performanceMonitor.trackCommand('test', async () => {
          return 'test';
        });
        return true;
      },
    },
    {
      name: 'File System Access',
      test: async () => {
        const fs = require('fs').promises;
        const path = require('path');
        const testPath = path.join(process.cwd(), '.guardrail', 'test');
        await fs.mkdir(path.dirname(testPath), { recursive: true });
        await fs.writeFile(testPath, 'test');
        await fs.unlink(testPath);
        return true;
      },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.test();
      if (result) {
        console.log(`✅ ${test.name}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check the output above.\n');
    process.exit(1);
  }
}

main();

