/**
 * Command Tooling Tests
 */

import { validateCommandTooling, validateCommandsTooling } from '../checks/command-tooling';
import { RepoFingerprint } from '../types';

describe('validateCommandTooling', () => {
  const pnpmFingerprint: RepoFingerprint = {
    packageManager: 'pnpm',
    framework: 'Next.js',
    monorepoTool: 'turbo',
    testRunner: 'jest',
    linter: 'eslint',
    typescript: true,
    scripts: { build: 'next build', test: 'jest' },
    hasGit: true,
  };

  const npmFingerprint: RepoFingerprint = {
    packageManager: 'npm',
    framework: 'Express',
    monorepoTool: null,
    testRunner: 'jest',
    linter: 'eslint',
    typescript: false,
    scripts: { start: 'node index.js' },
    hasGit: true,
  };

  describe('package manager detection', () => {
    it('should fail when using npm in pnpm project', () => {
      const result = validateCommandTooling('npm install lodash', pnpmFingerprint);
      expect(result.status).toBe('fail');
      expect(result.message).toContain('pnpm');
    });

    it('should fail when using yarn in npm project', () => {
      const result = validateCommandTooling('yarn add lodash', npmFingerprint);
      expect(result.status).toBe('fail');
    });

    it('should pass when using correct package manager', () => {
      const result = validateCommandTooling('pnpm install', pnpmFingerprint);
      expect(result.status).toBe('pass');
    });

    it('should pass when using npx with correct pm', () => {
      const result = validateCommandTooling('pnpm exec jest', pnpmFingerprint);
      expect(result.status).toBe('pass');
    });
  });

  describe('test runner detection', () => {
    const vitestFingerprint: RepoFingerprint = {
      ...pnpmFingerprint,
      testRunner: 'vitest',
    };

    it('should fail when using jest in vitest project', () => {
      const result = validateCommandTooling('npx jest', vitestFingerprint);
      expect(result.status).toBe('fail');
      expect(result.message).toContain('vitest');
    });

    it('should pass when using correct test runner', () => {
      const result = validateCommandTooling('npx vitest', vitestFingerprint);
      expect(result.status).toBe('pass');
    });
  });

  describe('monorepo tool suggestions', () => {
    it('should pass with turbo commands', () => {
      const result = validateCommandTooling('turbo run build', pnpmFingerprint);
      expect(result.status).toBe('pass');
    });
  });

  describe('no fingerprint', () => {
    const emptyFingerprint: RepoFingerprint = {
      packageManager: null,
      framework: null,
      monorepoTool: null,
      testRunner: null,
      linter: null,
      typescript: false,
      scripts: {},
      hasGit: false,
    };

    it('should pass any command when no tooling detected', () => {
      const result = validateCommandTooling('npm install', emptyFingerprint);
      expect(result.status).toBe('pass');
    });
  });
});

describe('validateCommandsTooling', () => {
  const fingerprint: RepoFingerprint = {
    packageManager: 'pnpm',
    framework: null,
    monorepoTool: null,
    testRunner: 'jest',
    linter: null,
    typescript: true,
    scripts: {},
    hasGit: true,
  };

  it('should pass when all commands match tooling', () => {
    const result = validateCommandsTooling(
      ['pnpm install', 'pnpm run build', 'pnpm test'],
      fingerprint
    );
    expect(result.status).toBe('pass');
  });

  it('should fail when any command mismatches', () => {
    const result = validateCommandsTooling(
      ['pnpm install', 'npm run build'],
      fingerprint
    );
    expect(result.status).toBe('fail');
  });

  it('should pass with empty commands', () => {
    const result = validateCommandsTooling([], fingerprint);
    expect(result.status).toBe('pass');
  });
});
