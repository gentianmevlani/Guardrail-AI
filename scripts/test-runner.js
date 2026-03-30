#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_TYPES = {
  unit: 'jest --selectProjects unit',
  integration: 'jest --selectProjects integration',
  e2e: 'playwright test',
  coverage: 'jest --coverage',
  all: 'jest'
};

function printUsage() {
  console.log(`
Usage: node scripts/test-runner.js [options]

Options:
  --type <type>    Type of tests to run (unit, integration, e2e, coverage, all)
  --watch          Run tests in watch mode
  --verbose        Verbose output
  --ci             Run in CI mode
  --help           Show this help message

Examples:
  node scripts/test-runner.js --type unit
  node scripts/test-runner.js --type integration --watch
  node scripts/test-runner.js --type coverage --verbose
  node scripts/test-runner.js --type e2e --ci
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    type: 'all',
    watch: false,
    verbose: false,
    ci: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--type':
        options.type = args[++i];
        break;
      case '--watch':
        options.watch = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--ci':
        options.ci = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        printUsage();
        process.exit(1);
    }
  }

  return options;
}

function validateTestType(type) {
  if (!TEST_TYPES[type]) {
    console.error(`Invalid test type: ${type}`);
    console.error(`Valid types: ${Object.keys(TEST_TYPES).join(', ')}`);
    process.exit(1);
  }
}

function runCommand(command, options = {}) {
  try {
    console.log(`\n🧪 Running: ${command}\n`);
    execSync(command, {
      stdio: 'inherit',
      ...options
    });
  } catch (error) {
    console.error(`\n❌ Test failed with exit code ${error.status}\n`);
    process.exit(error.status);
  }
}

function checkDependencies() {
  const requiredFiles = [
    'jest.config.js',
    'package.json',
    'playwright.config.ts'
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      console.error(`❌ Required file not found: ${file}`);
      process.exit(1);
    }
  }
}

function setupTestEnvironment() {
  // Create test directories if they don't exist
  const testDirs = [
    'coverage',
    'playwright-report',
    'test-results'
  ];

  for (const dir of testDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Set environment variables
  process.env.NODE_ENV = 'test';
  
  if (process.env.CI) {
    process.env.CI = 'true';
  }
}

function generateCoverageBadge() {
  const coverageSummaryPath = path.join('coverage', 'coverage-summary.json');
  
  if (fs.existsSync(coverageSummaryPath)) {
    const summary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
    const total = summary.total;
    const coverage = Math.round(total.lines.pct);
    
    console.log(`\n📊 Coverage Summary:`);
    console.log(`   Lines: ${total.lines.pct}%`);
    console.log(`   Functions: ${total.functions.pct}%`);
    console.log(`   Branches: ${total.branches.pct}%`);
    console.log(`   Statements: ${total.statements.pct}%`);
    
    // Generate badge color based on coverage
    let color = 'red';
    if (coverage >= 80) color = 'green';
    else if (coverage >= 60) color = 'yellow';
    else if (coverage >= 40) color = 'orange';
    
    console.log(`\n🏆 Coverage Badge: ![Coverage](https://img.shields.io/badge/coverage-${coverage}%25-${color})`);
  }
}

function main() {
  const options = parseArgs();
  
  console.log('🚀 guardrail Test Runner\n');
  
  // Validate inputs
  validateTestType(options.type);
  checkDependencies();
  
  // Setup environment
  setupTestEnvironment();
  
  // Build command
  let command = TEST_TYPES[options.type];
  
  if (options.watch && options.type !== 'e2e') {
    command += ' --watch';
  }
  
  if (options.verbose) {
    command += ' --verbose';
  }
  
  if (options.ci) {
    if (options.type === 'e2e') {
      command += ' --reporter=junit --reporter=json';
    } else {
      command += ' --ci --coverage --watchAll=false';
    }
  }
  
  // Run tests
  const startTime = Date.now();
  runCommand(command);
  const duration = Date.now() - startTime;
  
  // Post-test actions
  if (options.type === 'coverage' || (options.ci && options.type !== 'e2e')) {
    generateCoverageBadge();
  }
  
  console.log(`\n✅ All tests passed in ${(duration / 1000).toFixed(2)}s\n`);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  TEST_TYPES,
  runCommand,
  checkDependencies,
  setupTestEnvironment,
  generateCoverageBadge
};
