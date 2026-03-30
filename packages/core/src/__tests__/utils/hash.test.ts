// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
const crypto = require('node:crypto');

// Hash function for testing
function calculateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Helper function to verify hash
function verifyHash(input, hash) {
  if (!input || !hash) return false;
  const calculatedHash = crypto.createHash('sha256').update(input).digest('hex');
  return calculatedHash === hash;
}

describe('Hash Utils', () => {
  describe('calculateHash', () => {
    it('should generate consistent hash for same input', () => {
      const input = 'test-input';
      const hash1 = calculateHash(input);
      const hash2 = calculateHash(input);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = calculateHash('input1');
      const hash2 = calculateHash('input2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = calculateHash('');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle special characters', () => {
      const input = 'test with spaces and symbols !@#$%^&*()';
      const hash = calculateHash(input);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle unicode characters', () => {
      const input = '测试中文 🚀 emoji';
      const hash = calculateHash(input);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle very long strings', () => {
      const input = 'a'.repeat(10000);
      const hash = calculateHash(input);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('verifyHash', () => {
    it('should verify correct hash', () => {
      const input = 'test-input';
      const hash = calculateHash(input);
      
      expect(verifyHash(input, hash)).toBe(true);
    });

    it('should reject incorrect hash', () => {
      const input = 'test-input';
      const wrongHash = calculateHash('different-input');
      
      expect(verifyHash(input, wrongHash)).toBe(false);
    });

    it('should reject empty hash', () => {
      const input = 'test-input';
      
      expect(verifyHash(input, '')).toBe(false);
    });

    it('should reject invalid hash format', () => {
      const input = 'test-input';
      const invalidHash = 'invalid-hash';
      
      expect(verifyHash(input, invalidHash)).toBe(false);
    });

    it('should handle null/undefined inputs', () => {
      const hash = calculateHash('test');
      
      expect(verifyHash(null, hash)).toBe(false);
      expect(verifyHash(undefined, hash)).toBe(false);
    });
  });

  describe('Security Properties', () => {
    it('should generate different hashes for similar inputs', () => {
      const hash1 = calculateHash('password');
      const hash2 = calculateHash('password ');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should be case-sensitive', () => {
      const hash1 = calculateHash('Test');
      const hash2 = calculateHash('test');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce fixed-length hashes', () => {
      const inputs = ['a', 'abc', 'a long string with many characters'];
      const hashes = inputs.map(calculateHash);
      
      hashes.forEach(hash => {
        expect(hash.length).toBe(64);
      });
    });
  });
});
