const path = require("path");

/** Monorepo root — enables coverageThreshold paths like `./apps/api/src/`. */
const rootDir = path.resolve(__dirname, "..");

module.exports = {
  rootDir,
  testEnvironment: "node",
  roots: [
    "<rootDir>/src",
    "<rootDir>/packages",
    "<rootDir>/apps",
    "<rootDir>/tests",
  ],
  testMatch: [
    "**/__tests__/**/*.+(ts|tsx|js)",
    "**/*.(test|spec).+(ts|tsx|js)",
  ],
<<<<<<< HEAD
  /**
   * Ignored paths are run elsewhere — do not delete without wiring CI:
   * - Vitest-only tests → run in the owning package with Vitest.
   * - `packages/cli/tests/integration/*.test.ts` → Playwright (`pnpm --filter guardrail-cli-tool run test:integration`).
   * - `reality-integration.test.ts` → optional Jest with GUARDRAIL_REALITY_INTEGRATION=1.
   */
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/e2e/",
    "tests/e2e/",
    "tests/performance/",
    // ES module services handled by transform config
    "src/server/services/github-api-service.ts",
    // Vitest tests (run separately with vitest) - exclude all files that import vitest
    "src/lib/__tests__/architect-agent.test.ts",
    "src/lib/__tests__/polish-service.test.ts",
    "src/lib/__tests__/errors.test.ts",
    "src/lib/__tests__/natural-language-search.test.ts",
    "src/lib/__tests__/universal-guardrails.test.ts",
    "src/lib/__tests__/result-types.test.ts",
    "src/lib/__tests__/production-anomaly-predictor.test.ts",
    "src/lib/analysis/__tests__/static-analyzer.test.ts",
    "src/server/__tests__/mock-data-scanner.test.ts",
    "src/server/__tests__/code-search-service.test.ts",
    "src/server/__tests__/ai-explainer.test.ts",
    "src/server/middleware/__tests__/auth-rate-limiter.test.ts",
    "tests/usage-enforcement.test.ts",
    "tests/unit/analysis-engine.test.ts",
    "tests/security/ssrf-protection.test.ts",
    "tests/security/oauth-timeout.test.ts",
    "tests/security/error-handlers.test.ts",
    "tests/security/admin-middleware.test.ts",
    "tests/integration/api-routes.test.ts",
    "tests/compliance/compliance-dashboard.test.ts",
    "tests/billing/stripe-plan-mapping.test.ts",
    "tests/billing/seat-pricing.test.ts",
    "tests/billing/billing-edge-cases.test.ts",
    "packages/compliance/tests/audit.test.ts",
    "apps/api/src/__tests__/api-key-security.test.ts",
    "apps/api/src/__tests__/api-versioning.test.ts",
    "apps/web-ui/src/__tests__/setup.ts",
    "apps/web-ui/src/__tests__/components/HealthScoreCard.test.tsx",
    // Integration tests requiring database/native modules
    "src/server/__tests__/integration/api.test.ts",
    // Empty test files
    "src/services/__tests__/auth-service.test.ts",
    "tests/integration/ship-api.integration.test.ts",
<<<<<<< HEAD
    // Playwright-heavy; opt in with GUARDRAIL_REALITY_INTEGRATION=1 if needed
    "packages/cli/src/reality/__tests__/reality-integration.test.ts",
    // Playwright Test runner — run with `pnpm exec playwright test` separately
    "packages/cli/tests/integration/cli-features.test.ts",
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  ],
  preset: "ts-jest",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
        useESM: true,
      },
    ],
    "^.+\\.jsx?$": "babel-jest",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(.*\\.mjs$|@guardrail/core|@guardrail/database|@guardrail/security|@guardrail/ai-guardrails|@guardrail/compliance))",
    "packages/core/src/types.js",
  ],
  // Root `src/**/*.tsx` is excluded: istanbul uses Babel for collection and cannot parse JSX here.
  // React/UI coverage is enforced by Vitest in apps/web-ui (see CONTRIBUTING.md).
  collectCoverageFrom: [
    "<rootDir>/src/**/*.ts",
    "<rootDir>/packages/*/src/**/*.ts",
    "<rootDir>/apps/api/src/**/*.ts",
    "!<rootDir>/**/node_modules/**",
    "!<rootDir>/**/*.d.ts",
    "!<rootDir>/**/*.{test,spec}.ts",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov", "html", "json", "json-summary"],
  /**
   * Per-slice floors from `pnpm test -- --coverage` → `coverage/coverage-summary.json` (aggregated by path).
   * No global 80% gate. `glob` is pinned to ^7.x so babel-plugin-istanbul can instrument (see package.json overrides).
   */
  coverageThreshold: {
    "./src/": {
      branches: 3,
      functions: 2,
      lines: 3,
      statements: 3,
    },
    "./apps/api/src/": {
      branches: 2,
      functions: 2,
      lines: 2,
      statements: 2,
    },
    "./packages/ai-guardrails/src/": {
      branches: 8,
      functions: 21,
      lines: 18,
      statements: 18,
    },
    "./packages/cli/src/": {
      branches: 9,
      functions: 11,
      lines: 10,
      statements: 10,
    },
    "./packages/core/src/": {
      branches: 24,
      functions: 22,
      lines: 30,
      statements: 30,
    },
    "./packages/security/src/": {
      branches: 32,
      functions: 37,
      lines: 41,
      statements: 40,
    },
    "./packages/ship/src/": {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/config/jest.setup.js"],
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
      useESM: true,
    },
  },
  // @/ aliases resolve to apps/web-ui (canonical app). Root src/ is deprecated — do not map tests to ../src.
  moduleNameMapper: {
    "^@/lib/(.*)$": "<rootDir>/apps/web-ui/src/lib/$1",
    "^@/components/(.*)$": "<rootDir>/apps/web-ui/src/components/$1",
    "^@/hooks/(.*)$": "<rootDir>/apps/web-ui/src/hooks/$1",
    "^@/types/(.*)$": "<rootDir>/apps/web-ui/src/types/$1",
    "^@/features/(.*)$": "<rootDir>/apps/web-ui/src/features/$1",
    "^@/context/(.*)$": "<rootDir>/apps/web-ui/src/context/$1",
    "^@/server/(.*)$": "<rootDir>/apps/web-ui/src/server/$1",
    "^@/config/(.*)$": "<rootDir>/apps/web-ui/src/config/$1",
    "^@/(.*)$": "<rootDir>/apps/web-ui/src/$1",
    // Workspace packages
    "^@guardrail/core$": "<rootDir>/packages/core/src/index.ts",
    "^@guardrail/database$": "<rootDir>/packages/database/src/index.ts",
    "^@guardrail/security$": "<rootDir>/packages/security/src/index.ts",
    "^@guardrail/ai-guardrails$": "<rootDir>/packages/ai-guardrails/src/index.ts",
    "^@guardrail/compliance$": "<rootDir>/packages/compliance/src/index.ts",
  },
  verbose: true,
};
