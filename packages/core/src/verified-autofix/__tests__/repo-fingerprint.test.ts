/**
 * Repo Fingerprint Tests
 * 
 * Tests for project detection and configuration:
 * - Package manager detection
 * - Build tool detection
 * - Framework detection
 * - Test runner detection
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  fingerprintRepo,
  getInstallCommand,
  getBuildCommand,
  getTestCommand,
  getTypecheckCommand,
} from '../repo-fingerprint';

describe('fingerprintRepo', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fingerprint-test-'));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('detects pnpm from lock file', async () => {
    await fs.promises.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), '');
    await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test',
      dependencies: {},
    }));

    const { fingerprint } = fingerprintRepo(tempDir);
    expect(fingerprint.packageManager).toBe('pnpm');
  });

  it('detects yarn from lock file', async () => {
    await fs.promises.writeFile(path.join(tempDir, 'yarn.lock'), '');
    await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test',
    }));

    const { fingerprint } = fingerprintRepo(tempDir);
    expect(fingerprint.packageManager).toBe('yarn');
  });

  it('detects npm from lock file', async () => {
    await fs.promises.writeFile(path.join(tempDir, 'package-lock.json'), '{}');
    await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test',
    }));

    const { fingerprint } = fingerprintRepo(tempDir);
    expect(fingerprint.packageManager).toBe('npm');
  });

  it('detects Next.js framework', async () => {
    await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test',
      dependencies: { next: '^14.0.0', react: '^18.0.0' },
    }));

    const { fingerprint } = fingerprintRepo(tempDir);
    expect(fingerprint.framework).toBe('next');
  });

  it('detects Vite framework', async () => {
    await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test',
      devDependencies: { vite: '^5.0.0' },
    }));

    const { fingerprint } = fingerprintRepo(tempDir);
    expect(fingerprint.framework).toBe('vite');
  });

  it('detects Jest test runner', async () => {
    await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test',
      devDependencies: { jest: '^29.0.0' },
    }));

    const { fingerprint } = fingerprintRepo(tempDir);
    expect(fingerprint.testRunner).toBe('jest');
  });

  it('detects Vitest test runner', async () => {
    await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test',
      devDependencies: { vitest: '^1.0.0' },
    }));

    const { fingerprint } = fingerprintRepo(tempDir);
    expect(fingerprint.testRunner).toBe('vitest');
  });

  it('detects TypeScript', async () => {
    await fs.promises.writeFile(path.join(tempDir, 'tsconfig.json'), '{}');
    await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test',
    }));

    const { fingerprint } = fingerprintRepo(tempDir);
    expect(fingerprint.hasTypeScript).toBe(true);
  });

  it('detects Turbo build tool', async () => {
    await fs.promises.writeFile(path.join(tempDir, 'turbo.json'), '{}');
    await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test',
    }));

    const { fingerprint } = fingerprintRepo(tempDir);
    expect(fingerprint.buildTool).toBe('turbo');
  });

  it('detects monorepo from workspaces', async () => {
    await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'monorepo',
      workspaces: ['packages/*'],
    }));

    const { fingerprint } = fingerprintRepo(tempDir);
    expect(fingerprint.isMonorepo).toBe(true);
    expect(fingerprint.workspaces).toContain('packages/*');
  });

  it('detects build script', async () => {
    await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test',
      scripts: { build: 'tsc' },
    }));

    const { fingerprint } = fingerprintRepo(tempDir);
    expect(fingerprint.hasBuildScript).toBe(true);
  });

  it('handles missing package.json gracefully', () => {
    const { fingerprint, confidence, detectionNotes } = fingerprintRepo(tempDir);
    expect(fingerprint.packageManager).toBe('unknown');
    expect(confidence).toBeLessThan(100);
    expect(detectionNotes).toContain('No package.json found');
  });
});

describe('command helpers', () => {
  it('returns correct install command for pnpm', () => {
    expect(getInstallCommand('pnpm')).toBe('pnpm install --frozen-lockfile');
  });

  it('returns correct install command for yarn', () => {
    expect(getInstallCommand('yarn')).toBe('yarn install --frozen-lockfile');
  });

  it('returns correct install command for npm', () => {
    expect(getInstallCommand('npm')).toBe('npm ci');
  });

  it('returns turbo build command when turbo detected', () => {
    const fingerprint = {
      buildTool: 'turbo' as const,
      hasBuildScript: true,
      hasTypeScript: true,
      packageManager: 'pnpm' as const,
      framework: 'next' as const,
      testRunner: 'jest' as const,
      hasESLint: true,
      hasPrettier: true,
      hasTestScript: true,
      isMonorepo: true,
      workspaces: ['packages/*'],
      dependencies: {},
      devDependencies: {},
    };
    expect(getBuildCommand(fingerprint)).toBe('npx turbo run build');
  });

  it('returns vitest command for vitest runner', () => {
    const fingerprint = {
      testRunner: 'vitest' as const,
      hasTestScript: true,
      buildTool: 'none' as const,
      hasBuildScript: false,
      hasTypeScript: false,
      packageManager: 'npm' as const,
      framework: 'none' as const,
      hasESLint: false,
      hasPrettier: false,
      isMonorepo: false,
      workspaces: [],
      dependencies: {},
      devDependencies: {},
    };
    expect(getTestCommand(fingerprint)).toBe('npx vitest run');
  });

  it('returns typecheck command when TypeScript present', () => {
    const fingerprint = {
      hasTypeScript: true,
      testRunner: 'none' as const,
      hasTestScript: false,
      buildTool: 'none' as const,
      hasBuildScript: false,
      packageManager: 'npm' as const,
      framework: 'none' as const,
      hasESLint: false,
      hasPrettier: false,
      isMonorepo: false,
      workspaces: [],
      dependencies: {},
      devDependencies: {},
    };
    expect(getTypecheckCommand(fingerprint)).toBe('npx tsc --noEmit');
  });

  it('returns null typecheck command when no TypeScript', () => {
    const fingerprint = {
      hasTypeScript: false,
      testRunner: 'none' as const,
      hasTestScript: false,
      buildTool: 'none' as const,
      hasBuildScript: false,
      packageManager: 'npm' as const,
      framework: 'none' as const,
      hasESLint: false,
      hasPrettier: false,
      isMonorepo: false,
      workspaces: [],
      dependencies: {},
      devDependencies: {},
    };
    expect(getTypecheckCommand(fingerprint)).toBeNull();
  });
});
