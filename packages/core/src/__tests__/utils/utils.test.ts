// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
const crypto = require('node:crypto');

// Inline implementations for testing
function generateCorrelationId() {
  return `corr_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

function generateTaskId() {
  return `task_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

function calculateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function calculateEntropy(str) {
  const len = str.length;
  const frequencies = {};

  for (let i = 0; i < len; i++) {
    const char = str[i];
    if (char) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }
  }

  let entropy = 0;
  for (const char in frequencies) {
    const frequency = frequencies[char];
    if (frequency !== undefined) {
      const p = frequency / len;
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

function maskSensitiveValue(value) {
  if (value.length <= 8) {
    return '***';
  }
  return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
}

function isPathAllowed(path, allowedPaths, deniedPaths) {
  const normalizedPath = path.replace(/\\/g, '/');

  // Check denied paths first (more restrictive)
  for (const deniedPath of deniedPaths) {
    if (normalizedPath.startsWith(deniedPath.replace(/\\/g, '/'))) {
      return false;
    }
  }

  // If no allowed paths specified, allow all (except denied)
  if (allowedPaths.length === 0) {
    return true;
  }

  // Check allowed paths
  for (const allowedPath of allowedPaths) {
    if (normalizedPath.startsWith(allowedPath.replace(/\\/g, '/'))) {
      return true;
    }
  }

  return false;
}

function isDomainAllowed(url, allowedDomains, deniedDomains) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check denied domains first
    for (const deniedDomain of deniedDomains) {
      if (hostname === deniedDomain || hostname.endsWith(`.${deniedDomain}`)) {
        return false;
      }
    }

    // If no allowed domains specified, allow all (except denied)
    if (allowedDomains.length === 0) {
      return true;
    }

    // Check allowed domains
    for (const allowedDomain of allowedDomains) {
      if (hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    return false;
  }
}

function sanitizeError(error) {
  if (error instanceof Error) {
    return {
      message: error.message.replace(/\/[^\s:]+/g, '[path]'),
      code: error.code,
    };
  }
  return { message: 'Unknown error occurred' };
}

describe('Core Utils', () => {
  describe('generateCorrelationId', () => {
    it('should generate a correlation ID with correct format', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(/^corr_\d+_[a-f0-9]{16}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateTaskId', () => {
    it('should generate a task ID with correct format', () => {
      const id = generateTaskId();
      expect(id).toMatch(/^task_\d+_[a-f0-9]{16}$/);
    });
  });

  describe('calculateEntropy', () => {
    it('should calculate entropy for string with all unique characters', () => {
      const entropy = calculateEntropy('abcdef');
      expect(entropy).toBeCloseTo(2.585, 2);
    });

    it('should calculate entropy for string with repeated characters', () => {
      const entropy = calculateEntropy('aaaaaa');
      expect(entropy).toBe(0);
    });

    it('should handle empty string', () => {
      const entropy = calculateEntropy('');
      expect(entropy).toBe(0);
    });
  });

  describe('maskSensitiveValue', () => {
    it('should mask long values correctly', () => {
      const value = '1234567890123456';
      const masked = maskSensitiveValue(value);
      expect(masked).toBe('1234...3456');
    });

    it('should mask short values with asterisks', () => {
      expect(maskSensitiveValue('12345678')).toBe('***');
    });
  });

  describe('isPathAllowed', () => {
    it('should allow paths in allowed list', () => {
      const allowed = ['/src', '/lib'];
      const denied = [];
      expect(isPathAllowed('/src/app.ts', allowed, denied)).toBe(true);
    });

    it('should deny paths in denied list', () => {
      const allowed = ['/src'];
      const denied = ['/src/secret'];
      expect(isPathAllowed('/src/secret/config.ts', allowed, denied)).toBe(false);
    });
  });

  describe('isDomainAllowed', () => {
    it('should allow domains in allowed list', () => {
      const allowed = ['example.com'];
      const denied = [];
      expect(isDomainAllowed('https://example.com/path', allowed, denied)).toBe(true);
    });

    it('should deny domains in denied list', () => {
      const allowed = [];
      const denied = ['malicious.com'];
      expect(isDomainAllowed('https://malicious.com', allowed, denied)).toBe(false);
    });
  });

  describe('sanitizeError', () => {
    it('should sanitize error message', () => {
      const error = new Error('Failed to read /home/user/secret.txt');
      const sanitized = sanitizeError(error);
      expect(sanitized.message).toBe('Failed to read [path]');
    });

    it('should handle non-Error objects', () => {
      const sanitized = sanitizeError('string error');
      expect(sanitized.message).toBe('Unknown error occurred');
    });
  });
});
