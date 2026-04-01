/**
 * Golden Snapshot Tests
 * 
 * Ensures output is stable and deterministic across runs.
 * These tests catch regressions in output format.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('CLI Output Stability', () => {
  const fixturesDir = path.join(__dirname, '..', 'fixtures');
  const testProject = path.join(fixturesDir, 'test-project');

  beforeAll(() => {
    // Ensure test project exists
    if (!fs.existsSync(testProject)) {
      fs.mkdirSync(testProject, { recursive: true });
      fs.writeFileSync(
        path.join(testProject, 'package.json'),
        JSON.stringify({ name: 'test-project', version: '1.0.0' }, null, 2)
      );
    }
  });

  test('scan --json output has stable schema', () => {
    const output = execSync(
      `node ${path.join(__dirname, '..', 'bin', 'guardrail.js')} scan --json --path ${testProject}`,
      { encoding: 'utf8', cwd: path.join(__dirname, '..') }
    ).trim();

    const result = JSON.parse(output);

    // Verify schema structure
    expect(result).toHaveProperty('schemaVersion');
    expect(result.schemaVersion).toBe('1.0.0');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('scanId');
    expect(result).toHaveProperty('projectPath');
    expect(result).toHaveProperty('verdict');
    expect(result).toHaveProperty('findings');
    expect(result).toHaveProperty('metadata');

    // Verify verdict structure
    expect(result.verdict).toHaveProperty('verdict');
    expect(result.verdict).toHaveProperty('exitCode');
    expect(result.verdict).toHaveProperty('summary');
    expect(result.verdict).toHaveProperty('topBlockers');
    expect(result.verdict).toHaveProperty('timings');

    // Verify finding structure
    if (result.findings.length > 0) {
      const finding = result.findings[0];
      expect(finding).toHaveProperty('id');
      expect(finding.id).toHaveProperty('full');
      expect(finding).toHaveProperty('ruleId');
      expect(finding).toHaveProperty('ruleName');
      expect(finding).toHaveProperty('severity');
      expect(finding).toHaveProperty('verdict');
      expect(finding).toHaveProperty('file');
      expect(finding).toHaveProperty('line');
      expect(finding).toHaveProperty('message');
      expect(finding).toHaveProperty('fixSuggestion');
      expect(finding).toHaveProperty('autofixAvailable');
    }
  });

  test('scan output is deterministic', () => {
    // Run scan twice and compare
    const output1 = execSync(
      `node ${path.join(__dirname, '..', 'bin', 'guardrail.js')} scan --json --path ${testProject}`,
      { encoding: 'utf8', cwd: path.join(__dirname, '..') }
    ).trim();

    const output2 = execSync(
      `node ${path.join(__dirname, '..', 'bin', 'guardrail.js')} scan --json --path ${testProject}`,
      { encoding: 'utf8', cwd: path.join(__dirname, '..') }
    ).trim();

    const result1 = JSON.parse(output1);
    const result2 = JSON.parse(output2);

    // Findings should be in same order (excluding timestamps and IDs)
    const findings1 = result1.findings.map(f => ({
      ruleId: f.ruleId,
      file: f.file,
      line: f.line,
      message: f.message,
    }));

    const findings2 = result2.findings.map(f => ({
      ruleId: f.ruleId,
      file: f.file,
      line: f.line,
      message: f.message,
    }));

    expect(findings1).toEqual(findings2);
  });

  test('exit codes are correct', () => {
    // Test PASS exit code (should be 0)
    try {
      execSync(
        `node ${path.join(__dirname, '..', 'bin', 'guardrail.js')} scan --json --path ${testProject}`,
        { encoding: 'utf8', cwd: path.join(__dirname, '..') }
      );
      // If no error, exit code was 0
      expect(true).toBe(true);
    } catch (error) {
      // If error, check exit code
      expect(error.status).toBe(0);
    }
  });

  test('finding IDs are stable', () => {
    const output = execSync(
      `node ${path.join(__dirname, '..', 'bin', 'guardrail.js')} scan --json --path ${testProject}`,
      { encoding: 'utf8', cwd: path.join(__dirname, '..') }
    ).trim();

    const result = JSON.parse(output);

    // All finding IDs should match pattern GR-*-###
    for (const finding of result.findings) {
      expect(finding.id.full).toMatch(/^GR-[A-Z]+-\d{3}$/);
    }

    // IDs should be unique
    const ids = result.findings.map(f => f.id.full);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  test('verdict format is stable', () => {
    const output = execSync(
      `node ${path.join(__dirname, '..', 'bin', 'guardrail.js')} scan --path ${testProject}`,
      { encoding: 'utf8', cwd: path.join(__dirname, '..') }
    ).trim();

    // Should contain verdict header
    expect(output).toMatch(/VERDICT:/);
    
    // Should contain summary if there are findings
    if (output.includes('BLOCKERS') || output.includes('WARNINGS')) {
      expect(output).toMatch(/SUMMARY:/);
    }
  });
});
