/**
 * Pipeline Tests - Verified AutoFix Pipeline
 * 
 * Tests for the full verification pipeline:
 * - Format validation stage
 * - Diff application stage  
 * - Verification stage (typecheck, build, tests)
 * - Top 3 failure context extraction
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  VerifiedAutofixPipeline,
  formatPipelineResult,
  formatPipelineResultJson,
  type PipelineResult,
} from '../pipeline';
import { validateAgentOutput } from '../format-validator';

describe('VerifiedAutofixPipeline', () => {
  let tempDir: string;
  let pipeline: VerifiedAutofixPipeline;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pipeline-test-'));
    pipeline = new VerifiedAutofixPipeline();
    
    // Create minimal project structure
    await fs.promises.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          build: 'echo "build"',
          test: 'echo "test"',
        },
      })
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('validation stage', () => {
    it('rejects missing agent output file', async () => {
      const result = await pipeline.run({
        projectPath: tempDir,
        agentOutputFile: '/nonexistent/file.json',
        skipEntitlements: true,
      });

      expect(result.success).toBe(false);
      expect(result.stage).toBe('validate');
      expect(result.errors.some(e => e.includes('not found'))).toBe(true);
    });

    it('rejects invalid JSON in agent output', async () => {
      const outputFile = path.join(tempDir, 'output.json');
      await fs.promises.writeFile(outputFile, 'not valid json');

      const result = await pipeline.run({
        projectPath: tempDir,
        agentOutputFile: outputFile,
        skipEntitlements: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid JSON'))).toBe(true);
    });

    it('rejects wrong format field', async () => {
      const outputFile = path.join(tempDir, 'output.json');
      await fs.promises.writeFile(outputFile, JSON.stringify({
        format: 'wrong-format',
        diff: '',
        commands: [],
        tests: [],
        notes: '',
      }));

      const result = await pipeline.run({
        projectPath: tempDir,
        agentOutputFile: outputFile,
        skipEntitlements: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('guardrail-v1'))).toBe(true);
    });

    it('accepts valid guardrail-v1 output with empty diff', async () => {
      const outputFile = path.join(tempDir, 'output.json');
      await fs.promises.writeFile(outputFile, JSON.stringify({
        format: 'guardrail-v1',
        diff: '',
        commands: [],
        tests: [],
        notes: 'No changes needed',
      }));

      const result = await pipeline.run({
        projectPath: tempDir,
        agentOutputFile: outputFile,
        skipEntitlements: true,
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('done');
    });

    it('strips markdown fences and warns', async () => {
      const outputFile = path.join(tempDir, 'output.json');
      await fs.promises.writeFile(outputFile, '```json\n' + JSON.stringify({
        format: 'guardrail-v1',
        diff: '',
        commands: [],
        tests: [],
        notes: '',
      }) + '\n```');

      const result = await pipeline.run({
        projectPath: tempDir,
        agentOutputFile: outputFile,
        skipEntitlements: true,
      });

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('markdown'))).toBe(true);
    });
  });

  describe('stub detection', () => {
    it('blocks TODO comments in diff', async () => {
      const outputFile = path.join(tempDir, 'output.json');
      await fs.promises.writeFile(outputFile, JSON.stringify({
        format: 'guardrail-v1',
        diff: `--- a/src/file.ts
+++ b/src/file.ts
@@ -1,1 +1,2 @@
 const x = 1;
+// TODO: implement this`,
        commands: [],
        tests: [],
        notes: '',
      }));

      const result = await pipeline.run({
        projectPath: tempDir,
        agentOutputFile: outputFile,
        skipEntitlements: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Stub'))).toBe(true);
    });

    it('blocks placeholder text in diff', async () => {
      const outputFile = path.join(tempDir, 'output.json');
      await fs.promises.writeFile(outputFile, JSON.stringify({
        format: 'guardrail-v1',
        diff: `--- a/src/file.ts
+++ b/src/file.ts
@@ -1,1 +1,2 @@
 const x = 1;
+const message = "placeholder content here";`,
        commands: [],
        tests: [],
        notes: '',
      }));

      const result = await pipeline.run({
        projectPath: tempDir,
        agentOutputFile: outputFile,
        skipEntitlements: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Stub') || e.includes('placeholder'))).toBe(true);
    });

    it('allows clean code without stubs', async () => {
      const outputFile = path.join(tempDir, 'output.json');
      await fs.promises.writeFile(outputFile, JSON.stringify({
        format: 'guardrail-v1',
        diff: `--- a/src/file.ts
+++ b/src/file.ts
@@ -1,1 +1,2 @@
 const x = 1;
+const y = x + 1;`,
        commands: [],
        tests: [],
        notes: '',
      }));

      // Create the source file
      await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.promises.writeFile(path.join(tempDir, 'src', 'file.ts'), 'const x = 1;\n');

      const result = await pipeline.run({
        projectPath: tempDir,
        agentOutputFile: outputFile,
        dryRun: true,
        skipEntitlements: true,
      });

      // Should pass validation (stub detection at least)
      expect(result.validation?.stubDetection?.hasStubs).toBe(false);
    });
  });

  describe('path safety', () => {
    it('blocks parent directory traversal', async () => {
      const outputFile = path.join(tempDir, 'output.json');
      await fs.promises.writeFile(outputFile, JSON.stringify({
        format: 'guardrail-v1',
        diff: `--- a/../../../etc/passwd
+++ b/../../../etc/passwd
@@ -1,1 +1,1 @@
-root
+hacked`,
        commands: [],
        tests: [],
        notes: '',
      }));

      const result = await pipeline.run({
        projectPath: tempDir,
        agentOutputFile: outputFile,
        skipEntitlements: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Unsafe') || e.includes('path'))).toBe(true);
    });

    it('blocks node_modules modifications', async () => {
      const outputFile = path.join(tempDir, 'output.json');
      await fs.promises.writeFile(outputFile, JSON.stringify({
        format: 'guardrail-v1',
        diff: `--- a/node_modules/lodash/index.js
+++ b/node_modules/lodash/index.js
@@ -1,1 +1,1 @@
-module.exports = {};
+module.exports = { hacked: true };`,
        commands: [],
        tests: [],
        notes: '',
      }));

      const result = await pipeline.run({
        projectPath: tempDir,
        agentOutputFile: outputFile,
        skipEntitlements: true,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('dry run mode', () => {
    it('validates without applying changes', async () => {
      const outputFile = path.join(tempDir, 'output.json');
      await fs.promises.writeFile(outputFile, JSON.stringify({
        format: 'guardrail-v1',
        diff: `--- a/src/file.ts
+++ b/src/file.ts
@@ -1,1 +1,2 @@
 const x = 1;
+const y = 2;`,
        commands: ['npm test'],
        tests: ['test/file.test.ts'],
        notes: 'Added y constant',
      }));

      // Create source file
      await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.promises.writeFile(path.join(tempDir, 'src', 'file.ts'), 'const x = 1;\n');

      const result = await pipeline.run({
        projectPath: tempDir,
        agentOutputFile: outputFile,
        dryRun: true,
        skipEntitlements: true,
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('done');
      
      // File should NOT be modified in dry run
      const content = await fs.promises.readFile(path.join(tempDir, 'src', 'file.ts'), 'utf8');
      expect(content).toBe('const x = 1;\n');
    });
  });

  describe('progress callbacks', () => {
    it('calls onProgress for each stage', async () => {
      const outputFile = path.join(tempDir, 'output.json');
      await fs.promises.writeFile(outputFile, JSON.stringify({
        format: 'guardrail-v1',
        diff: '',
        commands: [],
        tests: [],
        notes: '',
      }));

      const stages: string[] = [];
      await pipeline.run({
        projectPath: tempDir,
        agentOutputFile: outputFile,
        skipEntitlements: true,
        onProgress: (stage) => {
          stages.push(stage);
        },
      });

      expect(stages).toContain('init');
      expect(stages).toContain('validate');
      expect(stages).toContain('done');
    });
  });
});

describe('validateAgentOutput strictMarkdown option', () => {
  const projectRoot = '/tmp/project';

  it('rejects markdown in strict mode', () => {
    const raw = '```json\n{"format":"guardrail-v1","diff":"","commands":[],"tests":[],"notes":""}\n```';
    const result = validateAgentOutput(raw, projectRoot, { strictMarkdown: true });
    
    expect(result.valid).toBe(false);
    expect(result.wasMarkdownWrapped).toBe(true);
    expect(result.errors[0]).toContain('markdown');
  });

  it('accepts and strips markdown in forgiving mode', () => {
    const raw = '```json\n{"format":"guardrail-v1","diff":"","commands":[],"tests":[],"notes":""}\n```';
    const result = validateAgentOutput(raw, projectRoot);
    
    expect(result.valid).toBe(true);
    expect(result.wasMarkdownWrapped).toBe(true);
    expect(result.warnings.some(w => w.includes('markdown'))).toBe(true);
  });

  it('accepts raw JSON without warnings', () => {
    const raw = '{"format":"guardrail-v1","diff":"","commands":[],"tests":[],"notes":""}';
    const result = validateAgentOutput(raw, projectRoot);
    
    expect(result.valid).toBe(true);
    expect(result.wasMarkdownWrapped).toBe(false);
    expect(result.warnings.filter(w => w.includes('markdown'))).toHaveLength(0);
  });
});

describe('formatPipelineResult', () => {
  it('formats successful result', () => {
    const result: PipelineResult = {
      success: true,
      stage: 'done',
      duration: 1234,
      filesModified: ['src/file.ts'],
      errors: [],
      warnings: [],
      failureContext: [],
    };

    const output = formatPipelineResult(result);
    expect(output).toContain('SUCCESSFUL');
    expect(output).toContain('src/file.ts');
    expect(output).toContain('1234');
  });

  it('formats failed result with top 3 failures', () => {
    const result: PipelineResult = {
      success: false,
      stage: 'typecheck',
      duration: 500,
      filesModified: [],
      errors: ['TypeScript error'],
      warnings: [],
      failureContext: [
        'error TS2322: Type mismatch',
        'error TS2345: Argument type',
        'error TS2339: Property does not exist',
        'error TS2304: Cannot find name', // This 4th one should be cut off
      ],
    };

    const output = formatPipelineResult(result);
    expect(output).toContain('FAILED');
    expect(output).toContain('TS2322');
    expect(output).toContain('TS2345');
    expect(output).toContain('TS2339');
  });
});

describe('formatPipelineResultJson', () => {
  it('outputs valid JSON', () => {
    const result: PipelineResult = {
      success: true,
      stage: 'done',
      duration: 100,
      filesModified: ['a.ts'],
      errors: [],
      warnings: ['warn1'],
      failureContext: [],
    };

    const json = formatPipelineResultJson(result);
    const parsed = JSON.parse(json);
    
    expect(parsed.success).toBe(true);
    expect(parsed.filesModified).toEqual(['a.ts']);
    expect(parsed.warnings).toEqual(['warn1']);
  });
});
