/**
<<<<<<< HEAD
 * Integration tests for the Guardrail CLI (Playwright test runner; spawns real Node processes).
 * Entry point is `bin/guardrail.js` (loads `dist/cli.js` and calls `runCLI`).
 */

import { execSync } from 'child_process';
=======
 * Integration Tests for CLI New Features
 * Tests interactive menu, arrow navigation, Playwright auto-installation, and extended functionality
 */

import { execSync, spawn } from 'child_process';
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { test, expect } from '@playwright/test';

<<<<<<< HEAD
const CLI_PATH = join(__dirname, '../../bin/guardrail.js');
const TEST_PROJECT_DIR = join(__dirname, 'test-project');

test.describe.configure({ mode: 'serial' });

function setupTestProject(): void {
  if (existsSync(TEST_PROJECT_DIR)) {
    rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_PROJECT_DIR, { recursive: true });

  require('fs').writeFileSync(
    join(TEST_PROJECT_DIR, 'package.json'),
    JSON.stringify(
      { name: 'test-project', version: '1.0.0',
        dependencies: { express: '^4.18.0' } },
      null,
      2
    )
  );

  require('fs').writeFileSync(
    join(TEST_PROJECT_DIR, 'index.js'),
    'const express = require("express");\nconst app = express();\napp.listen(3000);'
  );

  require('fs').writeFileSync(
    join(TEST_PROJECT_DIR, '.env'),
    'API_KEY=test_key_1234567890123456789012345678901234\n'
  );
}

