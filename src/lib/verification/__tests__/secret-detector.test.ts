/**
 * Secret Detector Tests
 */

import { validateFileForSecrets, validateFilesForSecrets } from '../checks/secret-detector';
import {
  STRIPE_LIVE_PREFIX,
  STRIPE_TEST_PREFIX,
} from './stripe-placeholder-prefix';

describe('validateFileForSecrets', () => {
  describe('AWS keys', () => {
    it('should detect AWS access key', () => {
      const content = `const accessKey = "AKIAIOSFODNN7EXAMPLE";`;
      const result = validateFileForSecrets(content, 'config.ts');
      expect(result.status).toBe('fail');
      expect(result.message).toContain('CRITICAL');
    });

    it('should detect AWS secret key pattern', () => {
      const content = `const aws_secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";`;
      const result = validateFileForSecrets(content, 'config.ts');
      expect(result.status).toBe('fail');
    });
  });

  describe('GitHub tokens', () => {
    it('should detect GitHub personal access token', () => {
      const content = `const token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";`;
      const result = validateFileForSecrets(content, 'auth.ts');
      expect(result.status).toBe('fail');
    });

    it('should detect GitHub OAuth token', () => {
      const content = `const token = "gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";`;
      const result = validateFileForSecrets(content, 'auth.ts');
      expect(result.status).toBe('fail');
    });
  });

  describe('other secrets', () => {
    it('should detect Stripe live key', () => {
      const liveBody = `${'x'.repeat(20)}1234`;
      const content = `const stripe = "${STRIPE_LIVE_PREFIX}${liveBody}";`;
      const result = validateFileForSecrets(content, 'payment.ts');
      expect(result.status).toBe('fail');
    });

    it('should detect private key header', () => {
      const content = `-----BEGIN RSA PRIVATE KEY-----
MIIEpQIBAAKCAQEA...
-----END RSA PRIVATE KEY-----`;
      const result = validateFileForSecrets(content, 'keys.pem');
      expect(result.status).toBe('fail');
    });

    it('should detect database URL with credentials', () => {
      const content = `DATABASE_URL="postgres://user:password123@localhost:5432/db"`;
      const result = validateFileForSecrets(content, 'config.ts');
      expect(result.status).toBe('fail');
    });

    it('should detect hardcoded password', () => {
      const content = `const config = { password: "mysecretpassword123" };`;
      const result = validateFileForSecrets(content, 'db.ts');
      expect(result.status).toBe('fail');
    });
  });

  describe('false positive handling', () => {
    it('should skip markdown files', () => {
      const content = `Example API key: AKIAIOSFODNN7EXAMPLE`;
      const result = validateFileForSecrets(content, 'README.md');
      expect(result.status).toBe('pass');
    });

    it('should skip test fixtures', () => {
      const content = `const fakeKey = "AKIAIOSFODNN7EXAMPLE";`;
      const result = validateFileForSecrets(content, '__mocks__/aws.ts');
      expect(result.status).toBe('pass');
    });

    it('should not flag environment variable references', () => {
      const content = `const key = process.env.AWS_ACCESS_KEY_ID;`;
      const result = validateFileForSecrets(content, 'config.ts');
      expect(result.status).toBe('pass');
    });

    it('should not flag placeholder values', () => {
      const content = `const key = "your-api-key-here";`;
      const result = validateFileForSecrets(content, 'config.ts');
      expect(result.status).toBe('pass');
    });
  });

  describe('Stripe test keys', () => {
    it('should warn about Stripe test key (medium severity)', () => {
      const testBody = `${'x'.repeat(20)}1234`;
      const content = `const stripe = "${STRIPE_TEST_PREFIX}${testBody}";`;
      const result = validateFileForSecrets(content, 'payment.ts');
      expect(result.status).toBe('warn');
    });
  });
});

describe('validateFilesForSecrets', () => {
  it('should pass when no secrets found', () => {
    const result = validateFilesForSecrets([
      { path: 'index.ts', content: 'console.log("hello");' },
      { path: 'utils.ts', content: 'export const add = (a: number, b: number) => a + b;' },
    ]);
    expect(result.status).toBe('pass');
  });

  it('should fail when secrets found in any file', () => {
    const result = validateFilesForSecrets([
      { path: 'index.ts', content: 'console.log("hello");' },
      { path: 'config.ts', content: 'const key = "AKIAIOSFODNN7EXAMPLE";' },
    ]);
    expect(result.status).toBe('fail');
    expect(result.blockers?.length).toBeGreaterThan(0);
  });
});
