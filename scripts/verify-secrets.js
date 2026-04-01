#!/usr/bin/env node
/**
 * Secrets Verification Script
 *
 * Scans codebase for:
 * - Hardcoded secrets patterns
 * - Fallback secret values
 * - .env files in git
 *
 * Exit codes:
 *   0 = PASS (no issues)
 *   1 = FAIL (issues found)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const {
  stripeSkLiveRegex24Scan,
  stripeSkTestRegex24Scan,
  stripePkLiveRegex24Scan,
} = require("../bin/runners/lib/stripe-scan-patterns");

const ROOT_DIR = path.resolve(__dirname, "..");

// Patterns that indicate hardcoded secrets
const SECRET_PATTERNS = [
  // Specific dangerous fallback patterns for secrets (not general fallbacks)
  {
    pattern: /(?:JWT|SESSION|COOKIE|CSRF|AUTH)_SECRET.*\|\|\s*['"][^'"]+['"]/i,
    name: "Secret with fallback value",
    severity: "CRITICAL",
  },
  {
    pattern:
      /your-secret-key|change-in-production|fallback-secret|fallback-refresh/i,
    name: "Placeholder secret",
    severity: "CRITICAL",
  },

  // Actual secret patterns
  {
    pattern: stripeSkLiveRegex24Scan(),
    name: "Stripe live secret key",
    severity: "CRITICAL",
  },
  {
    pattern: stripeSkTestRegex24Scan(),
    name: "Stripe test secret key",
    severity: "MEDIUM",
  },
  {
    pattern: stripePkLiveRegex24Scan(),
    name: "Stripe live publishable key",
    severity: "HIGH",
  },
  {
    pattern: /whsec_[a-zA-Z0-9]{24,}/,
    name: "Stripe webhook secret",
    severity: "CRITICAL",
  },
  {
    pattern: /ghp_[a-zA-Z0-9]{36,}/,
    name: "GitHub personal access token",
    severity: "CRITICAL",
  },
  {
    pattern: /gho_[a-zA-Z0-9]{36,}/,
    name: "GitHub OAuth token",
    severity: "CRITICAL",
  },
  {
    pattern: /github_pat_[a-zA-Z0-9_]{22,}/,
    name: "GitHub fine-grained PAT",
    severity: "CRITICAL",
  },
  {
    pattern: /sk-[a-zA-Z0-9]{48,}/,
    name: "OpenAI API key",
    severity: "CRITICAL",
  },
  {
    pattern: /sk-ant-[a-zA-Z0-9\-_]{90,}/,
    name: "Anthropic API key",
    severity: "CRITICAL",
  },
  {
    pattern: /AKIA[A-Z0-9]{16}/,
    name: "AWS Access Key ID",
    severity: "CRITICAL",
  },
  {
    pattern: /AIza[a-zA-Z0-9\-_]{35}/,
    name: "Google API key",
    severity: "CRITICAL",
  },
  {
    pattern: /postgresql:\/\/[^:]+:[^@]+@[^\/]+\//,
    name: "PostgreSQL connection string with password",
    severity: "HIGH",
  },
  {
    pattern: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/,
    name: "MongoDB connection string with password",
    severity: "HIGH",
  },
  {
    pattern: /redis:\/\/:[^@]+@/,
    name: "Redis connection string with password",
    severity: "HIGH",
  },

  // JWT/Session secrets (if literal values, not env vars)
  {
    pattern: /jwt[_-]?secret\s*[:=]\s*['"][^'"]{16,}['"]/i,
    name: "Hardcoded JWT secret",
    severity: "CRITICAL",
  },
  {
    pattern: /session[_-]?secret\s*[:=]\s*['"][^'"]{16,}['"]/i,
    name: "Hardcoded session secret",
    severity: "CRITICAL",
  },
  {
    pattern: /cookie[_-]?secret\s*[:=]\s*['"][^'"]{16,}['"]/i,
    name: "Hardcoded cookie secret",
    severity: "CRITICAL",
  },
];

// Files/directories to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /dist\//,
  /build\//,
  /coverage\//,
  /\.next\//,
  /\.turbo\//,
  /pnpm-lock\.yaml$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /\.min\.js$/,
  /\.map$/,
  /\.md$/, // Skip markdown (documentation)
  /verify-secrets\.js$/, // Skip this script
  /SECURITY-INCIDENT-RESPONSE\.md$/,
];

// File extensions to scan
const SCAN_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".env",
  ".yaml",
  ".yml",
  ".toml",
];

let issues = [];

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some((pattern) => pattern.test(filePath));
}

function shouldScan(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return (
    SCAN_EXTENSIONS.includes(ext) || path.basename(filePath).startsWith(".env")
  );
}

function scanFile(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath);

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      // Skip comments
      if (
        line.trim().startsWith("//") ||
        line.trim().startsWith("#") ||
        line.trim().startsWith("*")
      ) {
        // Still check for actual secrets in comments (they shouldn't be there either)
        SECRET_PATTERNS.forEach(({ pattern, name, severity }) => {
          if (severity === "CRITICAL" && pattern.test(line)) {
            issues.push({
              file: relativePath,
              line: index + 1,
              pattern: name,
              severity,
              content: line.trim().substring(0, 100),
            });
          }
        });
        return;
      }

      SECRET_PATTERNS.forEach(({ pattern, name, severity }) => {
        if (pattern.test(line)) {
          // Skip false positives in example/template files
          if (
            relativePath.includes("example") ||
            relativePath.includes("template")
          ) {
            if (severity !== "CRITICAL") return;
          }

          issues.push({
            file: relativePath,
            line: index + 1,
            pattern: name,
            severity,
            content: line.trim().substring(0, 100),
          });
        }
      });
    });
  } catch (error) {
    // Skip unreadable files
  }
}

function walkDirectory(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (shouldSkip(fullPath)) continue;

      if (entry.isDirectory()) {
        walkDirectory(fullPath);
      } else if (entry.isFile() && shouldScan(fullPath)) {
        scanFile(fullPath);
      }
    }
  } catch (error) {
    // Skip unreadable directories
  }
}

function checkEnvFilesInGit() {
  try {
    const result = execSync("git ls-files", {
      cwd: ROOT_DIR,
      encoding: "utf8",
    });
    const trackedFiles = result.split("\n").filter(Boolean);

    const envFiles = trackedFiles.filter(
      (f) =>
        f.includes(".env") &&
        !f.includes(".example") &&
        !f.includes(".template") &&
        !f.endsWith(".md"),
    );

    envFiles.forEach((file) => {
      issues.push({
        file,
        line: 0,
        pattern: ".env file tracked in git",
        severity: "CRITICAL",
        content: "Environment file should not be in version control",
      });
    });
  } catch (error) {
    console.warn("Warning: Could not check git tracked files");
  }
}

function checkGitHistory() {
  try {
    // Check if .env files exist in git history
    const result = execSync(
      'git log --all --full-history -- "*.env*" --oneline 2>/dev/null || echo ""',
      {
        cwd: ROOT_DIR,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    if (result.trim()) {
      const commits = result.trim().split("\n").filter(Boolean);
      if (commits.length > 0) {
        issues.push({
          file: "git history",
          line: 0,
          pattern: ".env files in git history",
          severity: "CRITICAL",
          content: `Found ${commits.length} commits with .env files. Run BFG to clean history.`,
        });
      }
    }
  } catch (error) {
    // Git history check is optional
  }
}

// Main execution
console.log("🔍 guardrail Secrets Scanner\n");
console.log("Scanning for hardcoded secrets and security issues...\n");

// Run scans
walkDirectory(ROOT_DIR);
checkEnvFilesInGit();
checkGitHistory();

// Report results
if (issues.length === 0) {
  console.log("✅ PASS: No secrets or security issues detected\n");
  process.exit(0);
} else {
  console.log(`❌ FAIL: Found ${issues.length} issue(s)\n`);

  // Group by severity
  const critical = issues.filter((i) => i.severity === "CRITICAL");
  const high = issues.filter((i) => i.severity === "HIGH");
  const medium = issues.filter((i) => i.severity === "MEDIUM");

  if (critical.length > 0) {
    console.log("🔴 CRITICAL Issues:");
    critical.forEach((issue) => {
      console.log(`   ${issue.file}:${issue.line}`);
      console.log(`      Pattern: ${issue.pattern}`);
      console.log(`      Content: ${issue.content.substring(0, 60)}...`);
      console.log("");
    });
  }

  if (high.length > 0) {
    console.log("🟠 HIGH Issues:");
    high.forEach((issue) => {
      console.log(`   ${issue.file}:${issue.line}`);
      console.log(`      Pattern: ${issue.pattern}`);
      console.log(`      Content: ${issue.content.substring(0, 60)}...`);
      console.log("");
    });
  }

  if (medium.length > 0) {
    console.log("🟡 MEDIUM Issues:");
    medium.forEach((issue) => {
      console.log(`   ${issue.file}:${issue.line}`);
      console.log(`      Pattern: ${issue.pattern}`);
      console.log("");
    });
  }

  console.log("\n📋 Summary:");
  console.log(`   🔴 Critical: ${critical.length}`);
  console.log(`   🟠 High: ${high.length}`);
  console.log(`   🟡 Medium: ${medium.length}`);
  console.log(`   Total: ${issues.length}`);

  process.exit(1);
}
