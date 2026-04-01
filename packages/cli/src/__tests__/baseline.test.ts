/**
 * Tests for baseline suppression
 */

import { BaselineManager } from '../scanner/baseline';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { STRIPE_TEST_PREFIX } from 'guardrail-security/secrets/stripe-placeholder-prefix';

describe('Baseline Suppression', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'guardrail-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('generateFingerprint', () => {
    it('should generate stable fingerprint for same finding', () => {
      const finding = {
        category: 'secrets',
        title: 'API Key Detected',
        file: 'src/config.ts',
        line: 10,
        snippet: STRIPE_TEST_PREFIX + '1234567890',
      };

      const fp1 = BaselineManager.generateFingerprint(finding);
      const fp2 = BaselineManager.generateFingerprint(finding);

      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(64);
    });

    it('should generate different fingerprints for different findings', () => {
      const finding1 = {
        category: 'secrets',
        title: 'API Key Detected',
        file: 'src/config.ts',
        line: 10,
        snippet: STRIPE_TEST_PREFIX + '1234567890',
      };

      const finding2 = {
        category: 'secrets',
        title: 'API Key Detected',
        file: 'src/config.ts',
        line: 11,
        snippet: STRIPE_TEST_PREFIX + '1234567890',
      };

      const fp1 = BaselineManager.generateFingerprint(finding1);
      const fp2 = BaselineManager.generateFingerprint(finding2);

      expect(fp1).not.toBe(fp2);
    });

    it('should normalize whitespace in snippets', () => {
      const finding1 = {
        category: 'secrets',
        title: 'API Key',
        file: 'src/config.ts',
        line: 10,
        snippet: STRIPE_TEST_PREFIX + '123   456',
      };

      const finding2 = {
        category: 'secrets',
        title: 'API Key',
        file: 'src/config.ts',
        line: 10,
        snippet: STRIPE_TEST_PREFIX + '123 456',
      };

      const fp1 = BaselineManager.generateFingerprint(finding1);
      const fp2 = BaselineManager.generateFingerprint(finding2);

      expect(fp1).toBe(fp2);
    });

    it('should handle findings with type instead of category', () => {
      const finding = {
        type: 'api_key',
        title: 'API Key Detected',
        file: 'src/config.ts',
        line: 10,
        match: STRIPE_TEST_PREFIX + '1234567890',
      };

      const fp = BaselineManager.generateFingerprint(finding);

      expect(fp).toBeDefined();
      expect(fp).toHaveLength(64);
    });
  });

  describe('saveBaseline and loadBaseline', () => {
    it('should save and load baseline correctly', () => {
      const baselinePath = join(tempDir, 'baseline.json');
      const findings = [
        {
          category: 'secrets',
          title: 'API Key Detected',
          file: 'src/config.ts',
          line: 10,
          snippet: STRIPE_TEST_PREFIX + '1234567890',
        },
        {
          category: 'vulnerability',
          title: 'CVE-2021-23337',
          file: 'package.json',
          line: 1,
          snippet: 'lodash@4.17.20',
        },
      ];

      BaselineManager.saveBaseline(baselinePath, findings);

      const loaded = BaselineManager.loadBaseline(baselinePath);

      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe('1.0.0');
      expect(loaded!.createdAt).toBeDefined();
      expect(loaded!.findings).toHaveLength(2);
<<<<<<< HEAD
      const lf = loaded!.findings;
      expect(lf[0]!.fingerprint).toBeDefined();
      expect(lf[0]!.category).toBe('secrets');
      expect(lf[1]!.category).toBe('vulnerability');
=======
      expect(loaded!.findings[0].fingerprint).toBeDefined();
      expect(loaded!.findings[0].category).toBe('secrets');
      expect(loaded!.findings[1].category).toBe('vulnerability');
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    });

    it('should return null for non-existent baseline', () => {
      const baselinePath = join(tempDir, 'nonexistent.json');
      const loaded = BaselineManager.loadBaseline(baselinePath);

      expect(loaded).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const baselinePath = join(tempDir, 'invalid.json');
      writeFileSync(baselinePath, 'not valid json', 'utf8');

      const loaded = BaselineManager.loadBaseline(baselinePath);

      expect(loaded).toBeNull();
    });
  });

  describe('isSuppressed', () => {
    it('should identify suppressed findings', () => {
      const finding = {
        category: 'secrets',
        title: 'API Key Detected',
        file: 'src/config.ts',
        line: 10,
        snippet: STRIPE_TEST_PREFIX + '1234567890',
      };

      const baseline = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        findings: [
          {
            fingerprint: BaselineManager.generateFingerprint(finding),
            category: 'secrets',
            title: 'API Key Detected',
            file: 'src/config.ts',
            line: 10,
            suppressedAt: new Date().toISOString(),
          },
        ],
      };

      const suppressed = BaselineManager.isSuppressed(finding, baseline);

      expect(suppressed).toBe(true);
    });

    it('should not suppress findings not in baseline', () => {
      const finding = {
        category: 'secrets',
        title: 'API Key Detected',
        file: 'src/config.ts',
        line: 10,
        snippet: STRIPE_TEST_PREFIX + '1234567890',
      };

      const baseline = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        findings: [],
      };

      const suppressed = BaselineManager.isSuppressed(finding, baseline);

      expect(suppressed).toBe(false);
    });

    it('should return false when baseline is null', () => {
      const finding = {
        category: 'secrets',
        title: 'API Key Detected',
        file: 'src/config.ts',
        line: 10,
        snippet: STRIPE_TEST_PREFIX + '1234567890',
      };

      const suppressed = BaselineManager.isSuppressed(finding, null);

      expect(suppressed).toBe(false);
    });
  });

  describe('filterFindings', () => {
    it('should filter out suppressed findings', () => {
      const baselinePath = join(tempDir, 'baseline.json');
      const findings = [
        {
          category: 'secrets',
          title: 'API Key 1',
          file: 'src/config.ts',
          line: 10,
          snippet: STRIPE_TEST_PREFIX + '111',
        },
        {
          category: 'secrets',
          title: 'API Key 2',
          file: 'src/config.ts',
          line: 20,
          snippet: STRIPE_TEST_PREFIX + '222',
        },
        {
          category: 'secrets',
          title: 'API Key 3',
          file: 'src/config.ts',
          line: 30,
          snippet: STRIPE_TEST_PREFIX + '333',
        },
      ];

<<<<<<< HEAD
      BaselineManager.saveBaseline(baselinePath, findings.slice(0, 2));
=======
      BaselineManager.saveBaseline(baselinePath, [findings[0], findings[1]]);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

      const { filtered, suppressed } = BaselineManager.filterFindings(findings, baselinePath);

      expect(filtered).toHaveLength(1);
<<<<<<< HEAD
      expect(filtered[0]!.title).toBe('API Key 3');
=======
      expect(filtered[0].title).toBe('API Key 3');
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      expect(suppressed).toBe(2);
    });

    it('should return all findings when no baseline provided', () => {
      const findings = [
        {
          category: 'secrets',
          title: 'API Key 1',
          file: 'src/config.ts',
          line: 10,
          snippet: STRIPE_TEST_PREFIX + '111',
        },
      ];

      const { filtered, suppressed } = BaselineManager.filterFindings(findings);

      expect(filtered).toHaveLength(1);
      expect(suppressed).toBe(0);
    });

    it('should return all findings when baseline does not exist', () => {
      const findings = [
        {
          category: 'secrets',
          title: 'API Key 1',
          file: 'src/config.ts',
          line: 10,
          snippet: STRIPE_TEST_PREFIX + '111',
        },
      ];

      const { filtered, suppressed } = BaselineManager.filterFindings(
        findings,
        join(tempDir, 'nonexistent.json')
      );

      expect(filtered).toHaveLength(1);
      expect(suppressed).toBe(0);
    });

    it('should handle empty findings array', () => {
      const baselinePath = join(tempDir, 'baseline.json');
      BaselineManager.saveBaseline(baselinePath, []);

      const { filtered, suppressed } = BaselineManager.filterFindings([], baselinePath);

      expect(filtered).toHaveLength(0);
      expect(suppressed).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should suppress findings across multiple scans', () => {
      const baselinePath = join(tempDir, 'baseline.json');

      const scan1Findings = [
        {
          category: 'secrets',
          title: 'API Key',
          file: 'src/config.ts',
          line: 10,
          snippet: STRIPE_TEST_PREFIX + 'old',
        },
      ];

      BaselineManager.saveBaseline(baselinePath, scan1Findings);

      const scan2Findings = [
        {
          category: 'secrets',
          title: 'API Key',
          file: 'src/config.ts',
          line: 10,
          snippet: STRIPE_TEST_PREFIX + 'old',
        },
        {
          category: 'secrets',
          title: 'API Key',
          file: 'src/config.ts',
          line: 20,
          snippet: STRIPE_TEST_PREFIX + 'new',
        },
      ];

      const { filtered, suppressed } = BaselineManager.filterFindings(scan2Findings, baselinePath);

      expect(filtered).toHaveLength(1);
<<<<<<< HEAD
      expect(filtered[0]!.snippet).toBe(STRIPE_TEST_PREFIX + 'new');
=======
      expect(filtered[0].snippet).toBe(STRIPE_TEST_PREFIX + 'new');
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      expect(suppressed).toBe(1);
    });

    it('should handle findings with different structures', () => {
      const baselinePath = join(tempDir, 'baseline.json');

      const secretsFindings = [
        {
          type: 'api_key',
          title: 'API Key',
          file: 'src/config.ts',
          line: 10,
          match: STRIPE_TEST_PREFIX + '123',
        },
      ];

      BaselineManager.saveBaseline(baselinePath, secretsFindings);

      const vulnFindings = [
        {
          category: 'vulnerability',
          title: 'CVE-2021-23337',
          file: 'package.json',
          line: 1,
          snippet: 'lodash@4.17.20',
        },
      ];

      const { filtered, suppressed } = BaselineManager.filterFindings(vulnFindings, baselinePath);

      expect(filtered).toHaveLength(1);
      expect(suppressed).toBe(0);
    });
  });
});
