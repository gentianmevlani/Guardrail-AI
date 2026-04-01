module.exports = {
  // Extend base config
  ...require('./jest.config.js'),
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'apps/api/src/**/*.ts',
    'packages/*/src/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!**/__tests__/**',
    '!**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './packages/core/src': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './packages/security/src': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './packages/ai-guardrails/src': {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './apps/api/src': {
      branches: 65,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ]
};
