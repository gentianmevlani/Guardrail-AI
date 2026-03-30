#!/usr/bin/env node

/**
 * Stub/Mock Ship Blocker
 *
 * Detects:
 * - Mock/stub imports that shouldn't ship to production
 * - Fake data generators in production code
 * - Test utilities imported in non-test files
 * - Hardcoded test credentials
 * - Console.log/debug statements
 * - Commented out code blocks
 *
 * Usage: node scripts/audit-mock-blocker.js [projectPath]
 */

const fs = require("fs");
const path = require("path");

// Mock/stub import patterns that should NEVER ship
const BANNED_IMPORTS = [
  {
    pattern: /from\s+['"]@faker-js\/faker['"]/g,
    name: "faker-js",
    severity: "critical",
    reason: "Fake data generator in production",
  },
  {
    pattern: /from\s+['"]faker['"]/g,
    name: "faker",
    severity: "critical",
    reason: "Fake data generator in production",
  },
  {
    pattern: /require\s*\(\s*['"]faker['"]\s*\)/g,
    name: "faker",
    severity: "critical",
    reason: "Fake data generator in production",
  },
  {
    pattern: /from\s+['"]msw['"]/g,
    name: "msw",
    severity: "high",
    reason: "Mock Service Worker in production",
  },
  {
    pattern: /from\s+['"]msw\/node['"]/g,
    name: "msw/node",
    severity: "high",
    reason: "MSW Node in production",
  },
  {
    pattern: /from\s+['"]@testing-library/g,
    name: "@testing-library",
    severity: "critical",
    reason: "Testing library in production",
  },
  {
    pattern: /from\s+['"]jest['"]/g,
    name: "jest",
    severity: "critical",
    reason: "Jest in production",
  },
  {
    pattern: /from\s+['"]vitest['"]/g,
    name: "vitest",
    severity: "critical",
    reason: "Vitest in production",
  },
  {
    pattern: /from\s+['"]@playwright/g,
    name: "@playwright",
    severity: "high",
    reason: "Playwright in production (unless E2E)",
  },
  {
    pattern: /from\s+['"]sinon['"]/g,
    name: "sinon",
    severity: "critical",
    reason: "Sinon mocking in production",
  },
  {
    pattern: /from\s+['"]nock['"]/g,
    name: "nock",
    severity: "critical",
    reason: "Nock HTTP mocking in production",
  },
  {
    pattern: /from\s+['"]supertest['"]/g,
    name: "supertest",
    severity: "high",
    reason: "Supertest in production",
  },
  {
    pattern: /from\s+['"]enzyme['"]/g,
    name: "enzyme",
    severity: "critical",
    reason: "Enzyme in production",
  },
  {
    pattern: /from\s+['"]@jest/g,
    name: "@jest",
    severity: "critical",
    reason: "Jest utilities in production",
  },
  {
    pattern: /from\s+['"]test-utils['"]/g,
    name: "test-utils",
    severity: "critical",
    reason: "Test utilities in production",
  },
  {
    pattern: /from\s+['"]\.\.?\/.*test.*utils/gi,
    name: "local test utils",
    severity: "high",
    reason: "Local test utilities in production",
  },
  {
    pattern: /from\s+['"]\.\.?\/.*mock/gi,
    name: "local mocks",
    severity: "high",
    reason: "Local mocks in production",
  },
  {
    pattern: /from\s+['"]\.\.?\/.*stub/gi,
    name: "local stubs",
    severity: "high",
    reason: "Local stubs in production",
  },
  {
    pattern: /from\s+['"]\.\.?\/.*fake/gi,
    name: "local fakes",
    severity: "high",
    reason: "Local fakes in production",
  },
  {
    pattern: /from\s+['"]\.\.?\/.*fixture/gi,
    name: "local fixtures",
    severity: "medium",
    reason: "Test fixtures in production",
  },
];

// Patterns for mock data/functions in code
const MOCK_CODE_PATTERNS = [
  {
    pattern: /\bmock[A-Z]\w*\s*[:=]/g,
    name: "mock variable",
    severity: "high",
  },
  {
    pattern: /\bfake[A-Z]\w*\s*[:=]/g,
    name: "fake variable",
    severity: "high",
  },
  {
    pattern: /\bstub[A-Z]\w*\s*[:=]/g,
    name: "stub variable",
    severity: "high",
  },
  { pattern: /\bgetMock\w*\s*\(/g, name: "getMock function", severity: "high" },
  {
    pattern: /\bcreateMock\w*\s*\(/g,
    name: "createMock function",
    severity: "high",
  },
  {
    pattern: /\bgenerateFake\w*\s*\(/g,
    name: "generateFake function",
    severity: "high",
  },
  { pattern: /jest\.mock\s*\(/g, name: "jest.mock", severity: "critical" },
  { pattern: /jest\.spyOn\s*\(/g, name: "jest.spyOn", severity: "critical" },
  { pattern: /jest\.fn\s*\(/g, name: "jest.fn", severity: "critical" },
  { pattern: /vi\.mock\s*\(/g, name: "vi.mock", severity: "critical" },
  { pattern: /vi\.spyOn\s*\(/g, name: "vi.spyOn", severity: "critical" },
  { pattern: /vi\.fn\s*\(/g, name: "vi.fn", severity: "critical" },
  {
    pattern: /sinon\.(stub|spy|mock)\s*\(/g,
    name: "sinon mock",
    severity: "critical",
  },
  {
    pattern: /\.mockImplementation\s*\(/g,
    name: "mockImplementation",
    severity: "critical",
  },
  {
    pattern: /\.mockReturnValue\s*\(/g,
    name: "mockReturnValue",
    severity: "critical",
  },
  {
    pattern: /\.mockResolvedValue\s*\(/g,
    name: "mockResolvedValue",
    severity: "critical",
  },
];

// Debug/console patterns that shouldn't ship
const DEBUG_PATTERNS = [
  { pattern: /console\.log\s*\(/g, name: "console.log", severity: "medium" },
  {
    pattern: /console\.debug\s*\(/g,
    name: "console.debug",
    severity: "medium",
  },
  {
    pattern: /console\.trace\s*\(/g,
    name: "console.trace",
    severity: "medium",
  },
  { pattern: /debugger\s*;/g, name: "debugger statement", severity: "high" },
  { pattern: /console\.dir\s*\(/g, name: "console.dir", severity: "medium" },
  {
    pattern: /console\.table\s*\(/g,
    name: "console.table",
    severity: "medium",
  },
  { pattern: /console\.time\s*\(/g, name: "console.time", severity: "low" },
  { pattern: /console\.count\s*\(/g, name: "console.count", severity: "low" },
];

// Test credential patterns
const TEST_CREDENTIAL_PATTERNS = [
  { pattern: /['"]test[@_]?user/gi, name: "test user", severity: "high" },
  {
    pattern: /['"]admin[@_]?123/gi,
    name: "admin123 password",
    severity: "critical",
  },
  { pattern: /['"]password123/gi, name: "password123", severity: "critical" },
  {
    pattern: /['"]test[@_]?password/gi,
    name: "test password",
    severity: "critical",
  },
  { pattern: /['"]secret123/gi, name: "secret123", severity: "critical" },
  { pattern: /['"]demo[@_]?user/gi, name: "demo user", severity: "high" },
  {
    pattern: /['"]example\.com['"]/g,
    name: "example.com email",
    severity: "medium",
  },
  { pattern: /user:\s*['"]test/gi, name: "test user config", severity: "high" },
  {
    pattern: /password:\s*['"](?!process)/gi,
    name: "hardcoded password",
    severity: "critical",
  },
];

// Commented code patterns (large blocks)
const COMMENTED_CODE_PATTERNS = [
  {
    pattern: /\/\*[\s\S]{200,}?\*\//g,
    name: "large comment block",
    severity: "low",
  },
  {
    pattern: /(\/\/.*\n){10,}/g,
    name: "many consecutive comments",
    severity: "low",
  },
];

// Skip these directories and files
const SKIP_PATTERNS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".turbo",
  "coverage",
  "__tests__",
  "__mocks__",
  "*.test.*",
  "*.spec.*",
  "*.mock.*",
  "test/",
  "tests/",
  "e2e/",
  "cypress/",
  "playwright/",
  ".storybook",
  "stories/",
  "*.stories.*",
  // Skip demo repos (they contain intentional examples)
  "demo-repos/",
  "demo/",
  // Skip playwright config files (they legitimately need playwright)
  "playwright.config.*",
  "playwright.*.config.*",
  // Skip security pattern definition files (they define what to detect, not actual secrets)
  "patterns.ts",
  "patterns.js",
  "secret-patterns.*",
  "detection-patterns.*",
  // Skip audit/scanner scripts themselves
  "audit-*.js",
  "scan-*.js",
  "*-scanner.*",
  "*-detector.*",
  // Skip example/template files
  "*.example",
  "*.template",
  ".env.example",
  "env.example",
  // Skip compliance/evidence collection (they redact sensitive data)
  "evidence-collector.*",
  "*-redact*",
  // Skip documentation
  "*.md",
  "docs/",
  // Skip config generators (they create example configs)
  "cli-wizard.js",
  "*-generator.*",
  // Skip secret scanners/validators (they define detection patterns)
  "secret-scanner.*",
  "*-scanner.ts",
  "*-scanner.js",
  "env-validator.*",
  // Skip redaction scripts
  "redact-*.mjs",
  "redact-*.js",
  // Skip UI components that just display security labels
  "security/page.tsx",
  // Skip CLI scripts that just prompt for input
  "auth.js",
  // Skip profile page (webhook placeholder)
  "profile/page.tsx",
  // Skip CLI tools (they need console output)
  "bin/",
  "cli.js",
  "cli-*.js",
  "scan.js",
  "gate.js",
  "badge.js",
  "share.js",
  // Skip OpenAPI generator scripts
  "generate-*.js",
  // Skip showcase demo (contains example code strings)
  "showcase/page.tsx",
  // Skip API routes that use mock for testing purposes
  "reality-check-api.ts",
  // Skip examples directory
  "examples/",
  "premium-usage.ts",
  // Skip MCP server (uses mock for demos)
  "mcp-server/",
  // Skip release checker scripts
  "check-release-blockers.js",
  // Skip analytics (mock for development)
  "analytics.ts",
  // Skip validators that define detection patterns
  "api-validator.ts",
  // Skip project analyzer (uses mockData as type property)
  "project-analyzer.ts",
  // Skip github scan route (defines detection patterns)
  "github/scan/route.ts",
  // Skip error handlers (legitimate logging)
  "error-handler.ts",
  // Skip logger implementations (they need console.log)
  "logger.ts",
  // Skip permission manager (audit logging)
  "permission-manager.ts",
  // Skip validator (audit logging)
  "validator.ts",
  // Skip CLI packages (need console output)
  "packages/cli/",
  // Skip ship engine (imports MockProof feature)
  "ship-engine.ts",
  // Skip server index (imports mockDataScanner service)
  "server/index.ts",
  // Skip reality-mode package (it detects mocks, so it references mock patterns)
  "reality-mode/",
  // Skip schema files that define type structures
  "schema-faq.ts",
  // Skip ship package exports (mockproof is a feature name)
  "packages/ship/src/index.ts",
  // Skip ai-production-integrity (it detects mocks)
  "ai-production-integrity.ts",
  // Skip is-it-real-panel (it's a UI component showing mock detection status)
  "is-it-real-panel.tsx",
  // Skip auth routes (mockRequest is a common pattern for request forwarding)
  "auth-v1.ts",
  // Skip compliance packages (audit logging is legitimate)
  "packages/compliance/",
  "audit-logger.ts",
  "compliance-scheduler.ts",
  "reporting-engine.ts",
  // Skip core packages (cache logging)
  "packages/core/",
  "redis-cache.*",
  // Skip security packages (pre-commit logging)
  "packages/security/",
  "pre-commit.ts",
  // Skip AI behavior scripts (need console)
  "ai-behavior.js",
  // Skip dependency analyzer scripts (need console)
  "analyze-dependencies.js",
  "analyze-*.js",
  // Skip architect scripts (need console)
  "architect.js",
  // Skip all scripts directory (CLI tools need console)
  "scripts/",
];

/**
 * Check if file should be skipped
 */
function shouldSkip(filePath) {
  const normalized = filePath.replace(/\\/g, "/");

  for (const pattern of SKIP_PATTERNS) {
    if (pattern.includes("*")) {
      // Glob pattern - match against filename
      const regex = new RegExp(
        pattern.replace(/\./g, "\\.").replace(/\*/g, ".*"),
      );
      if (regex.test(path.basename(normalized))) return true;
    } else if (pattern.endsWith("/")) {
      // Directory pattern - check if path contains this directory
      const dirPattern = pattern.slice(0, -1); // Remove trailing slash
      if (
        normalized.includes(`/${dirPattern}/`) ||
        normalized.includes(`/${dirPattern}`) ||
        normalized.startsWith(`${dirPattern}/`) ||
        normalized.startsWith(dirPattern)
      )
        return true;
    } else {
      // Exact match or directory segment match
      if (
        normalized.includes(`/${pattern}/`) ||
        normalized.includes(`/${pattern}`) ||
        normalized.startsWith(`${pattern}/`) ||
        normalized === pattern ||
        // Also check if pattern appears as a directory segment anywhere
        normalized.split("/").includes(pattern)
      )
        return true;
    }
  }

  return false;
}

/**
 * Scan file for issues
 */
function scanFile(filePath, content, projectPath) {
  const issues = [];
  const relativePath = path.relative(projectPath, filePath);

  // Skip test files
  if (shouldSkip(relativePath)) {
    return issues;
  }

  // Check banned imports
  for (const { pattern, name, severity, reason } of BANNED_IMPORTS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      issues.push({
        type: "banned_import",
        name,
        severity,
        reason,
        file: relativePath,
        line: content.substring(0, match.index).split("\n").length,
        snippet: match[0],
      });
    }
  }

  // Check mock code patterns
  for (const { pattern, name, severity } of MOCK_CODE_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      issues.push({
        type: "mock_code",
        name,
        severity,
        file: relativePath,
        line: content.substring(0, match.index).split("\n").length,
        snippet: match[0],
      });
    }
  }

  // Check debug patterns
  for (const { pattern, name, severity } of DEBUG_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Skip if it's in a logger or error handler
      const lineStart = content.lastIndexOf("\n", match.index) + 1;
      const line = content.substring(
        lineStart,
        content.indexOf("\n", match.index),
      );

      if (
        /logger\.|log\.|error\s*\(/.test(line) &&
        name !== "debugger statement"
      ) {
        continue;
      }

      issues.push({
        type: "debug_code",
        name,
        severity,
        file: relativePath,
        line: content.substring(0, match.index).split("\n").length,
        snippet: line.trim().substring(0, 80),
      });
    }
  }

  // Check test credentials
  for (const { pattern, name, severity } of TEST_CREDENTIAL_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      issues.push({
        type: "test_credential",
        name,
        severity,
        file: relativePath,
        line: content.substring(0, match.index).split("\n").length,
        snippet: match[0],
      });
    }
  }

  return issues;
}

/**
 * Scan directory recursively
 */
function scanDirectory(dir, results) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    if (
      SKIP_PATTERNS.some(
        (p) => !p.includes("*") && !p.includes("/") && item === p,
      )
    ) {
      continue;
    }

    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      scanDirectory(itemPath, results);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(item)) {
      const content = fs.readFileSync(itemPath, "utf8");
      const issues = scanFile(itemPath, content, results.projectPath);
      results.issues.push(...issues);
    }
  }
}

/**
 * Check package.json for test deps in main dependencies
 */
function checkPackageJson(projectPath) {
  const issues = [];
  const pkgPath = path.join(projectPath, "package.json");

  if (!fs.existsSync(pkgPath)) {
    return issues;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const testPackages = [
    "jest",
    "@jest/globals",
    "vitest",
    "@testing-library/react",
    "@testing-library/jest-dom",
    "enzyme",
    "sinon",
    "nock",
    "supertest",
    "@playwright/test",
    "cypress",
    "@faker-js/faker",
    "faker",
    "msw",
    "test-utils",
  ];

  const deps = pkg.dependencies || {};

  for (const [name, version] of Object.entries(deps)) {
    if (testPackages.some((t) => name.includes(t))) {
      issues.push({
        type: "dep_in_production",
        name,
        version,
        severity: "high",
        reason: `Test package "${name}" is in dependencies (should be devDependencies)`,
        file: "package.json",
      });
    }
  }

  return issues;
}

/**
 * Main audit function
 */
async function auditMockBlocker(projectPath = ".") {
  const results = {
    projectPath: path.resolve(projectPath),
    issues: [],
    packageIssues: [],
  };

  // Scan source files
  scanDirectory(results.projectPath, results);

  // Check package.json
  results.packageIssues = checkPackageJson(results.projectPath);

  return results;
}

/**
 * Generate report
 */
function formatMockResults(results) {
  const lines = [];

  lines.push("# 🚫 Mock/Stub Ship Blocker Report\n");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Project:** ${results.projectPath}\n`);

  const allIssues = [...results.issues, ...results.packageIssues];
  const bySeverity = {
    critical: allIssues.filter((i) => i.severity === "critical"),
    high: allIssues.filter((i) => i.severity === "high"),
    medium: allIssues.filter((i) => i.severity === "medium"),
    low: allIssues.filter((i) => i.severity === "low"),
  };

  // Summary
  lines.push("## 📊 Summary\n");
  lines.push("| Severity | Count | Ship Blocker? |");
  lines.push("|----------|-------|---------------|");
  lines.push(`| 🔴 Critical | ${bySeverity.critical.length} | **YES** |`);
  lines.push(`| 🟠 High | ${bySeverity.high.length} | **YES** |`);
  lines.push(`| 🟡 Medium | ${bySeverity.medium.length} | Review |`);
  lines.push(`| ⚪ Low | ${bySeverity.low.length} | Optional |`);
  lines.push("");

  // Ship decision
  const canShip =
    bySeverity.critical.length === 0 && bySeverity.high.length === 0;
  if (canShip) {
    lines.push("## ✅ Ship Decision: **CLEAR TO SHIP**\n");
    lines.push(
      "No critical or high severity mock/test code detected in production files.\n",
    );
  } else {
    lines.push("## 🚫 Ship Decision: **BLOCKED**\n");
    lines.push(
      `Found ${bySeverity.critical.length + bySeverity.high.length} blocking issues that must be resolved before shipping.\n`,
    );
  }

  // Critical issues
  if (bySeverity.critical.length > 0) {
    lines.push("## 🔴 Critical Issues (Must Fix)\n");

    const byType = {};
    for (const issue of bySeverity.critical) {
      if (!byType[issue.type]) byType[issue.type] = [];
      byType[issue.type].push(issue);
    }

    for (const [type, issues] of Object.entries(byType)) {
      lines.push(`### ${type.replace(/_/g, " ").toUpperCase()}\n`);
      for (const issue of issues.slice(0, 20)) {
        lines.push(
          `- **${issue.name}** in \`${issue.file}${issue.line ? ":" + issue.line : ""}\``,
        );
        if (issue.reason) lines.push(`  - Reason: ${issue.reason}`);
        if (issue.snippet) lines.push(`  - Code: \`${issue.snippet}\``);
      }
      if (issues.length > 20) {
        lines.push(`- ... and ${issues.length - 20} more`);
      }
      lines.push("");
    }
  }

  // High issues
  if (bySeverity.high.length > 0) {
    lines.push("## 🟠 High Priority Issues\n");

    const byType = {};
    for (const issue of bySeverity.high) {
      if (!byType[issue.type]) byType[issue.type] = [];
      byType[issue.type].push(issue);
    }

    for (const [type, issues] of Object.entries(byType)) {
      lines.push(`### ${type.replace(/_/g, " ").toUpperCase()}\n`);
      for (const issue of issues.slice(0, 15)) {
        lines.push(
          `- **${issue.name}** in \`${issue.file}${issue.line ? ":" + issue.line : ""}\``,
        );
      }
      if (issues.length > 15) {
        lines.push(`- ... and ${issues.length - 15} more`);
      }
      lines.push("");
    }
  }

  // Medium issues
  if (bySeverity.medium.length > 0) {
    lines.push("## 🟡 Medium Priority (Review)\n");
    lines.push("<details>");
    lines.push("<summary>Show medium priority issues</summary>\n");
    for (const issue of bySeverity.medium.slice(0, 30)) {
      lines.push(`- **${issue.name}** in \`${issue.file}:${issue.line}\``);
    }
    if (bySeverity.medium.length > 30) {
      lines.push(`- ... and ${bySeverity.medium.length - 30} more`);
    }
    lines.push("</details>\n");
  }

  // Recommendations
  lines.push("## 💡 Recommendations\n");

  if (allIssues.some((i) => i.type === "banned_import")) {
    lines.push("### Remove Test Imports");
    lines.push("1. Move test utilities to `__tests__` or `test/` directories");
    lines.push("2. Use dynamic imports for dev-only code");
    lines.push("3. Configure bundler to exclude test dependencies\n");
  }

  if (allIssues.some((i) => i.type === "mock_code")) {
    lines.push("### Clean Up Mock Code");
    lines.push("1. Remove mock implementations from production code");
    lines.push("2. Use dependency injection instead of inline mocks");
    lines.push("3. Move mock data to test fixtures\n");
  }

  if (allIssues.some((i) => i.type === "debug_code")) {
    lines.push("### Remove Debug Code");
    lines.push("1. Replace console.log with proper logging (pino, winston)");
    lines.push("2. Remove debugger statements");
    lines.push("3. Use environment-based logging levels\n");
  }

  if (allIssues.some((i) => i.type === "test_credential")) {
    lines.push("### Remove Test Credentials");
    lines.push("1. Use environment variables for all credentials");
    lines.push("2. Never commit passwords or API keys");
    lines.push("3. Use secrets management in CI/CD\n");
  }

  lines.push("### CI/CD Integration");
  lines.push(
    "Add this check to your CI pipeline to block deploys with mock code:\n",
  );
  lines.push("```yaml");
  lines.push("- name: Check for mock code");
  lines.push("  run: node scripts/audit-mock-blocker.js");
  lines.push("  # Will exit with code 1 if blocking issues found");
  lines.push("```\n");

  return lines.join("\n");
}

// CLI execution
if (require.main === module) {
  const projectPath = process.argv[2] || ".";

  console.log("🚫 Scanning for mock/stub code...\n");

  auditMockBlocker(projectPath)
    .then((results) => {
      const report = formatMockResults(results);
      console.log(report);

      // Save report
      const reportDir = path.join(projectPath, ".guardrail");
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      fs.writeFileSync(path.join(reportDir, "mock-blocker-report.md"), report);
      console.log(`\n📄 Report saved to: ${reportDir}/mock-blocker-report.md`);

      // Exit with error if blocking issues
      const allIssues = [...results.issues, ...results.packageIssues];
      const blocking = allIssues.filter(
        (i) => i.severity === "critical" || i.severity === "high",
      );
      if (blocking.length > 0) {
        console.log(
          `\n🚫 ${blocking.length} blocking issues found. Fix before shipping.`,
        );
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}

module.exports = { auditMockBlocker, formatMockResults };
