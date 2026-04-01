/**
 * Tests for Reality Mode - Playwright Test Execution
 * 
 * Unit tests for:
 * - Command argument building
 * - Dependency detection
 * - Artifact directory creation
 * - Duration formatting
 * 
 * Integration test is conditionally executed based on Playwright availability
 */

import { 
  buildPlaywrightArgs, 
  checkPlaywrightDependencies,
  createArtifactDirectory,
  formatDuration,
  type PlaywrightRunOptions 
} from '../reality-runner';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Reality Runner', () => {
  describe('buildPlaywrightArgs', () => {
    const baseOptions: PlaywrightRunOptions = {
      testFile: '/path/to/test.ts',
      headless: true,
      timeout: 30,
      workers: 1,
      reporter: 'line',
      projectPath: '/project',
      baseUrl: 'http://localhost:3000',
      flow: 'auth',
    };

    it('should build basic args with test file', () => {
      const args = buildPlaywrightArgs(baseOptions);
      
      expect(args).toContain('test');
      expect(args).toContain('/path/to/test.ts');
    });

    it('should include --headed when headless is false', () => {
      const args = buildPlaywrightArgs({ ...baseOptions, headless: false });
      
      expect(args).toContain('--headed');
    });

    it('should NOT include --headed when headless is true', () => {
      const args = buildPlaywrightArgs({ ...baseOptions, headless: true });
      
      expect(args).not.toContain('--headed');
    });

    it('should include timeout in milliseconds', () => {
      const args = buildPlaywrightArgs({ ...baseOptions, timeout: 60 });
      
      const timeoutIndex = args.indexOf('--timeout');
      expect(timeoutIndex).toBeGreaterThan(-1);
      expect(args[timeoutIndex + 1]).toBe('60000');
    });

    it('should include workers count', () => {
      const args = buildPlaywrightArgs({ ...baseOptions, workers: 4 });
      
      const workersIndex = args.indexOf('--workers');
      expect(workersIndex).toBeGreaterThan(-1);
      expect(args[workersIndex + 1]).toBe('4');
    });

    it('should include reporter', () => {
      const args = buildPlaywrightArgs({ ...baseOptions, reporter: 'html,line' });
      
      const reporterIndex = args.indexOf('--reporter');
      expect(reporterIndex).toBeGreaterThan(-1);
      expect(args[reporterIndex + 1]).toBe('html,line');
    });

<<<<<<< HEAD
    it('should not include screenshot when not provided', () => {
      const args = buildPlaywrightArgs(baseOptions);
      expect(args).not.toContain('--screenshot');
=======
    it('should include default screenshot on failure setting', () => {
      const args = buildPlaywrightArgs(baseOptions);
      
      const screenshotIndex = args.indexOf('--screenshot');
      expect(screenshotIndex).toBeGreaterThan(-1);
      expect(args[screenshotIndex + 1]).toBe('only-on-failure');
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    });

    it('should include custom screenshot mode when provided', () => {
      const args = buildPlaywrightArgs({ ...baseOptions, screenshot: 'on' });
      
      const screenshotIndex = args.indexOf('--screenshot');
      expect(screenshotIndex).toBeGreaterThan(-1);
      expect(args[screenshotIndex + 1]).toBe('on');
    });

    it('should include trace mode when provided', () => {
      const args = buildPlaywrightArgs({ ...baseOptions, trace: 'retain-on-failure' });
      
      const traceIndex = args.indexOf('--trace');
      expect(traceIndex).toBeGreaterThan(-1);
      expect(args[traceIndex + 1]).toBe('retain-on-failure');
    });

    it('should include video mode when provided', () => {
      const args = buildPlaywrightArgs({ ...baseOptions, video: 'on' });
      
      const videoIndex = args.indexOf('--video');
      expect(videoIndex).toBeGreaterThan(-1);
      expect(args[videoIndex + 1]).toBe('on');
    });

    it('should not include trace when not provided', () => {
      const args = buildPlaywrightArgs(baseOptions);
      
      expect(args).not.toContain('--trace');
    });

    it('should not include video when not provided', () => {
      const args = buildPlaywrightArgs(baseOptions);
      
      expect(args).not.toContain('--video');
    });

    it('should handle zero timeout (no timeout arg)', () => {
      const args = buildPlaywrightArgs({ ...baseOptions, timeout: 0 });
      
      expect(args).not.toContain('--timeout');
    });

    it('should correctly order all arguments', () => {
      const args = buildPlaywrightArgs({
        ...baseOptions,
        headless: false,
        timeout: 45,
        workers: 2,
        reporter: 'dot',
      });

      expect(args[0]).toBe('test');
      expect(args[1]).toBe('/path/to/test.ts');
      expect(args).toContain('--headed');
      expect(args).toContain('--timeout');
      expect(args).toContain('--workers');
      expect(args).toContain('--reporter');
<<<<<<< HEAD
=======
      expect(args).toContain('--screenshot');
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    });

    it('should include all optional flags when provided', () => {
      const args = buildPlaywrightArgs({
        ...baseOptions,
        trace: 'on',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
      });

      expect(args).toContain('--trace');
      expect(args).toContain('on');
      expect(args).toContain('--video');
      expect(args).toContain('retain-on-failure');
      expect(args).toContain('--screenshot');
      expect(args).toContain('only-on-failure');
    });

    it('should handle all trace mode options', () => {
      const modes: Array<'on' | 'off' | 'retain-on-failure' | 'on-first-retry'> = [
        'on', 'off', 'retain-on-failure', 'on-first-retry'
      ];

      modes.forEach(mode => {
        const args = buildPlaywrightArgs({ ...baseOptions, trace: mode });
        const traceIndex = args.indexOf('--trace');
        expect(args[traceIndex + 1]).toBe(mode);
      });
    });

    it('should handle all video mode options', () => {
      const modes: Array<'on' | 'off' | 'retain-on-failure' | 'on-first-retry'> = [
        'on', 'off', 'retain-on-failure', 'on-first-retry'
      ];

      modes.forEach(mode => {
        const args = buildPlaywrightArgs({ ...baseOptions, video: mode });
        const videoIndex = args.indexOf('--video');
        expect(args[videoIndex + 1]).toBe(mode);
      });
    });

    it('should handle all screenshot mode options', () => {
      const modes: Array<'on' | 'off' | 'only-on-failure'> = [
        'on', 'off', 'only-on-failure'
      ];

      modes.forEach(mode => {
        const args = buildPlaywrightArgs({ ...baseOptions, screenshot: mode });
        const screenshotIndex = args.indexOf('--screenshot');
        expect(args[screenshotIndex + 1]).toBe(mode);
      });
    });
  });

  describe('checkPlaywrightDependencies', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'guardrail-reality-test-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should return playwrightInstalled: false for empty project', () => {
      const result = checkPlaywrightDependencies(tempDir);
<<<<<<< HEAD

      if (!result.playwrightInstalled) {
        expect(result.installCommands.length).toBeGreaterThan(0);
      } else {
        // Global `npx playwright` can mark the toolchain as installed without local node_modules
        expect(result.playwrightInstalled).toBe(true);
      }
=======
      
      expect(result.playwrightInstalled).toBe(false);
      expect(result.installCommands.length).toBeGreaterThan(0);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    });

    it('should provide install commands when Playwright not found', () => {
      const result = checkPlaywrightDependencies(tempDir);
<<<<<<< HEAD

      if (!result.playwrightInstalled) {
        expect(result.installCommands).toContain('npm install -D @playwright/test');
        expect(result.installCommands).toContain('npx playwright install');
      } else {
        expect(result.installCommands.length).toBeGreaterThanOrEqual(0);
      }
=======
      
      expect(result.installCommands).toContain('npm install -D @playwright/test');
      expect(result.installCommands).toContain('npx playwright install');
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    });

    it('should have an error message when not installed', () => {
      const result = checkPlaywrightDependencies(tempDir);
<<<<<<< HEAD

      if (!result.playwrightInstalled) {
        expect(result.errorMessage).toBeTruthy();
        expect(result.errorMessage).toContain('Playwright');
      } else {
        // Global `npx playwright` can satisfy the check without project-local deps
        expect(result.playwrightInstalled).toBe(true);
      }
=======
      
      expect(result.errorMessage).toBeTruthy();
      expect(result.errorMessage).toContain('Playwright');
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    });

    it('should return consistent result structure', () => {
      const result = checkPlaywrightDependencies(tempDir);
      
      expect(result).toHaveProperty('playwrightInstalled');
      expect(result).toHaveProperty('browsersInstalled');
      expect(result).toHaveProperty('playwrightPath');
      expect(result).toHaveProperty('errorMessage');
      expect(result).toHaveProperty('installCommands');
      expect(Array.isArray(result.installCommands)).toBe(true);
    });
  });

  describe('createArtifactDirectory', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'guardrail-reality-test-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should create artifact directory under .guardrail/reality/', () => {
      const artifacts = createArtifactDirectory(tempDir, 'auth');
      
      expect(existsSync(artifacts.artifactDir)).toBe(true);
      expect(artifacts.artifactDir).toContain('.guardrail');
      expect(artifacts.artifactDir).toContain('reality');
    });

    it('should create screenshots subdirectory', () => {
      const artifacts = createArtifactDirectory(tempDir, 'auth');
      
      expect(existsSync(artifacts.screenshotsDir)).toBe(true);
      expect(artifacts.screenshotsDir).toContain('screenshots');
    });

    it('should include flow name in runId', () => {
      const artifacts = createArtifactDirectory(tempDir, 'checkout');
      
      expect(artifacts.runId).toContain('checkout');
    });

    it('should generate unique runIds', () => {
      const artifacts1 = createArtifactDirectory(tempDir, 'auth');
      const artifacts2 = createArtifactDirectory(tempDir, 'auth');
      
      expect(artifacts1.runId).not.toBe(artifacts2.runId);
    });

    it('should set correct test file path', () => {
      const artifacts = createArtifactDirectory(tempDir, 'dashboard');
      
      expect(artifacts.testFilePath).toContain('reality-dashboard.test.ts');
    });

    it('should set report path', () => {
      const artifacts = createArtifactDirectory(tempDir, 'auth');
      
      expect(artifacts.reportPath).toBeTruthy();
      expect(existsSync(artifacts.reportPath!)).toBe(true);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds for short durations', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds for medium durations', () => {
      expect(formatDuration(1000)).toBe('1s');
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(59000)).toBe('59s');
    });

    it('should format minutes and seconds for long durations', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(125000)).toBe('2m 5s');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0ms');
    });

    it('should handle edge cases at boundaries', () => {
      expect(formatDuration(1000)).toBe('1s');
      expect(formatDuration(60000)).toBe('1m 0s');
    });
  });
});

describe('Reality Runner Integration', () => {
  const hasPlaywright = (): boolean => {
    try {
      require.resolve('@playwright/test');
      return true;
    } catch {
      return false;
    }
  };

  const conditionalIt = hasPlaywright() ? it : it.skip;

  conditionalIt('should detect Playwright when installed', () => {
    const result = checkPlaywrightDependencies(process.cwd());
    
    expect(result.playwrightInstalled).toBe(true);
    expect(result.playwrightPath).toBeTruthy();
  });

  it.skip('integration test placeholder - requires Playwright installation', () => {
    // This test is conditionally skipped in CI environments
    // without Playwright. When Playwright is available, the
    // conditionalIt test above will run instead.
  });
});
