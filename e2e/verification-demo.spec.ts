/**
 * Verification Layer E2E Demo Tests
 * Demonstrates the CLI verification workflow with Playwright
 */

import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);
const PROJECT_ROOT = path.resolve(__dirname, '..');

async function runCli(args: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(
      `node bin/guardrail.js ${args}`,
      { cwd: PROJECT_ROOT }
    );
    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: execError.stdout || '',
      stderr: execError.stderr || '',
      exitCode: execError.code || 1,
    };
  }
}

test.describe('guardrail Verification CLI Demo', () => {
  test('PASS: Valid diff with safe commands', async () => {
    const result = await runCli(
      'verify-agent-output --file examples/verification/passing-example.json'
    );

    expect(result.stdout).toContain('VERIFICATION PASSED');
    expect(result.stdout).toContain('diff-structure');
    expect(result.stdout).toContain('path-safety');
    expect(result.stdout).toContain('command-safety');
    expect(result.exitCode).toBe(0);

    console.log('\n✅ DEMO: Passing verification\n');
    console.log(result.stdout);
  });

  test('FAIL: Hardcoded secrets detected', async () => {
    const result = await runCli(
      'verify-agent-output --file examples/verification/failing-secret-example.json'
    );

    expect(result.stdout).toContain('VERIFICATION FAILED');
    expect(result.stdout).toContain('CRITICAL secret');
    expect(result.stdout).toContain('AWS Access Key');
    expect(result.stdout).toContain('Retry Prompt');
    expect(result.exitCode).toBe(1);

    console.log('\n❌ DEMO: Secret detection failure\n');
    console.log(result.stdout);
  });

  test('FAIL: Dangerous commands blocked', async () => {
    const result = await runCli(
      'verify-agent-output --file examples/verification/failing-dangerous-command-example.json'
    );

    expect(result.stdout).toContain('VERIFICATION FAILED');
    expect(result.stdout).toContain('Dangerous command');
    expect(result.stdout).toContain('rm -rf');
    expect(result.stdout).toContain('sudo');
    expect(result.exitCode).toBe(1);

    console.log('\n❌ DEMO: Dangerous command blocked\n');
    console.log(result.stdout);
  });

  test('FAIL: Path traversal attack blocked', async () => {
    const result = await runCli(
      'verify-agent-output --file examples/verification/failing-path-traversal-example.json'
    );

    expect(result.stdout).toContain('VERIFICATION FAILED');
    expect(result.stdout).toContain('Path traversal');
    expect(result.stdout).toContain('../../../etc/passwd');
    expect(result.exitCode).toBe(1);

    console.log('\n❌ DEMO: Path traversal blocked\n');
    console.log(result.stdout);
  });

  test('JSON output mode for CI integration', async () => {
    const result = await runCli(
      'verify-agent-output --file examples/verification/passing-example.json --json'
    );

    const json = JSON.parse(result.stdout);
    expect(json.success).toBe(true);
    expect(json.checks).toBeDefined();
    expect(Array.isArray(json.checks)).toBe(true);
    expect(json.blockers).toEqual([]);

    console.log('\n📊 DEMO: JSON output for CI\n');
    console.log(JSON.stringify(json, null, 2));
  });

  test('Inline verification from string', async () => {
    const validInput = JSON.stringify({
      format: 'guardrail-v1',
      diff: `diff --git a/hello.ts b/hello.ts
--- a/hello.ts
+++ b/hello.ts
@@ -1 +1,2 @@
 console.log("hello");
+console.log("world");`,
    });

    // Write to temp file
    const tempFile = path.join(PROJECT_ROOT, '.temp-test-input.json');
    fs.writeFileSync(tempFile, validInput);

    try {
      const result = await runCli(`verify-agent-output --file "${tempFile}"`);
      expect(result.exitCode).toBe(0);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }

    console.log('\n✅ DEMO: Inline string verification\n');
  });
});

test.describe('guardrail Format Validation', () => {
  test('Rejects malformed JSON', async () => {
    const tempFile = path.join(PROJECT_ROOT, '.temp-malformed.json');
    fs.writeFileSync(tempFile, 'not valid json { broken');

    try {
      const result = await runCli(`verify-agent-output --file "${tempFile}"`);
      expect(result.exitCode).toBe(1);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  test('Rejects wrong format field', async () => {
    const tempFile = path.join(PROJECT_ROOT, '.temp-wrong-format.json');
    fs.writeFileSync(tempFile, JSON.stringify({
      format: 'not-guardrail',
      diff: 'some diff',
    }));

    try {
      const result = await runCli(`verify-agent-output --file "${tempFile}"`);
      expect(result.exitCode).toBe(1);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });

  test('Accepts fenced JSON block', async () => {
    const tempFile = path.join(PROJECT_ROOT, '.temp-fenced.txt');
    fs.writeFileSync(tempFile, `Here's the change:
\`\`\`json
{
  "format": "guardrail-v1",
  "diff": "diff --git a/x.ts b/x.ts\\n--- a/x.ts\\n+++ b/x.ts\\n@@ -1 +1 @@\\n-a\\n+b"
}
\`\`\`
`);

    try {
      const result = await runCli(`verify-agent-output --file "${tempFile}"`);
      expect(result.exitCode).toBe(0);
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  });
});
