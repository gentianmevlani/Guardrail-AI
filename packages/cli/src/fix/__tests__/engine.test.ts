import { FixEngine, Finding, ScanResult } from '../engine';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  STRIPE_LIVE_PREFIX,
  STRIPE_TEST_PREFIX,
} from 'guardrail-security/secrets/stripe-placeholder-prefix';

describe('FixEngine', () => {
  let testDir: string;
  let engine: FixEngine;

  beforeEach(() => {
    testDir = join(tmpdir(), `fix-engine-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    engine = new FixEngine(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('generateFixPacks', () => {
    it('should generate security fix pack for hardcoded secrets', async () => {
      const testFile = 'config.ts';
      const content = `const apiKey = "${STRIPE_TEST_PREFIX}1234567890abcdef";\nconst password = "secret123";\n`;
      writeFileSync(join(testDir, testFile), content);

      const findings: Finding[] = [
        {
          id: 'SEC-001',
          severity: 'high',
          category: 'Hardcoded Secrets',
          title: 'API Key detected',
          file: testFile,
          line: 1,
          description: 'Found API Key',
          recommendation: 'Move to environment variable',
        },
      ];

      const scanResult: ScanResult = {
        findings,
        projectPath: testDir,
      };

      const packs = await engine.generateFixPacks(scanResult);

      expect(packs.length).toBeGreaterThan(0);
      const securityPack = packs.find(p => p.category === 'security');
      expect(securityPack).toBeDefined();
      expect(securityPack?.fixes.length).toBeGreaterThan(0);
<<<<<<< HEAD
      expect(securityPack?.fixes[0]!.confidence).toBeGreaterThan(0);
=======
      expect(securityPack?.fixes[0].confidence).toBeGreaterThan(0);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    });

    it('should generate quality fix pack for code smells', async () => {
      const testFile = 'app.ts';
      const content = `console.log("debug");\nvar x = 10;\n`;
      writeFileSync(join(testDir, testFile), content);

      const findings: Finding[] = [
        {
          id: 'QUAL-001',
          severity: 'low',
          category: 'Code Quality',
          title: 'Console.log usage',
          file: testFile,
          line: 1,
          description: 'Avoid console.log in production',
          recommendation: 'Use proper logger',
        },
      ];

      const scanResult: ScanResult = {
        findings,
        projectPath: testDir,
      };

      const packs = await engine.generateFixPacks(scanResult);

      const qualityPack = packs.find(p => p.category === 'quality');
      expect(qualityPack).toBeDefined();
      expect(qualityPack?.fixes.length).toBeGreaterThan(0);
    });

    it('should generate config fix pack for vulnerable dependencies', async () => {
      const testFile = 'package.json';
      const content = JSON.stringify({
        dependencies: {
          lodash: '^4.17.20',
        },
      }, null, 2);
      writeFileSync(join(testDir, testFile), content);

      const findings: Finding[] = [
        {
          id: 'DEP-001',
          severity: 'high',
          category: 'Vulnerable Dependency',
          title: 'lodash vulnerability',
          file: testFile,
          line: 1,
          description: 'CVE-2021-23337',
          recommendation: 'Upgrade to lodash@4.17.21 or later',
        },
      ];

      const scanResult: ScanResult = {
        findings,
        projectPath: testDir,
      };

      const packs = await engine.generateFixPacks(scanResult);

      const configPack = packs.find(p => p.category === 'config');
      expect(configPack).toBeDefined();
      expect(configPack?.fixes.length).toBeGreaterThan(0);
    });

    it('should calculate pack risk correctly', async () => {
      const testFile = 'test.ts';
      writeFileSync(
        join(testDir, testFile),
        `const API_KEY = "${STRIPE_LIVE_PREFIX}1234567890";\n`,
      );

      const findings: Finding[] = [
        {
          id: 'SEC-001',
          severity: 'high',
          category: 'Security',
          title: 'Hardcoded API key detected',
          file: testFile,
          line: 1,
          description: 'API key found in source code',
          recommendation: 'Move to environment variable',
        },
      ];

      const scanResult: ScanResult = {
        findings,
        projectPath: testDir,
      };

      const packs = await engine.generateFixPacks(scanResult);

      expect(packs.length).toBeGreaterThan(0);
<<<<<<< HEAD
      expect(packs[0]!.estimatedRisk).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(packs[0]!.estimatedRisk);
=======
      expect(packs[0].estimatedRisk).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(packs[0].estimatedRisk);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    });

    it('should assign confidence scores to fixes', async () => {
      const testFile = 'config.ts';
      const content = `const apiKey = "${STRIPE_TEST_PREFIX}1234567890abcdef";\n`;
      writeFileSync(join(testDir, testFile), content);

      const findings: Finding[] = [
        {
          id: 'SEC-001',
          severity: 'high',
          category: 'Hardcoded Secrets',
          title: 'API Key detected',
          file: testFile,
          line: 1,
          description: 'Found API Key',
          recommendation: 'Move to environment variable',
        },
      ];

      const scanResult: ScanResult = {
        findings,
        projectPath: testDir,
      };

      const packs = await engine.generateFixPacks(scanResult);
      const securityPack = packs.find(p => p.category === 'security');

      expect(securityPack?.confidence).toBeGreaterThan(0);
      expect(securityPack?.confidence).toBeLessThanOrEqual(1);
      securityPack?.fixes.forEach(fix => {
        expect(fix.confidence).toBeGreaterThan(0);
        expect(fix.confidence).toBeLessThanOrEqual(1);
      });
    });
  });
});
