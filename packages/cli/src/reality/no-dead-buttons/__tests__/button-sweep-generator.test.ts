/**
 * Tests for button sweep generator
 */

import { describe, it, expect } from '@jest/globals';
import { generateButtonSweepTest, generateCIButtonSweepTest } from '../button-sweep-generator';

describe('Button Sweep Generator', () => {
  it('should generate test code', () => {
    const testCode = generateButtonSweepTest({
      baseUrl: 'http://localhost:3000',
      pages: ['/'],
    });

    expect(testCode).toContain('Button Sweep - No Dead Buttons');
<<<<<<< HEAD
    expect(testCode).toContain('baseUrl');
=======
    expect(testCode).toContain('http://localhost:3000');
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    expect(testCode).toContain("test.describe('Button Sweep");
  });

  it('should include authentication if provided', () => {
    const testCode = generateButtonSweepTest({
      baseUrl: 'http://localhost:3000',
      auth: {
        email: 'test@example.com',
        password: 'password123',
      },
      pages: ['/'],
    });

    expect(testCode).toContain('test@example.com');
    expect(testCode).toContain('password123');
  });

  it('should generate CI version', () => {
    const testCode = generateCIButtonSweepTest({
      baseUrl: 'http://localhost:3000',
      pages: ['/'],
    });

    expect(testCode).toContain('Button Sweep');
    expect(testCode.length).toBeGreaterThan(0);
  });

  it('should handle multiple pages', () => {
    const testCode = generateButtonSweepTest({
      baseUrl: 'http://localhost:3000',
      pages: ['/', '/dashboard', '/settings'],
    });

    expect(testCode).toContain("should sweep buttons on /");
    expect(testCode).toContain("should sweep buttons on /dashboard");
    expect(testCode).toContain("should sweep buttons on /settings");
  });
});
