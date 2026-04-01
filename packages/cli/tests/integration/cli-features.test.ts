/**
 * Integration tests for the Guardrail CLI (Playwright test runner; spawns real Node processes).
 * Entry point is `bin/guardrail.js` (loads `dist/cli.js` and calls `runCLI`).
 */

import { execSync } from 'child_process';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { test, expect } from '@playwright/test';

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
    if (existsSync(TEST_PROJECT_DIR)) {
      rmSync(TEST_PROJECT_DIR, { recursive: true, force: true });
    }
  });

  test('CLI launcher and dist exist', () => {
    expect(existsSync(CLI_PATH)).toBe(true);
    expect(existsSync(join(__dirname, '../../dist/cli.js'))).toBe(true);
  });

  test('CLI shows help', async () => {
    const result = execSync(`node "${CLI_PATH}" --help`, { encoding: 'utf8' });
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
  });
});
