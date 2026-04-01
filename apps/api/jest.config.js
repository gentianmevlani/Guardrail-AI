/**
 * Jest Configuration for API Tests
 */

module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: [
    "**/__tests__/**/*.+(ts|tsx|js)",
    "**/*.(test|spec).+(ts|tsx|js)",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/e2e/",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
      useESM: true,
    },
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@/lib/(.*)$": "<rootDir>/src/lib/$1",
    "^@/components/(.*)$": "<rootDir>/src/components/$1",
    "^@/hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@/types/(.*)$": "<rootDir>/src/types/$1",
    "^@/features/(.*)$": "<rootDir>/src/features/$1",
    "^@/server/(.*)$": "<rootDir>/src/server/$1",
    "^@/config/(.*)$": "<rootDir>/src/config/$1",
    // Workspace packages
    "^@guardrail/core$": "<rootDir>/../packages/core/src/index.ts",
    "^@guardrail/database$": "<rootDir>/../packages/database/src/index.ts",
    "^@guardrail/security$": "<rootDir>/../packages/security/src/index.ts",
    "^@guardrail/ai-guardrails$": "<rootDir>/../packages/ai-guardrails/src/index.ts",
    "^@guardrail/compliance$": "<rootDir>/../packages/compliance/src/index.ts",
    // Fix module mapping for tests
    "^@guardrail/core$": "<rootDir>/../packages/core/src/index.ts",
    "^@guardrail/database$": "<rootDir>/../packages/database/src/index.ts",
    "^@guardrail/security$": "<rootDir>/../packages/security/src/index.ts",
    "^@guardrail/ai-guardrails$": "<rootDir>/../packages/ai-guardrails/src/index.ts",
    "^@guardrail/compliance$": "<rootDir>/../packages/compliance/src/index.ts",
  },
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{ts,tsx}',
    '<rootDir>/packages/*/src/**/*.{ts,tsx}',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  // Floors aligned with monorepo `pnpm test -- --coverage` for apps/api/src (see config/jest.config.js).
  coverageThreshold: {
    "./src/": {
      branches: 2,
      functions: 2,
      lines: 2,
      statements: 2,
    },
  },
};