test.describe('CLI integration (current entry)', () => {
  test.beforeEach(async () => {
    setupTestProject();
  });

  test.afterEach(async () => {
=======
const CLI_PATH = join(__dirname, '../../packages/cli/dist/index.js');
const TEST_PROJECT_DIR = join(__dirname, 'test-project');

test.describe('CLI Integration Tests', () => {
  test.beforeEach(async () => {
    // Clean up and create test project
    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_PROJECT_DIR, { recursive: true });
    
    // Create basic package.json
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        express: '^4.18.0',
        lodash: '^4.17.21'
      }
    };
    require('fs').writeFileSync(
      join(TEST_PROJECT_DIR, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create basic files
    require('fs').writeFileSync(
      join(TEST_PROJECT_DIR, 'index.js'),
      'const express = require("express");\nconst app = express();\napp.listen(3000);'
    );
    
    require('fs').writeFileSync(
      join(TEST_PROJECT_DIR, '.env'),
      'API_KEY=test_key_1234567890123456789012345678901234\n'
    );
  });

  test.afterEach(async () => {
    // Clean up test project
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

<<<<<<< HEAD
  test('CLI launcher and dist exist', () => {
    expect(existsSync(CLI_PATH)).toBe(true);
    expect(existsSync(join(__dirname, '../../dist/cli.js'))).toBe(true);
=======
  test('CLI builds successfully', () => {
    expect(existsSync(CLI_PATH)).toBe(true);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  });

  test('CLI shows help', async () => {
    const result = execSync(`node "${CLI_PATH}" --help`, { encoding: 'utf8' });
<<<<<<< HEAD
    expect(result).toContain('GUARDRAIL');
    expect(result).toContain('guardrail scan');
    expect(result).toContain('guardrail guard');
    expect(result).toContain('guardrail score');
    expect(result).toContain('guardrail status');
    expect(result).toContain('guardrail audit');
  });

  test('CLI prints version', async () => {
    const result = execSync(`node "${CLI_PATH}" --version`, { encoding: 'utf8' });
    expect(result).toMatch(/guardrail v\d+\.\d+\.\d+/);
  });

  test('scan with JSON output completes', async () => {
    const result = execSync(
      `node "${CLI_PATH}" scan "${TEST_PROJECT_DIR}" --format json --quiet`,
      { encoding: 'utf8', timeout: 60000 }
    );
    const parsed = JSON.parse(result.trim());
    expect(Array.isArray(parsed)).toBe(true);
  });

  test('status lists engines', async () => {
    const result = execSync(`node "${CLI_PATH}" status`, { encoding: 'utf8', timeout: 15000 });
    expect(result).toContain('Engine Status');
    expect(result).toMatch(/engines|enabled/i);
  });

  test('unknown command exits with error', async () => {
    expect(() => {
      execSync(`node "${CLI_PATH}" not-a-real-command`, { encoding: 'utf8' });
    }).toThrow();
  });
});

test.describe('CLI error handling', () => {
  test.beforeEach(async () => {
    setupTestProject();
  });

  test.afterEach(async () => {
    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  test('scan tolerates malformed package.json when other files are scannable', async () => {
    require('fs').writeFileSync(
      join(TEST_PROJECT_DIR, 'package.json'),
      '{ "name": "test", "invalid": }'
    );
    require('fs').writeFileSync(join(TEST_PROJECT_DIR, 'ok.js'), 'export const x = 1;\n');

    const result = execSync(
      `node "${CLI_PATH}" scan "${TEST_PROJECT_DIR}" --format json --quiet`,
      { encoding: 'utf8', timeout: 60000 }
    );
    expect(result.length).toBeGreaterThan(0);
    JSON.parse(result.trim());
  });

  test('scan completes with a large file present', async () => {
    require('fs').writeFileSync(
      join(TEST_PROJECT_DIR, 'large-file.js'),
      'x'.repeat(1_000_000)
    );

    const result = execSync(
      `node "${CLI_PATH}" scan "${TEST_PROJECT_DIR}" --format json --quiet`,
      { encoding: 'utf8', timeout: 120000 }
    );
    expect(result.length).toBeGreaterThan(0);
    JSON.parse(result.trim());
=======
    expect(result).toContain('guardrail AI - Security scanning for your codebase');
    expect(result).toContain('Commands:');
    expect(result).toContain('menu');
    expect(result).toContain('scan:secrets');
    expect(result).toContain('reality');
  });

  test('Interactive menu displays correctly', async () => {
    // Test that menu can be displayed (non-interactive mode)
    const result = execSync(`node "${CLI_PATH}" menu`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    expect(result).toContain('Interactive menu disabled');
  });

  test('Scan secrets command works', async () => {
    const result = execSync(`node "${CLI_PATH}" scan:secrets --path "${TEST_PROJECT_DIR}" --format json`, { 
      encoding: 'utf8',
      timeout: 10000 
    });
    
    // Should not crash and should produce JSON output
    expect(result).toContain('projectPath');
    expect(result).toContain('scanType');
    expect(result).toContain('findings');
  });

  test('Scan vulnerabilities command works', async () => {
    const result = execSync(`node "${CLI_PATH}" scan:vulnerabilities --path "${TEST_PROJECT_DIR}" --format json`, { 
      encoding: 'utf8',
      timeout: 10000 
    });
    
    expect(result).toContain('projectPath');
    expect(result).toContain('scanType');
    expect(result).toContain('findings');
  });

  test('Auth command works', async () => {
    const result = execSync(`node "${CLI_PATH}" auth --status`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(result).toContain('NOT AUTHENTICATED');
  });

  test('Init command works', async () => {
    const result = execSync(`node "${CLI_PATH}" init --path "${TEST_PROJECT_DIR}" --template startup --help`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(result).toContain('Initialize guardrail in a project');
  });

  test('Ship command help works', async () => {
    const result = execSync(`node "${CLI_PATH}" ship --help`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(result).toContain('Ship Check');
    expect(result).toContain('Plain English audit');
  });

  test('Reality command help works', async () => {
    const result = execSync(`node "${CLI_PATH}" reality --help`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(result).toContain('Reality Mode');
    expect(result).toContain('Browser testing');
    expect(result).toContain('--url');
    expect(result).toContain('--flow');
  });

  test('Cache commands work', async () => {
    const statusResult = execSync(`node "${CLI_PATH}" cache:status`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(statusResult).toContain('Cache Statistics');
    
    const clearResult = execSync(`node "${CLI_PATH}" cache:clear`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(clearResult).toContain('Cache cleared');
  });

  test('SBOM generation help works', async () => {
    const result = execSync(`node "${CLI_PATH}" sbom:generate --help`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(result).toContain('Software Bill of Materials');
    expect(result).toContain('--format');
  });

  test('Compliance scan help works', async () => {
    const result = execSync(`node "${CLI_PATH}" scan:compliance --help`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(result).toContain('Compliance assessment');
    expect(result).toContain('--framework');
  });

  test('Fix command help works', async () => {
    const result = execSync(`node "${CLI_PATH}" fix --help`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(result).toContain('Fix issues');
    expect(result).toContain('AI-powered analysis');
  });

  test('Autopilot command help works', async () => {
    const result = execSync(`node "${CLI_PATH}" autopilot --help`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(result).toContain('Autopilot');
    expect(result).toContain('batch remediation');
  });

  test('CLI handles invalid commands gracefully', async () => {
    const result = execSync(`node "${CLI_PATH}" invalid-command`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(result).toContain('Unknown command');
    expect(result).toContain('invalid-command');
  });

  test('CLI handles missing arguments gracefully', async () => {
    const result = execSync(`node "${CLI_PATH}" scan:secrets --path`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(result).toContain('error: missing required argument');
    expect(result).toContain('--path');
  });

  test('CLI version information', async () => {
    const result = execSync(`node "${CLI_PATH}" --version`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(result).toMatch(/\d+\.\d+\.\d+/); // Version format like 2.4.13
  });

  test('CLI handles missing project path', async () => {
    // Create a non-existent directory
    const nonExistentPath = join(TEST_PROJECT_DIR, 'non-existent');
    
    const result = execSync(`node "${CLI_PATH}" scan:secrets --path "${nonExistentPath}"`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    // Should handle gracefully
    expect(result).toContain('ENOENT') || expect(result).toContain('no such file or directory');
  });

  test('CLI handles permission errors gracefully', async () => {
    // Create a file instead of directory to trigger permission error
    const filePath = join(TEST_PROJECT_DIR, 'not-a-directory.txt');
    require('fs').writeFileSync(filePath, 'test');
    
    const result = execSync(`node "${CLI_PATH}" scan:secrets --path "${filePath}"`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(result).toContain('ENOTDIR') || expect(result).toContain('not a directory');
  });
});

test.describe('CLI Advanced Features Integration Tests', () => {
  test('Enhanced vulnerability scanning types', async () => {
    // Test that the enhanced vulnerability scanning commands exist and don't crash
    const commands = [
      'scan:vulnerabilities-enhanced --help',
      'scan:vulnerabilities-osv --help'
    ];
    
    for (const cmd of commands) {
      const result = execSync(`node "${CLI_PATH}" ${cmd}`, { 
        encoding: 'utf8',
        timeout: 5000 
      });
      
      expect(result).toContain('Enterprise-grade');
      expect(result).toContain('vulnerability detection');
    }
  });

  test('CLI supports all expected commands', async () => {
    const result = execSync(`node "${CLI_PATH}" --help`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    const expectedCommands = [
      'auth',
      'scan',
      'scan:secrets',
      'scan:vulnerabilities',
      'scan:compliance',
      'sbom:generate',
      'smells',
      'fix',
      'fix-rollback',
      'ship',
      'ship:pro',
      'reality',
      'autopilot',
      'init',
      'cache:clear',
      'cache:status',
      'menu',
      'help'
    ];
    
    for (const cmd of expectedCommands) {
      expect(result).toContain(cmd);
    }
  });

  test('CLI command descriptions are present', async () => {
    const result = execSync(`node "${CLI_PATH}" --help`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    const expectedDescriptions = [
      'Authenticate with your guardrail API key',
      'Run security scans on the codebase',
      'Scan for hardcoded secrets and credentials',
      'Scan dependencies for known vulnerabilities',
      'Run compliance assessment',
      'Generate Software Bill of Materials',
      'Analyze code smells and technical debt',
      'Fix issues with AI-powered analysis',
      'Rollback fixes to a previous backup',
      'Ship Check - Plain English audit',
      'Pro Ship Check - Comprehensive scanning',
      'Reality Mode - Browser testing',
      'Autopilot batch remediation',
      'Initialize guardrail in a project',
      'Clear the guardrail cache',
      'Show cache statistics',
      'Open interactive menu',
      'display help for command'
    ];
    
    for (const desc of expectedDescriptions) {
      expect(result).toContain(desc);
    }
  });
});

test.describe('CLI Error Handling Integration Tests', () => {
  test('CLI handles network errors gracefully', async () => {
    // Test with invalid API key
    const result = execSync(`node "${CLI_PATH}" auth --key invalid_key`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    expect(result).toContain('Invalid API key format');
  });

  test('CLI handles malformed JSON output gracefully', async () => {
    // Create malformed package.json
    const malformedPackageJson = '{ "name": "test", "invalid": }';
    require('fs').writeFileSync(
      join(TEST_PROJECT_DIR, 'package.json'),
      malformedPackageJson
    );
    
    const result = execSync(`node "${CLI_PATH}" scan:secrets --path "${TEST_PROJECT_DIR}"`, { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    // Should handle gracefully and not crash
    expect(result.length).toBeGreaterThan(0);
    
    // Verify it's not an error output
    expect(result).not.toContain('Error:');
    expect(result).not.toContain('FATAL:');
  });

  test('CLI handles large files gracefully', async () => {
    // Create a large file
    const largeContent = 'x'.repeat(1000000);
    require('fs').writeFileSync(
      join(TEST_PROJECT_DIR, 'large-file.js'),
      largeContent
    );
    
    const result = execSync(`node "${CLI_PATH}" scan:secrets --path "${TEST_PROJECT_DIR}"`, { 
      encoding: 'utf8',
      timeout: 15000 
    });
    
    // Should complete without timeout or crash
    expect(result.length).toBeGreaterThan(0);
    
    // Verify it's not an error output
    expect(result).not.toContain('Error:');
    expect(result).not.toContain('FATAL:');
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  });
});
