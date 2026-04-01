/**
 * Integration tests for Reality Mode
 * 
 * Tests the full flow of:
 * - Generating tests
 * - Running tests with --run flag
 * - Recording tests with --record flag
 * 
 * These tests are conditionally executed based on Playwright availability
 */

import { 
  checkPlaywrightDependencies,
  createArtifactDirectory,
  copyTestToArtifacts,
  runPlaywrightTests,
  runPlaywrightCodegen,
  type PlaywrightRunOptions
} from '../reality-runner';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const hasPlaywright = (): boolean => {
  try {
    require.resolve('@playwright/test');
    return true;
  } catch {
    return false;
  }
};

const conditionalDescribe = hasPlaywright() ? describe : describe.skip;

conditionalDescribe('Reality Runner Integration (requires Playwright)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'guardrail-reality-integration-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Dependency Detection', () => {
    it('should detect Playwright installation', () => {
      const result = checkPlaywrightDependencies(process.cwd());
      
      expect(result.playwrightInstalled).toBe(true);
      expect(result.playwrightPath).toBeTruthy();
    });

    it('should provide correct install commands when not found', () => {
      const result = checkPlaywrightDependencies(tempDir);
      
      expect(result.playwrightInstalled).toBe(false);
      expect(result.installCommands).toContain('npm install -D @playwright/test');
      expect(result.installCommands).toContain('npx playwright install');
    });
  });

  describe('Artifact Management', () => {
    it('should create complete artifact directory structure', () => {
      const artifacts = createArtifactDirectory(tempDir, 'test-flow');
      
      expect(existsSync(artifacts.artifactDir)).toBe(true);
      expect(existsSync(artifacts.screenshotsDir)).toBe(true);
      expect(existsSync(artifacts.reportPath!)).toBe(true);
      expect(artifacts.testFilePath).toContain('reality-test-flow.test.ts');
    });

    it('should copy test file to artifacts', () => {
      const artifacts = createArtifactDirectory(tempDir, 'test-flow');
      const sourceTest = join(tempDir, 'source.test.ts');
      
      writeFileSync(sourceTest, 'test content');
      copyTestToArtifacts(sourceTest, artifacts);
      
      expect(existsSync(artifacts.testFilePath)).toBe(true);
    });
  });

  describe('Test Execution', () => {
    it('should handle missing dependencies gracefully', async () => {
      const artifacts = createArtifactDirectory(tempDir, 'test-flow');
      const testFile = join(tempDir, 'test.spec.ts');
      
      writeFileSync(testFile, `
        import { test, expect } from '@playwright/test';
        test('sample', async ({ page }) => {
          expect(true).toBe(true);
        });
      `);
      
      const options: PlaywrightRunOptions = {
        testFile,
        headless: true,
        timeout: 10,
        workers: 1,
        reporter: 'list',
        projectPath: tempDir,
        baseUrl: 'http://localhost:3000',
        flow: 'test-flow',
      };

      const outputs: string[] = [];
      const result = await runPlaywrightTests(
        options,
        artifacts,
        (data: string) => outputs.push(data)
      );

      // Should fail due to missing Playwright in tempDir
      expect(result.exitCode).toBe(2);
      expect(result.success).toBe(false);
    });
  });

  describe('Codegen Recording', () => {
    it('should return proper structure from runPlaywrightCodegen', async () => {
      const outputFile = join(tempDir, 'recorded.test.ts');
      
      // This will fail because there's no Playwright in tempDir, but we test the structure
      const result = await runPlaywrightCodegen(
        'http://example.com',
        outputFile,
        tempDir,
        () => {}
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('output');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.exitCode).toBe('number');
      expect(typeof result.output).toBe('string');
    });

    it('should fail gracefully when Playwright not installed in project', async () => {
      const outputFile = join(tempDir, 'recorded.test.ts');
      const outputs: string[] = [];
      
      const result = await runPlaywrightCodegen(
        'http://example.com',
        outputFile,
        tempDir,
        (data: string) => outputs.push(data)
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
      expect(outputs.some(o => o.includes('Install commands'))).toBe(true);
    });
  });

  describe('Full Workflow', () => {
    it('should create artifacts with metadata files', async () => {
      const artifacts = createArtifactDirectory(tempDir, 'full-test');
      const testFile = join(tempDir, 'test.spec.ts');
      
      writeFileSync(testFile, `
        import { test } from '@playwright/test';
        test('dummy', async () => {});
      `);
      
      copyTestToArtifacts(testFile, artifacts);

      const options: PlaywrightRunOptions = {
        testFile: artifacts.testFilePath,
        headless: true,
        timeout: 5,
        workers: 1,
        reporter: 'list',
        projectPath: tempDir,
        baseUrl: 'http://localhost:3000',
        flow: 'full-test',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
      };

      await runPlaywrightTests(options, artifacts, () => {});

      // Check that metadata files were created
      expect(existsSync(join(artifacts.artifactDir, 'run-metadata.json'))).toBe(true);
      expect(existsSync(join(artifacts.artifactDir, 'output.log'))).toBe(true);
      expect(existsSync(join(artifacts.artifactDir, 'result.json'))).toBe(true);
    });
  });
});

describe('Reality Runner Integration (mocked - no Playwright required)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'guardrail-reality-mock-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should handle spawn errors gracefully', async () => {
    const artifacts = createArtifactDirectory(tempDir, 'error-test');
    const testFile = join(tempDir, 'nonexistent.test.ts');
    
    const options: PlaywrightRunOptions = {
      testFile,
      headless: true,
      timeout: 5,
      workers: 1,
      reporter: 'list',
      projectPath: tempDir,
      baseUrl: 'http://localhost:3000',
      flow: 'error-test',
    };

    const result = await runPlaywrightTests(options, artifacts, () => {});

    expect(result.success).toBe(false);
    expect(result.exitCode).toBeGreaterThan(0);
  });

  it('should create unique artifact directories for concurrent runs', () => {
    const artifacts1 = createArtifactDirectory(tempDir, 'concurrent-1');
    const artifacts2 = createArtifactDirectory(tempDir, 'concurrent-2');
    const artifacts3 = createArtifactDirectory(tempDir, 'concurrent-1');

    expect(artifacts1.runId).not.toBe(artifacts2.runId);
    expect(artifacts1.runId).not.toBe(artifacts3.runId);
    expect(artifacts2.runId).not.toBe(artifacts3.runId);
  });
});
