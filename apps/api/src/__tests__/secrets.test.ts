/**
 * Tests for secrets validation
 * Ensures production mode refuses to boot without proper secrets
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { getDatabaseUrl, getFrontendUrl, getJwtSecret, validateSecrets } from '../config/secrets';

// Simple test approach - we'll test the behavior by calling the actual functions
// and setting environment variables through Node's process.env (which is mutable in tests)

describe('Secrets Validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Clear relevant environment variables
    delete process.env.NODE_ENV;
    delete process.env.DEV_FLAG;
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.FRONTEND_URL;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Development Mode', () => {
    it('should fail without DEV_FLAG when secrets are missing', () => {
      process.env.NODE_ENV = 'development';
      // DEV_FLAG is not set
      
      const result = validateSecrets();
      
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('JWT_SECRET');
    });

    it('should allow fallbacks with DEV_FLAG=true', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEV_FLAG = 'true';
      
      const result = validateSecrets();
      
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should work with explicit secrets', () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'strong-secret-key-that-is-long-enough-for-validation';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.FRONTEND_URL = 'http://localhost:3001';
      
      const result = validateSecrets();
      
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.weak).toHaveLength(0);
    });

    it('should warn about weak secrets in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'short';
      
      const result = validateSecrets();
      
      expect(result.valid).toBe(true); // Still valid in dev
      expect(result.weak).toContain('JWT_SECRET (too short - must be at least 32 characters)');
    });
  });

  describe('Production Mode', () => {
    it('should fail fast without JWT_SECRET', () => {
      process.env.NODE_ENV = 'production';
      
      expect(() => {
        validateSecrets();
      }).toThrow('Production security validation failed: JWT_SECRET');
    });

    it('should fail fast without DATABASE_URL', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'strong-production-secret-key-that-is-definitely-long-enough';
      
      expect(() => {
        validateSecrets();
      }).toThrow('Production security validation failed: DATABASE_URL');
    });

    it('should fail fast without FRONTEND_URL', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'strong-production-secret-key-that-is-definitely-long-enough';
      process.env.DATABASE_URL = 'postgresql://prod-host:5432/prod_db';
      
      expect(() => {
        validateSecrets();
      }).toThrow('Production security validation failed: FRONTEND_URL');
    });

    it('should fail fast with weak JWT_SECRET', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'short';
      process.env.DATABASE_URL = 'postgresql://prod-host:5432/prod_db';
      process.env.FRONTEND_URL = 'https://app.example.com';
      
      expect(() => {
        validateSecrets();
      }).toThrow('Production security validation failed: JWT_SECRET (too short - must be at least 32 characters)');
    });

    it('should fail fast with development-looking secrets', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'dev-only-secret-do-not-use-in-production';
      process.env.DATABASE_URL = 'postgresql://prod-host:5432/prod_db';
      process.env.FRONTEND_URL = 'https://app.example.com';
      
      expect(() => {
        validateSecrets();
      }).toThrow('Production security validation failed: JWT_SECRET (appears to be a development secret)');
    });

    it('should fail fast with invalid database URL', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'strong-production-secret-key-that-is-definitely-long-enough';
      process.env.DATABASE_URL = 'mongodb://localhost:27017/test'; // Not PostgreSQL
      process.env.FRONTEND_URL = 'https://app.example.com';
      
      expect(() => {
        validateSecrets();
      }).toThrow('Production security validation failed: DATABASE_URL (must be a PostgreSQL connection string)');
    });

    it('should pass with valid production secrets', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'strong-production-secret-key-that-is-definitely-long-enough-and-not-dev';
      process.env.DATABASE_URL = 'postgresql://prod-host:5432/prod_db';
      process.env.FRONTEND_URL = 'https://app.example.com';
      
      const result = validateSecrets();
      
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.weak).toHaveLength(0);
    });
  });

  describe('Individual Secret Functions', () => {
    describe('getJwtSecret', () => {
      it('should throw in production without JWT_SECRET', () => {
        process.env.NODE_ENV = 'production';
        
        expect(() => {
          getJwtSecret();
        }).toThrow('JWT_SECRET environment variable is required in production');
      });

      it('should throw in development without DEV_FLAG', () => {
        process.env.NODE_ENV = 'development';
        
        expect(() => {
          getJwtSecret();
        }).toThrow('JWT_SECRET environment variable is required (set DEV_FLAG=true for development defaults)');
      });

      it('should return fallback in development with DEV_FLAG', () => {
        process.env.NODE_ENV = 'development';
        process.env.DEV_FLAG = 'true';
        
        const secret = getJwtSecret();
        expect(secret).toBe('dev-only-secret-do-not-use-in-production');
      });

      it('should throw in production with weak secret', () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'short';
        
        expect(() => {
          getJwtSecret();
        }).toThrow('JWT_SECRET is less than 32 characters');
      });

      it('should throw in production with development secret', () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'dev-only-secret-do-not-use-in-production';
        
        expect(() => {
          getJwtSecret();
        }).toThrow('JWT_SECRET appears to be a development/weak secret');
      });
    });

    describe('getDatabaseUrl', () => {
      it('should throw in production without DATABASE_URL', () => {
        process.env.NODE_ENV = 'production';
        
        expect(() => {
          getDatabaseUrl();
        }).toThrow('DATABASE_URL environment variable is required in production');
      });

      it('should throw in development without DEV_FLAG', () => {
        process.env.NODE_ENV = 'development';
        
        expect(() => {
          getDatabaseUrl();
        }).toThrow('DATABASE_URL environment variable is required (set DEV_FLAG=true for development defaults)');
      });

      it('should return fallback in development with DEV_FLAG', () => {
        process.env.NODE_ENV = 'development';
        process.env.DEV_FLAG = 'true';
        
        const url = getDatabaseUrl();
        expect(url).toBe('postgresql://localhost:5432/guardrail_dev');
      });

      it('should throw in production with non-PostgreSQL URL', () => {
        process.env.NODE_ENV = 'production';
        process.env.DATABASE_URL = 'mongodb://localhost:27017/test';
        
        expect(() => {
          getDatabaseUrl();
        }).toThrow('DATABASE_URL must be a valid PostgreSQL connection string in production');
      });
    });

    describe('getFrontendUrl', () => {
      it('should throw in production without FRONTEND_URL', () => {
        process.env.NODE_ENV = 'production';
        
        expect(() => {
          getFrontendUrl();
        }).toThrow('FRONTEND_URL environment variable is required in production');
      });

      it('should throw in development without DEV_FLAG', () => {
        process.env.NODE_ENV = 'development';
        
        expect(() => {
          getFrontendUrl();
        }).toThrow('FRONTEND_URL environment variable is required (set DEV_FLAG=true for development defaults)');
      });

      it('should return fallback in development with DEV_FLAG', () => {
        process.env.NODE_ENV = 'development';
        process.env.DEV_FLAG = 'true';
        
        const url = getFrontendUrl();
        expect(url).toBe('http://localhost:3001');
      });
    });
  });
});
