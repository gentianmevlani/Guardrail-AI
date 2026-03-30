/**
 * Tests for Reality Mode - Spawn Behavior
 * 
 * Mock tests for child_process spawn behavior to ensure:
 * - Correct command construction
 * - Exit code mirroring
 * - Output streaming
 * - Error handling
 */

import { runPlaywrightTests, createArtifactDirectory, type PlaywrightRunOptions } from '../reality-runner';
import { EventEmitter } from 'events';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock child_process
jest.mock('child_process', () => {
  const originalModule = jest.requireActual('child_process');
  return {
    ...originalModule,
    spawn: jest.fn(),
    execSync: jest.fn(() => 'Version 1.40.0'),
  };
});

describe('Reality Runner - Spawn Behavior', () => {
  let tempDir: string;
  let mockSpawn: jest.Mock;
  let mockChildProcess: any;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'guardrail-reality-spawn-test-'));
    
    // Get the mocked spawn function
    const childProcess = require('child_process');
    mockSpawn = childProcess.spawn as jest.Mock;
    
    // Create a mock child process
    mockChildProcess = new EventEmitter();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();
    mockChildProcess.kill = jest.fn();
    mockChildProcess.killed = false;
    
    mockSpawn.mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('should spawn Playwright with correct command', async () => {
    const artifacts = createArtifactDirectory(tempDir, 'test');
    const testFile = join(tempDir, 'test.ts');
    writeFileSync(testFile, 'test content');

    const options: PlaywrightRunOptions = {
      testFile,
      headless: true,
      timeout: 30,
      workers: 1,
      reporter: 'list',
      projectPath: tempDir,
      baseUrl: 'http://localhost:3000',
      flow: 'test',
    };

    const runPromise = runPlaywrightTests(options, artifacts, () => {});

    // Simulate process completion
    setTimeout(() => {
      mockChildProcess.emit('close', 0);
    }, 10);

    await runPromise;

    expect(mockSpawn).toHaveBeenCalled();
    const spawnArgs = mockSpawn.mock.calls[0];
    expect(spawnArgs[0]).toBe('npx');
    expect(spawnArgs[1]).toContain('playwright');
    expect(spawnArgs[1]).toContain('test');
  });

  it('should mirror Playwright exit code 0 for success', async () => {
    const artifacts = createArtifactDirectory(tempDir, 'test');
    const testFile = join(tempDir, 'test.ts');
    writeFileSync(testFile, 'test content');

    const options: PlaywrightRunOptions = {
      testFile,
      headless: true,
      timeout: 30,
      workers: 1,
      reporter: 'list',
      projectPath: tempDir,
      baseUrl: 'http://localhost:3000',
      flow: 'test',
    };

    const runPromise = runPlaywrightTests(options, artifacts, () => {});

    setTimeout(() => {
      mockChildProcess.emit('close', 0);
    }, 10);

    const result = await runPromise;

    expect(result.exitCode).toBe(0);
    expect(result.success).toBe(true);
  });

  it('should mirror Playwright exit code 1 for failure', async () => {
    const artifacts = createArtifactDirectory(tempDir, 'test');
    const testFile = join(tempDir, 'test.ts');
    writeFileSync(testFile, 'test content');

    const options: PlaywrightRunOptions = {
      testFile,
      headless: true,
      timeout: 30,
      workers: 1,
      reporter: 'list',
      projectPath: tempDir,
      baseUrl: 'http://localhost:3000',
      flow: 'test',
    };

    const runPromise = runPlaywrightTests(options, artifacts, () => {});

    setTimeout(() => {
      mockChildProcess.emit('close', 1);
    }, 10);

    const result = await runPromise;

    expect(result.exitCode).toBe(1);
    expect(result.success).toBe(false);
  });

  it('should capture stdout output', async () => {
    const artifacts = createArtifactDirectory(tempDir, 'test');
    const testFile = join(tempDir, 'test.ts');
    writeFileSync(testFile, 'test content');

    const options: PlaywrightRunOptions = {
      testFile,
      headless: true,
      timeout: 30,
      workers: 1,
      reporter: 'list',
      projectPath: tempDir,
      baseUrl: 'http://localhost:3000',
      flow: 'test',
    };

    const outputChunks: string[] = [];
    const runPromise = runPlaywrightTests(options, artifacts, (data) => {
      outputChunks.push(data);
    });

    setTimeout(() => {
      mockChildProcess.stdout.emit('data', Buffer.from('Test output line 1\n'));
      mockChildProcess.stdout.emit('data', Buffer.from('Test output line 2\n'));
      mockChildProcess.emit('close', 0);
    }, 10);

    await runPromise;

    expect(outputChunks).toContain('Test output line 1\n');
    expect(outputChunks).toContain('Test output line 2\n');
  });

  it('should capture stderr output', async () => {
    const artifacts = createArtifactDirectory(tempDir, 'test');
    const testFile = join(tempDir, 'test.ts');
    writeFileSync(testFile, 'test content');

    const options: PlaywrightRunOptions = {
      testFile,
      headless: true,
      timeout: 30,
      workers: 1,
      reporter: 'list',
      projectPath: tempDir,
      baseUrl: 'http://localhost:3000',
      flow: 'test',
    };

    const outputChunks: string[] = [];
    const runPromise = runPlaywrightTests(options, artifacts, (data) => {
      outputChunks.push(data);
    });

    setTimeout(() => {
      mockChildProcess.stderr.emit('data', Buffer.from('Error message\n'));
      mockChildProcess.emit('close', 1);
    }, 10);

    await runPromise;

    expect(outputChunks).toContain('Error message\n');
  });

  it('should handle spawn errors gracefully', async () => {
    const artifacts = createArtifactDirectory(tempDir, 'test');
    const testFile = join(tempDir, 'test.ts');
    writeFileSync(testFile, 'test content');

    const options: PlaywrightRunOptions = {
      testFile,
      headless: true,
      timeout: 30,
      workers: 1,
      reporter: 'list',
      projectPath: tempDir,
      baseUrl: 'http://localhost:3000',
      flow: 'test',
    };

    const runPromise = runPlaywrightTests(options, artifacts, () => {});

    setTimeout(() => {
      mockChildProcess.emit('error', new Error('ENOENT: command not found'));
    }, 10);

    const result = await runPromise;

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Failed to spawn Playwright');
  });

  it('should save artifacts on completion', async () => {
    const artifacts = createArtifactDirectory(tempDir, 'test');
    const testFile = join(tempDir, 'test.ts');
    writeFileSync(testFile, 'test content');

    const options: PlaywrightRunOptions = {
      testFile,
      headless: true,
      timeout: 30,
      workers: 1,
      reporter: 'list',
      projectPath: tempDir,
      baseUrl: 'http://localhost:3000',
      flow: 'test',
    };

    const runPromise = runPlaywrightTests(options, artifacts, () => {});

    setTimeout(() => {
      mockChildProcess.stdout.emit('data', Buffer.from('Test output\n'));
      mockChildProcess.emit('close', 0);
    }, 10);

    const result = await runPromise;

    expect(result.artifacts).toBeDefined();
    expect(result.artifacts.runId).toBeTruthy();
    expect(result.artifacts.artifactDir).toContain('.guardrail');
  });

  it('should return exit code 2 when Playwright not installed', async () => {
    // Mock execSync to throw error (Playwright not found)
    const childProcess = require('child_process');
    childProcess.execSync.mockImplementation(() => {
      throw new Error('Command not found');
    });

    const artifacts = createArtifactDirectory(tempDir, 'test');
    const testFile = join(tempDir, 'test.ts');
    writeFileSync(testFile, 'test content');

    const options: PlaywrightRunOptions = {
      testFile,
      headless: true,
      timeout: 30,
      workers: 1,
      reporter: 'list',
      projectPath: tempDir,
      baseUrl: 'http://localhost:3000',
      flow: 'test',
    };

    const result = await runPlaywrightTests(options, artifacts, () => {});

    expect(result.exitCode).toBe(2);
    expect(result.success).toBe(false);
  });
});
