/**
 * Integration tests for enterprise secrets scanning
 */

import { SecretsGuardian } from '../guardian';
import { Allowlist } from '../allowlist';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Enterprise Secrets Scanning Integration', () => {
  let testDir: string;
  let guardian: SecretsGuardian;

  beforeEach(() => {
    testDir = join(tmpdir(), `guardrail-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    guardian = new SecretsGuardian();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should load and use custom patterns', async () => {
    mkdirSync(join(testDir, '.guardrail'), { recursive: true });
    
    const customConfig = `
patterns:
  - name: "Custom Vendor Key"
    type: "vendor_key"
    regex: "vnd_[A-Za-z0-9]{32}"
    minEntropy: 3.5
    risk: "high"
`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.yaml'), customConfig);

    const testFile = `const key = "vnd_abc123def456ghi789jkl012mno345pq";`;
    writeFileSync(join(testDir, 'test.js'), testFile);

    const report = await guardian.scanProject(testDir, 'test-project', {
      useCustomPatterns: true,
    });

    expect(report.performance.customPatternsLoaded).toBe(1);
    expect(report.detections.length).toBeGreaterThan(0);
    expect(report.detections[0]?.secretType).toBe('vendor_key');
  });

  it('should suppress allowlisted detections', async () => {
    mkdirSync(join(testDir, '.guardrail'), { recursive: true });

    const testFile = `const key = "AKIAIOSFODNN7EXAMPLE";`;
    writeFileSync(join(testDir, 'test.js'), testFile);

    // First scan to get fingerprint
    const report1 = await guardian.scanProject(testDir, 'test-project', {
      useAllowlist: false,
    });
    expect(report1.detections.length).toBeGreaterThan(0);
    const fingerprint = report1.detections[0]?.fingerprint;

    // Add to allowlist
    const allowlist = new Allowlist(testDir);
    allowlist.add(fingerprint!);
    allowlist.save();

    // Second scan should suppress
    const report2 = await guardian.scanProject(testDir, 'test-project', {
      useAllowlist: true,
    });
    expect(report2.detections.length).toBe(0);
  });

  it('should adjust risk based on file context', async () => {
    // Example file - should downgrade
    const exampleFile = `const key = "AKIAIOSFODNN7EXAMPLE";`;
    writeFileSync(join(testDir, '.env.example'), exampleFile);

    // Production file - should upgrade
    const prodFile = `const key = "AKIAIOSFODNN7REALKEY1";`;
    writeFileSync(join(testDir, '.env'), prodFile);

    const report = await guardian.scanProject(testDir, 'test-project', {
      useContextualRisk: true,
    });

    const exampleDetection = report.detections.find(d => d.filePath.includes('.env.example'));
    const prodDetection = report.detections.find(d => d.filePath === '.env');

    if (exampleDetection && prodDetection) {
      // Example should have lower or equal risk
      const riskOrder = { low: 0, medium: 1, high: 2 };
      expect(riskOrder[exampleDetection.risk]).toBeLessThanOrEqual(riskOrder[prodDetection.risk]);
    }
  });

  it('should skip large files', async () => {
    const largeContent = 'x'.repeat(3 * 1024 * 1024); // 3MB
    writeFileSync(join(testDir, 'large.txt'), largeContent);

    const report = await guardian.scanProject(testDir, 'test-project', {
      maxFileSizeBytes: 2 * 1024 * 1024,
    });

    expect(report.performance.skippedLarge).toBe(1);
  });

  it('should skip binary files', async () => {
    const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]);
    writeFileSync(join(testDir, 'binary.bin'), binaryContent);

    const report = await guardian.scanProject(testDir, 'test-project', {
      skipBinaryFiles: true,
    });

    expect(report.performance.skippedBinary).toBeGreaterThanOrEqual(1);
  });

  it('should handle invalid custom patterns gracefully', async () => {
    mkdirSync(join(testDir, '.guardrail'), { recursive: true });
    
    const invalidConfig = `
patterns:
  - name: "Invalid Pattern"
    type: "test"
    regex: "[invalid(regex"
`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.yaml'), invalidConfig);

    await expect(
      guardian.scanProject(testDir, 'test-project', {
        useCustomPatterns: true,
      })
    ).rejects.toThrow();
  });

  it('should provide comprehensive performance metrics', async () => {
    mkdirSync(join(testDir, '.guardrail'), { recursive: true });
    
    const customConfig = `
patterns:
  - name: "Test Pattern"
    type: "test"
    regex: "test_[A-Z]+"
`;
    writeFileSync(join(testDir, '.guardrail', 'secrets.yaml'), customConfig);

    const testFile = `const key = "test_ABC";`;
    writeFileSync(join(testDir, 'test.js'), testFile);

    const largeFile = 'x'.repeat(3 * 1024 * 1024);
    writeFileSync(join(testDir, 'large.txt'), largeFile);

    const report = await guardian.scanProject(testDir, 'test-project', {
      useCustomPatterns: true,
      maxFileSizeBytes: 2 * 1024 * 1024,
    });

    expect(report.performance).toHaveProperty('customPatternsLoaded');
    expect(report.performance).toHaveProperty('skippedLarge');
    expect(report.performance).toHaveProperty('skippedBinary');
    expect(report.performance).toHaveProperty('allowlistSuppressed');
  });

  it('should work with all features disabled', async () => {
    const testFile = `const key = "AKIAIOSFODNN7EXAMPLE";`;
    writeFileSync(join(testDir, 'test.js'), testFile);

    const report = await guardian.scanProject(testDir, 'test-project', {
      useCustomPatterns: false,
      useAllowlist: false,
      useContextualRisk: false,
    });

    expect(report.detections.length).toBeGreaterThan(0);
    expect(report.performance.customPatternsLoaded).toBe(0);
  });
});
