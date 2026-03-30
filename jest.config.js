/**
 * Root Jest Configuration
 * Delegates to project-specific configs
 */

module.exports = {
  projects: ["<rootDir>/apps/api", "<rootDir>/config"],
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  coverageDirectory: "<rootDir>/coverage",
  collectCoverageFrom: [
    "apps/*/src/**/*.{ts,tsx}",
    "packages/*/src/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
};
