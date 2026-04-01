import { beforeAll, afterAll, afterEach, vi } from "vitest";

// Mock environment variables for tests
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-for-testing-minimum-32-characters";
process.env.DATABASE_URL =
  "postgresql://test:test@localhost:5432/guardrail_test";

// Global test utilities
beforeAll(() => {
  // Setup global mocks
  vi.mock("ioredis", () => ({
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      quit: vi.fn(),
    })),
  }));
});

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
});

afterAll(() => {
  // Cleanup after all tests
  vi.restoreAllMocks();
});

// Custom matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`,
      pass,
    };
  },
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
      pass,
    };
  },
});

// Extend Vitest types for custom matchers
declare module "vitest" {
  interface Assertion<T = any> {
    toBeValidUUID(): T;
    toBeWithinRange(floor: number, ceiling: number): T;
  }
  interface AsymmetricMatchersContaining {
    toBeValidUUID(): void;
    toBeWithinRange(floor: number, ceiling: number): void;
  }
}
