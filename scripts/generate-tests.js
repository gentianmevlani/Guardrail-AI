#!/usr/bin/env node

/**
 * Generate Tests CLI
 */

const { testGenerator } = require('../src/lib/test-generator');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const filePath = process.argv[2];
  const projectPath = process.argv[3] || process.cwd();
  const framework = process.argv[4];
  const write = process.argv.includes('--write');

  if (!filePath) {
    cliUtils.error('Usage: generate-tests <file-path> [project-path] [framework] [--write]');
    cliUtils.info('Framework: jest, vitest, mocha, jasmine');
    process.exit(1);
  }

  cliUtils.section('🧪 Test Generator');

  try {
    cliUtils.info(`Generating tests for: ${filePath}`);
    cliUtils.info(`Project: ${projectPath}\n`);

    const testSuite = await testGenerator.generateTests(filePath, projectPath, {
      framework: framework as any,
    });

    cliUtils.section('Generated Test Suite');
    console.log(`Framework: ${testSuite.framework}`);
    console.log(`Test Cases: ${testSuite.testCases.length}\n`);

    for (const testCase of testSuite.testCases) {
      console.log(`\n${testCase.name}`);
      console.log(`  Type: ${testCase.type}`);
      console.log(`  Description: ${testCase.description}`);
      console.log(`  Assertions: ${testCase.assertions.join(', ')}`);
    }

    if (write) {
      const outputPath = await testGenerator.writeTestFile(testSuite);
      cliUtils.success(`\nTest file written to: ${outputPath}`);
    } else {
      cliUtils.info('\nUse --write to save test file');
    }

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

