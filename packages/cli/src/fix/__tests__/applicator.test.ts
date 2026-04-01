import { FixApplicator } from '../applicator';
import { FixPack, Fix } from '../engine';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('FixApplicator', () => {
  let testDir: string;
  let applicator: FixApplicator;

  beforeEach(() => {
    testDir = join(tmpdir(), `applicator-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    applicator = new FixApplicator(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('applyPacks', () => {
    it('should apply fixes successfully', async () => {
      const testFile = 'test.ts';
      const originalContent = 'console.log("test");\nconst x = 1;\n';
      writeFileSync(join(testDir, testFile), originalContent);

      const fix: Fix = {
        findingId: 'QUAL-001',
        file: testFile,
        line: 1,
        oldCode: 'console.log("test");',
        newCode: 'logger.debug("test");',
        confidence: 0.8,
        risk: 'low',
        explanation: 'Replace console.log with logger',
      };

      const pack: FixPack = {
        id: 'quality-fixes',
        category: 'quality',
        name: 'Quality Fixes',
        description: 'Improve code quality',
        findings: [],
        fixes: [fix],
        estimatedRisk: 'low',
        impactedFiles: [testFile],
        priority: 1,
        confidence: 0.8,
      };

      const result = await applicator.applyPacks([pack]);

      expect(result.success).toBe(true);
      expect(result.appliedFixes).toBe(1);
      expect(result.failedFixes).toBe(0);

      const modifiedContent = readFileSync(join(testDir, testFile), 'utf-8');
      expect(modifiedContent).toContain('logger.debug("test");');
    });

    it('should handle multiple fixes in one pack', async () => {
      const testFile = 'test.ts';
      const originalContent = 'console.log("test1");\nconsole.log("test2");\nconst x = 1;\n';
      writeFileSync(join(testDir, testFile), originalContent);

      const fixes: Fix[] = [
        {
          findingId: 'QUAL-001',
          file: testFile,
          line: 1,
          oldCode: 'console.log("test1");',
          newCode: 'logger.debug("test1");',
          confidence: 0.8,
          risk: 'low',
          explanation: 'Replace console.log with logger',
        },
        {
          findingId: 'QUAL-002',
          file: testFile,
          line: 2,
          oldCode: 'console.log("test2");',
          newCode: 'logger.debug("test2");',
          confidence: 0.8,
          risk: 'low',
          explanation: 'Replace console.log with logger',
        },
      ];

      const pack: FixPack = {
        id: 'quality-fixes',
        category: 'quality',
        name: 'Quality Fixes',
        description: 'Improve code quality',
        findings: [],
        fixes,
        estimatedRisk: 'low',
        impactedFiles: [testFile],
        priority: 1,
        confidence: 0.8,
      };

      const result = await applicator.applyPacks([pack]);

      expect(result.success).toBe(true);
      expect(result.appliedFixes).toBe(2);
      expect(result.failedFixes).toBe(0);
    });

    it('should report errors for failed fixes', async () => {
      const testFile = 'test.ts';
      const originalContent = 'const x = 1;\n';
      writeFileSync(join(testDir, testFile), originalContent);

      const fix: Fix = {
        findingId: 'QUAL-001',
        file: testFile,
        line: 1,
        oldCode: 'console.log("test");', // This doesn't match the actual content
        newCode: 'logger.debug("test");',
        confidence: 0.8,
        risk: 'low',
        explanation: 'Replace console.log with logger',
      };

      const pack: FixPack = {
        id: 'quality-fixes',
        category: 'quality',
        name: 'Quality Fixes',
        description: 'Improve code quality',
        findings: [],
        fixes: [fix],
        estimatedRisk: 'low',
        impactedFiles: [testFile],
        priority: 1,
        confidence: 0.8,
      };

      const result = await applicator.applyPacks([pack]);

      expect(result.success).toBe(false);
      expect(result.appliedFixes).toBe(0);
      expect(result.failedFixes).toBe(1);
      expect(result.errors.length).toBe(1);
<<<<<<< HEAD
      expect(result.errors[0]!.fix).toBe(fix);
=======
      expect(result.errors[0].fix).toBe(fix);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    });

    it('should apply fixes from multiple packs', async () => {
      const file1 = 'file1.ts';
      const file2 = 'file2.ts';
      writeFileSync(join(testDir, file1), 'console.log("test1");\n');
      writeFileSync(join(testDir, file2), 'var x = 1;\n');

      const pack1: FixPack = {
        id: 'pack1',
        category: 'quality',
        name: 'Pack 1',
        description: 'Fix console.log',
        findings: [],
        fixes: [{
          findingId: 'F1',
          file: file1,
          line: 1,
          oldCode: 'console.log("test1");',
          newCode: 'logger.debug("test1");',
          confidence: 0.8,
          risk: 'low',
          explanation: 'Fix',
        }],
        estimatedRisk: 'low',
        impactedFiles: [file1],
        priority: 1,
        confidence: 0.8,
      };

      const pack2: FixPack = {
        id: 'pack2',
        category: 'quality',
        name: 'Pack 2',
        description: 'Fix var',
        findings: [],
        fixes: [{
          findingId: 'F2',
          file: file2,
          line: 1,
          oldCode: 'var x = 1;',
          newCode: 'const x = 1;',
          confidence: 0.9,
          risk: 'low',
          explanation: 'Fix',
        }],
        estimatedRisk: 'low',
        impactedFiles: [file2],
        priority: 2,
        confidence: 0.9,
      };

      const result = await applicator.applyPacks([pack1, pack2]);

      expect(result.success).toBe(true);
      expect(result.appliedFixes).toBe(2);
      expect(readFileSync(join(testDir, file1), 'utf-8')).toContain('logger.debug');
      expect(readFileSync(join(testDir, file2), 'utf-8')).toContain('const x');
    });
  });

  describe('generateDiff', () => {
    it('should generate unified diff format', () => {
      const fix: Fix = {
        findingId: 'QUAL-001',
        file: 'test.ts',
        line: 1,
        oldCode: 'console.log("test");',
        newCode: 'logger.debug("test");',
        confidence: 0.8,
        risk: 'low',
        explanation: 'Replace console.log with logger',
      };

      const pack: FixPack = {
        id: 'quality-fixes',
        category: 'quality',
        name: 'Quality Fixes',
        description: 'Improve code quality',
        findings: [],
        fixes: [fix],
        estimatedRisk: 'low',
        impactedFiles: ['test.ts'],
        priority: 1,
        confidence: 0.8,
      };

      const diff = applicator.generateDiff([pack]);

      expect(diff).toContain('# Fix Pack: Quality Fixes');
      expect(diff).toContain('# Category: quality');
      expect(diff).toContain('# Risk: low');
      expect(diff).toContain('--- a/test.ts');
      expect(diff).toContain('+++ b/test.ts');
      expect(diff).toContain('-console.log("test");');
      expect(diff).toContain('+logger.debug("test");');
      expect(diff).toContain('# Replace console.log with logger');
    });

    it('should generate diff for multiple packs', () => {
      const pack1: FixPack = {
        id: 'pack1',
        category: 'quality',
        name: 'Pack 1',
        description: 'Desc 1',
        findings: [],
        fixes: [{
          findingId: 'F1',
          file: 'file1.ts',
          line: 1,
          oldCode: 'old1',
          newCode: 'new1',
          confidence: 0.8,
          risk: 'low',
          explanation: 'Exp 1',
        }],
        estimatedRisk: 'low',
        impactedFiles: ['file1.ts'],
        priority: 1,
        confidence: 0.8,
      };

      const pack2: FixPack = {
        id: 'pack2',
        category: 'security',
        name: 'Pack 2',
        description: 'Desc 2',
        findings: [],
        fixes: [{
          findingId: 'F2',
          file: 'file2.ts',
          line: 2,
          oldCode: 'old2',
          newCode: 'new2',
          confidence: 0.9,
          risk: 'medium',
          explanation: 'Exp 2',
        }],
        estimatedRisk: 'medium',
        impactedFiles: ['file2.ts'],
        priority: 2,
        confidence: 0.9,
      };

      const diff = applicator.generateDiff([pack1, pack2]);

      expect(diff).toContain('Pack 1');
      expect(diff).toContain('Pack 2');
      expect(diff).toContain('file1.ts');
      expect(diff).toContain('file2.ts');
    });
  });
});
