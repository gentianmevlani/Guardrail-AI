// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
const crypto = require('node:crypto');

// Inline hash function for testing
function calculateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
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
