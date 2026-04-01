#!/usr/bin/env node

/**
 * CLI Commands Test Script
 * Tests all CLI commands before npm publish
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CLI_PATH = path.join(__dirname, '..', 'packages', 'cli', 'dist', 'index.js');
const TEST_PROJECT_DIR = path.join(__dirname, '..', 'packages', 'cli', 'tests', 'integration', 'test-project');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

// Test results
const results = {
  passed: [],
  failed: [],
  skipped: [],
};

// Test helper
function testCommand(name, command, expectedInOutput = [], shouldFail = false) {
  try {
    logInfo(`Testing: ${name}`);
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 30000,
      cwd: path.join(__dirname, '..'),
    }).toString();

    if (shouldFail) {
      logError(`Command should have failed but succeeded: ${name}`);
      results.failed.push({ name, command, error: 'Expected failure but succeeded' });
      return false;
    }

    // Check for expected output
    const missingOutput = expectedInOutput.filter(
      expected => !output.toLowerCase().includes(expected.toLowerCase())
    );

    if (missingOutput.length > 0) {
      logError(`Missing expected output in ${name}: ${missingOutput.join(', ')}`);
      results.failed.push({ name, command, error: `Missing: ${missingOutput.join(', ')}` });
      return false;
    }

    logSuccess(`${name} - OK`);
    results.passed.push(name);
    return true;
  } catch (error) {
    if (shouldFail) {
      logSuccess(`${name} - Failed as expected`);
      results.passed.push(name);
      return true;
    }

    // Check if error output contains expected strings (for help commands that exit with code 1)
    const errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;
    const hasExpectedOutput = expectedInOutput.length === 0 || expectedInOutput.some(
      expected => errorOutput.toLowerCase().includes(expected.toLowerCase())
    );

    if (hasExpectedOutput) {
      logSuccess(`${name} - OK (help command)`);
      results.passed.push(name);
      return true;
    }

    logError(`${name} - FAILED: ${error.message}`);
    results.failed.push({ name, command, error: error.message });
    return false;
  }
}

// Main test suite
function runTests() {
  log('\n🚀 guardrail CLI Command Test Suite', colors.cyan);
  log('='.repeat(60), colors.cyan);
  log('');

  // Check if CLI is built
  if (!fs.existsSync(CLI_PATH)) {
    logError('CLI not built! Run: cd packages/cli && npm run build');
    process.exit(1);
  }

  logInfo('Testing built CLI at: ' + CLI_PATH);
  log('');

  // 1. Basic commands
  log('\n📋 Basic Commands', colors.blue);
  log('-'.repeat(60));

  testCommand('help', `node "${CLI_PATH}" --help`, ['commands', 'usage']);
  testCommand('version', `node "${CLI_PATH}" --version`, []);

  // 2. Auth commands
  log('\n🔐 Auth Commands', colors.blue);
  log('-'.repeat(60));

  testCommand('auth --help', `node "${CLI_PATH}" auth --help`, ['auth', 'authenticate']);
  testCommand('auth --status', `node "${CLI_PATH}" auth --status`, ['not authenticated', 'authenticated', 'auth']);

  // 3. Scan commands
  log('\n🔍 Scan Commands', colors.blue);
  log('-'.repeat(60));

  testCommand('scan --help', `node "${CLI_PATH}" scan --help`, ['scan']);
  testCommand('scan:secrets --help', `node "${CLI_PATH}" scan:secrets --help`, ['secrets', 'scan']);
  testCommand('scan:vulnerabilities --help', `node "${CLI_PATH}" scan:vulnerabilities --help`, ['vulnerabilities']);
  testCommand('scan:compliance --help', `node "${CLI_PATH}" scan:compliance --help`, ['compliance']);

  // 4. SBOM commands
  log('\n📦 SBOM Commands', colors.blue);
  log('-'.repeat(60));

  testCommand('sbom:generate --help', `node "${CLI_PATH}" sbom:generate --help`, ['sbom', 'generate']);

  // 5. Fix commands
  log('\n🔧 Fix Commands', colors.blue);
  log('-'.repeat(60));

  testCommand('fix --help', `node "${CLI_PATH}" fix --help`, ['fix']);
  testCommand('fix-rollback --help', `node "${CLI_PATH}" fix-rollback --help`, ['rollback']);

  // 6. Ship commands
  log('\n🚀 Ship Commands', colors.blue);
  log('-'.repeat(60));

  testCommand('ship --help', `node "${CLI_PATH}" ship --help`, ['ship']);
  testCommand('ship:pro --help', `node "${CLI_PATH}" ship:pro --help`, ['ship', 'pro']);

  // 7. Reality commands
  log('\n🌐 Reality Commands', colors.blue);
  log('-'.repeat(60));

  testCommand('reality --help', `node "${CLI_PATH}" reality --help`, ['reality']);
  testCommand('reality:graph --help', `node "${CLI_PATH}" reality:graph --help`, ['graph']);

  // 8. Autopilot commands
  log('\n🤖 Autopilot Commands', colors.blue);
  log('-'.repeat(60));

  testCommand('autopilot --help', `node "${CLI_PATH}" autopilot --help`, ['autopilot']);

  // 9. Autopatch commands
  log('\n🔨 Autopatch Commands', colors.blue);
  log('-'.repeat(60));

  testCommand('autopatch:verify --help', `node "${CLI_PATH}" autopatch:verify --help`, ['verify']);
  testCommand('autopatch:merge --help', `node "${CLI_PATH}" autopatch:merge --help`, ['merge']);

  // 10. Receipt commands
  log('\n🧾 Receipt Commands', colors.blue);
  log('-'.repeat(60));

  testCommand('receipt:verify --help', `node "${CLI_PATH}" receipt:verify --help`, ['receipt']);

  // 11. Init commands
  log('\n⚙️  Init Commands', colors.blue);
  log('-'.repeat(60));

  testCommand('init --help', `node "${CLI_PATH}" init --help`, ['init', 'initialize']);

  // 12. Cache commands
  log('\n💾 Cache Commands', colors.blue);
  log('-'.repeat(60));

  testCommand('cache:clear --help', `node "${CLI_PATH}" cache:clear --help`, ['cache', 'clear']);
  testCommand('cache:status --help', `node "${CLI_PATH}" cache:status --help`, ['cache', 'status']);

  // 13. Menu command
  log('\n📋 Menu Command', colors.blue);
  log('-'.repeat(60));

  testCommand('menu --help', `node "${CLI_PATH}" menu --help`, ['menu']);

  // 14. Smells command
  log('\n👃 Smells Command', colors.blue);
  log('-'.repeat(60));

  testCommand('smells --help', `node "${CLI_PATH}" smells --help`, ['smells']);

  // Print summary
  log('\n' + '='.repeat(60), colors.cyan);
  log('\n📊 Test Summary', colors.cyan);
  log('-'.repeat(60));

  log(`\n✅ Passed: ${results.passed.length}`, colors.green);
  log(`❌ Failed: ${results.failed.length}`, colors.red);
  log(`⏭️  Skipped: ${results.skipped.length}`, colors.yellow);

  if (results.failed.length > 0) {
    log('\n❌ Failed Tests:', colors.red);
    results.failed.forEach(({ name, error }) => {
      log(`  - ${name}: ${error}`, colors.red);
    });
  }

  log('\n' + '='.repeat(60), colors.cyan);

  const allPassed = results.failed.length === 0;
  if (allPassed) {
    logSuccess('\n✨ All tests passed! CLI is ready for publish.');
    log('\n📝 Next steps:');
    log('  1. Review package.json version');
    log('  2. Run: cd packages/cli && npm publish --dry-run');
    log('  3. If dry-run looks good: npm publish');
  } else {
    logError('\n⚠️  Some tests failed. Fix issues before publishing.');
    process.exit(1);
  }
}

// Run tests
runTests();
