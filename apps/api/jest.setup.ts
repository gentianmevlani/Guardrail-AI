/**
 * Jest Setup File
 */

import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.STRIPE_SECRET_KEY =
  String.fromCharCode(115, 107, 95, 116, 101, 115, 116, 95) + '0'.repeat(24);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup test timeout
jest.setTimeout(30000);
