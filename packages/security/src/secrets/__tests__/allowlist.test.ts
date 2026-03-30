/**
 * Tests for allowlist functionality
 */

import { Allowlist } from '../allowlist';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Allowlist', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `guardrail-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should start empty when no allowlist file exists', () => {
    const allowlist = new Allowlist(testDir);
    expect(allowlist.size()).toBe(0);
  });

  it('should load existing allowlist file', () => {
    mkdirSync(join(testDir, '.guardrail'), { recursive: true });
    const content = `# Comment
abc123def456abc123def456abc123def456abc123def456abc123def456abc1234567
def456abc123def456abc123def456abc123def456abc123def456abc123def4567890
`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.allowlist'), content);

    const allowlist = new Allowlist(testDir);
    expect(allowlist.size()).toBe(2);
  });

  it('should check if fingerprint is allowlisted', () => {
    const fingerprint = 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1234567';
    mkdirSync(join(testDir, '.guardrail'), { recursive: true });
    writeFileSync(join(testDir, '.guardrail', 'secrets.allowlist'), fingerprint);

    const allowlist = new Allowlist(testDir);
    expect(allowlist.isAllowlisted(fingerprint)).toBe(true);
    expect(allowlist.isAllowlisted('notinlist0000000000000000000000000000000000000000000000000000')).toBe(false);
  });

  it('should add fingerprint to allowlist', () => {
    const allowlist = new Allowlist(testDir);
    const fingerprint = 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1234567';
    
    allowlist.add(fingerprint);
    expect(allowlist.size()).toBe(1);
    expect(allowlist.isAllowlisted(fingerprint)).toBe(true);
  });

  it('should reject invalid fingerprint format', () => {
    const allowlist = new Allowlist(testDir);
    
    expect(() => allowlist.add('invalid')).toThrow('Invalid fingerprint format');
    expect(() => allowlist.add('abc123')).toThrow('Invalid fingerprint format');
  });

  it('should save allowlist to disk', () => {
    const allowlist = new Allowlist(testDir);
    const fingerprint = 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1234567';
    
    allowlist.add(fingerprint);
    allowlist.save();

    const content = readFileSync(join(testDir, '.guardrail', 'secrets.allowlist'), 'utf-8');
    expect(content).toContain(fingerprint);
    expect(content).toContain('# guardrail Secrets Allowlist');
  });

  it('should add from baseline JSON file', () => {
    const baseline = {
      findings: [
        { fingerprint: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1234567' },
        { fingerprint: 'def456abc123def456abc123def456abc123def456abc123def456abc123def4567890' },
      ],
    };
    const baselinePath = join(testDir, 'baseline.json');
    writeFileSync(baselinePath, JSON.stringify(baseline));

    const allowlist = new Allowlist(testDir);
    const added = allowlist.addFromBaseline(baselinePath);
    
    expect(added).toBe(2);
    expect(allowlist.size()).toBe(2);
  });

  it('should add from line-delimited baseline file', () => {
    const content = `abc123def456abc123def456abc123def456abc123def456abc123def456abc1234567
def456abc123def456abc123def456abc123def456abc123def456abc123def4567890
# Comment line
invalid-line-should-be-skipped
`;
    const baselinePath = join(testDir, 'baseline.txt');
    writeFileSync(baselinePath, content);

    const allowlist = new Allowlist(testDir);
    const added = allowlist.addFromBaseline(baselinePath);
    
    expect(added).toBe(2);
    expect(allowlist.size()).toBe(2);
  });

  it('should throw when baseline file does not exist', () => {
    const allowlist = new Allowlist(testDir);
    
    expect(() => allowlist.addFromBaseline('/nonexistent/file')).toThrow('Baseline file not found');
  });

  it('should skip empty lines and comments when loading', () => {
    mkdirSync(join(testDir, '.guardrail'), { recursive: true });
    const content = `# Header comment

abc123def456abc123def456abc123def456abc123def456abc123def456abc1234567

# Another comment
def456abc123def456abc123def456abc123def456abc123def456abc123def4567890

`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.allowlist'), content);

    const allowlist = new Allowlist(testDir);
    expect(allowlist.size()).toBe(2);
  });

  it('should be case-insensitive for fingerprints', () => {
    const allowlist = new Allowlist(testDir);
    const fingerprint = 'ABC123DEF456ABC123DEF456ABC123DEF456ABC123DEF456ABC123DEF456ABC1234567';
    
    allowlist.add(fingerprint);
    expect(allowlist.isAllowlisted(fingerprint.toLowerCase())).toBe(true);
    expect(allowlist.isAllowlisted(fingerprint.toUpperCase())).toBe(true);
  });
});
