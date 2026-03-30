/**
 * Tests for custom pattern config loader
 */

import { loadCustomPatterns, ConfigValidationError } from '../config-loader';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('loadCustomPatterns', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `guardrail-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, '.guardrail'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should return empty array when config file does not exist', () => {
    const patterns = loadCustomPatterns(testDir);
    expect(patterns).toEqual([]);
  });

  it('should load valid custom patterns', () => {
    const config = `
patterns:
  - name: "My Vendor Key"
    type: "api_key"
    regex: "mykey_[A-Za-z0-9]{32}"
    minEntropy: 4.0
    description: "Vendor API key"
    risk: "high"
`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.yaml'), config);

    const patterns = loadCustomPatterns(testDir);
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.name).toBe('My Vendor Key');
    expect(patterns[0]?.type).toBe('api_key');
    expect(patterns[0]?.minEntropy).toBe(4.0);
    expect(patterns[0]?.risk).toBe('high');
  });

  it('should throw on invalid YAML syntax', () => {
    const config = `
patterns:
  - name: "Test
    invalid yaml
`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.yaml'), config);

    expect(() => loadCustomPatterns(testDir)).toThrow(ConfigValidationError);
  });

  it('should throw when patterns is not an array', () => {
    const config = `
patterns: "not an array"
`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.yaml'), config);

    expect(() => loadCustomPatterns(testDir)).toThrow('patterns must be an array');
  });

  it('should validate required fields', () => {
    const config = `
patterns:
  - name: "Test Pattern"
    type: "api_key"
`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.yaml'), config);

    expect(() => {
      try {
        loadCustomPatterns(testDir);
      } catch (error: any) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect(error.details?.some((d: string) => d.includes('regex is required'))).toBe(true);
        throw error;
      }
    }).toThrow(ConfigValidationError);
  });

  it('should validate minEntropy range', () => {
    const config = `
patterns:
  - name: "Test Pattern"
    type: "api_key"
    regex: "test_[A-Z]+"
    minEntropy: 10.0
`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.yaml'), config);

    expect(() => {
      try {
        loadCustomPatterns(testDir);
      } catch (error: any) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect(error.details?.some((d: string) => d.includes('minEntropy must be a number between 0 and 8'))).toBe(true);
        throw error;
      }
    }).toThrow(ConfigValidationError);
  });

  it('should validate risk level', () => {
    const config = `
patterns:
  - name: "Test Pattern"
    type: "api_key"
    regex: "test_[A-Z]+"
    risk: "critical"
`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.yaml'), config);

    expect(() => {
      try {
        loadCustomPatterns(testDir);
      } catch (error: any) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect(error.details?.some((d: string) => d.includes('risk must be one of: high, medium, low'))).toBe(true);
        throw error;
      }
    }).toThrow(ConfigValidationError);
  });

  it('should validate regex syntax', () => {
    const config = `
patterns:
  - name: "Test Pattern"
    type: "api_key"
    regex: "[invalid(regex"
`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.yaml'), config);

    expect(() => {
      try {
        loadCustomPatterns(testDir);
      } catch (error: any) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect(error.details?.some((d: string) => d.includes('regex is invalid'))).toBe(true);
        throw error;
      }
    }).toThrow(ConfigValidationError);
  });

  it('should use default risk level if not specified', () => {
    const config = `
patterns:
  - name: "Test Pattern"
    type: "api_key"
    regex: "test_[A-Z]+"
`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.yaml'), config);

    const patterns = loadCustomPatterns(testDir);
    expect(patterns[0]?.risk).toBe('medium');
  });

  it('should load multiple patterns', () => {
    const config = `
patterns:
  - name: "Pattern 1"
    type: "api_key"
    regex: "key1_[A-Z]+"
  - name: "Pattern 2"
    type: "token"
    regex: "tok_[0-9]+"
    minEntropy: 3.5
    risk: "high"
`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.yaml'), config);

    const patterns = loadCustomPatterns(testDir);
    expect(patterns).toHaveLength(2);
    expect(patterns[0]?.name).toBe('Pattern 1');
    expect(patterns[1]?.name).toBe('Pattern 2');
  });
});
