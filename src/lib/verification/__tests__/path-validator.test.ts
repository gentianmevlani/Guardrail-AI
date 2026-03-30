/**
 * Path Validator Tests
 */

import { validatePath, validatePaths } from '../checks/path-validator';

describe('validatePath', () => {
  describe('valid paths', () => {
    it('should accept simple relative path', () => {
      const result = validatePath('src/utils/helper.ts');
      expect(result.status).toBe('pass');
    });

    it('should accept nested path', () => {
      const result = validatePath('packages/core/src/index.ts');
      expect(result.status).toBe('pass');
    });

    it('should accept path with dashes and underscores', () => {
      const result = validatePath('src/my-component/my_file.tsx');
      expect(result.status).toBe('pass');
    });
  });

  describe('path traversal', () => {
    it('should reject path with ..', () => {
      const result = validatePath('../../../etc/passwd');
      expect(result.status).toBe('fail');
      expect(result.message).toContain('traversal');
    });

    it('should reject path starting with /', () => {
      const result = validatePath('/etc/passwd');
      expect(result.status).toBe('fail');
    });

    it('should reject Windows absolute path', () => {
      const result = validatePath('C:\\Windows\\System32');
      expect(result.status).toBe('fail');
    });
  });

  describe('protected paths', () => {
    it('should reject .git directory', () => {
      const result = validatePath('.git/config');
      expect(result.status).toBe('fail');
      expect(result.message).toContain('protected');
    });

    it('should reject node_modules', () => {
      const result = validatePath('node_modules/lodash/index.js');
      expect(result.status).toBe('fail');
    });

    it('should reject .env file', () => {
      const result = validatePath('.env');
      expect(result.status).toBe('fail');
    });

    it('should reject .env.local', () => {
      const result = validatePath('.env.local');
      expect(result.status).toBe('fail');
    });

    it('should reject lockfiles', () => {
      expect(validatePath('package-lock.json').status).toBe('fail');
      expect(validatePath('pnpm-lock.yaml').status).toBe('fail');
      expect(validatePath('yarn.lock').status).toBe('fail');
    });
  });

  describe('scope lock', () => {
    const scopeLock = {
      allowedPaths: ['src/', 'tests/'],
      allowedCommands: [],
      maxFiles: 10,
      maxLinesChanged: 500,
    };

    it('should accept path within scope', () => {
      const result = validatePath('src/utils/helper.ts', scopeLock);
      expect(result.status).toBe('pass');
    });

    it('should reject path outside scope', () => {
      const result = validatePath('packages/core/index.ts', scopeLock);
      expect(result.status).toBe('fail');
      expect(result.message).toContain('scope');
    });
  });
});

describe('validatePaths', () => {
  it('should pass when all paths are valid', () => {
    const result = validatePaths([
      'src/index.ts',
      'src/utils/helper.ts',
      'tests/unit.test.ts',
    ]);
    expect(result.status).toBe('pass');
  });

  it('should fail when any path is invalid', () => {
    const result = validatePaths([
      'src/index.ts',
      '../../../etc/passwd',
      'tests/unit.test.ts',
    ]);
    expect(result.status).toBe('fail');
    expect(result.blockers).toBeDefined();
    expect(result.blockers?.length).toBeGreaterThan(0);
  });

  it('should fail when file count exceeds limit', () => {
    const scopeLock = {
      allowedPaths: [],
      allowedCommands: [],
      maxFiles: 2,
      maxLinesChanged: 500,
    };

    const result = validatePaths(
      ['file1.ts', 'file2.ts', 'file3.ts'],
      scopeLock
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('Too many files');
  });
});
