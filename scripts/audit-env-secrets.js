#!/usr/bin/env node

/**
 * Environment & Secrets Audit Tool
 *
 * Detects:
 * - Missing required environment variables
 * - Leaked secrets in NEXT_PUBLIC_* or client bundles
 * - Hardcoded secrets and credentials
 * - Generates .env.example automatically
 * - Detects localhost/dev URLs in production code
 *
 * Usage: node scripts/audit-env-secrets.js [projectPath]
 */

const fs = require("fs");
const path = require("path");
const {
  STRIPE_LIVE_PREFIX,
  STRIPE_PK_LIVE_PREFIX,
} = require("../bin/runners/lib/stripe-scan-patterns");

// Secret patterns to detect
const SECRET_PATTERNS = [
  {
    name: "API Key",
    pattern: new RegExp(
      `['"](?:${STRIPE_LIVE_PREFIX}|${STRIPE_PK_LIVE_PREFIX}|api[_-]?key)[a-zA-Z0-9_-]{20,}['"]`,
      "gi",
    ),
    severity: "critical",
  },
  {
    name: "AWS Key",
    pattern: /['"]AKIA[0-9A-Z]{16}['"]/g,
    severity: "critical",
  },
  {
    name: "AWS Secret",
    pattern:
      /aws[_-]?secret[_-]?access[_-]?key['"]\s*[:=]\s*['"][a-zA-Z0-9\/+=]{40}['"]/gi,
    severity: "critical",
  },
  {
    name: "Private Key",
    pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: "critical",
  },
  {
    name: "GitHub Token",
    pattern: /['"]gh[ps]_[a-zA-Z0-9]{36}['"]/g,
    severity: "critical",
  },
  {
    name: "Stripe Key",
    pattern: new RegExp(`['"]${STRIPE_LIVE_PREFIX}[a-zA-Z0-9]{24,}['"]`, "g"),
    severity: "critical",
  },
  {
    name: "JWT Secret",
    pattern: /jwt[_-]?secret['"]\s*[:=]\s*['"][^'"]{20,}['"]/gi,
    severity: "high",
  },
  {
    name: "Database URL",
    pattern: /['"]postgres(ql)?:\/\/[^'"]+:[^'"]+@[^'"]+['"]/gi,
    severity: "critical",
  },
  {
    name: "MongoDB URL",
    pattern: /['"]mongodb(\+srv)?:\/\/[^'"]+:[^'"]+@[^'"]+['"]/gi,
    severity: "critical",
  },
  {
    name: "Redis URL",
    pattern: /['"]redis:\/\/[^'"]+:[^'"]+@[^'"]+['"]/gi,
    severity: "high",
  },
  {
    name: "Slack Webhook",
    pattern: /['"]https:\/\/hooks\.slack\.com\/services\/[^'"]+['"]/g,
    severity: "high",
  },
  {
    name: "Discord Webhook",
    pattern: /['"]https:\/\/discord(app)?\.com\/api\/webhooks\/[^'"]+['"]/g,
    severity: "high",
  },
  {
    name: "Sendgrid Key",
    pattern: /['"]SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}['"]/g,
    severity: "critical",
  },
  {
    name: "Twilio Key",
    pattern: /['"]SK[a-f0-9]{32}['"]/g,
    severity: "critical",
  },
  {
    name: "Password in Code",
    pattern: /password['"]\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: "high",
  },
  {
    name: "Basic Auth",
    pattern: /['"]Basic [a-zA-Z0-9+\/=]{20,}['"]/g,
    severity: "high",
  },
  {
    name: "Bearer Token",
    pattern: /['"]Bearer [a-zA-Z0-9_-]{20,}['"]/g,
    severity: "high",
  },
];

// Patterns for localhost/dev URLs
const DEV_URL_PATTERNS = [
  {
    name: "Localhost URL",
    pattern: /['"]https?:\/\/localhost[:\d]*[^'"]*['"]/g,
    severity: "medium",
  },
  {
    name: "127.0.0.1 URL",
    pattern: /['"]https?:\/\/127\.0\.0\.1[:\d]*[^'"]*['"]/g,
    severity: "medium",
  },
  {
    name: "Local IP",
    pattern: /['"]https?:\/\/192\.168\.[^'"]+['"]/g,
    severity: "medium",
  },
  {
    name: "Dev/Staging URL",
    pattern: /['"]https?:\/\/[^'"]*\.(dev|staging|test|local)\.[^'"]+['"]/g,
    severity: "low",
  },
];

// Environment variable classifications
const ENV_CLASSIFICATIONS = {
  critical: [
    "DATABASE_URL",
    "POSTGRES_URL",
    "MONGODB_URI",
    "REDIS_URL",
    "JWT_SECRET",
    "SESSION_SECRET",
    "ENCRYPTION_KEY",
    "STRIPE_SECRET_KEY",
    "AWS_SECRET_ACCESS_KEY",
    "GITHUB_CLIENT_SECRET",
    "GOOGLE_CLIENT_SECRET",
  ],
  required: [
    "NODE_ENV",
    "PORT",
    "HOST",
    "API_URL",
    "FRONTEND_URL",
    "STRIPE_PUBLISHABLE_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_REGION",
    "GITHUB_CLIENT_ID",
    "GOOGLE_CLIENT_ID",
  ],
  optional: ["LOG_LEVEL", "DEBUG", "SENTRY_DSN", "ANALYTICS_ID"],
};

// Files/dirs to skip
const SKIP_PATTERNS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".turbo",
  "coverage",
  "*.min.js",
  "*.bundle.js",
  ".env",
  ".env.local",
  ".env.production",
  // Skip test directories and files
  "__tests__",
  "__mocks__",
  "*.test.*",
  "*.spec.*",
  "test/",
  "tests/",
  // Skip demo repos
  "demo-repos/",
  "demo/",
  // Skip security pattern definition files (they define what to detect)
  "patterns.ts",
  "patterns.js",
  "secret-patterns.*",
  // Skip audit/scanner scripts
  "audit-*.js",
  "scan-*.js",
  // Skip example/template files
  "*.example",
  "*.template",
  // Skip evidence collectors (they redact data)
  "evidence-collector.*",
  // Skip documentation
  "*.md",
  "docs/",
  // Skip config generators
  "cli-wizard.js",
  // Skip landing page demo/mockup components (intentional example vulnerabilities)
  "xray-scanner/",
  "CodeMockup.tsx",
  // Skip secret scanners/validators (they define patterns)
  "secret-scanner.*",
  "*-scanner.ts",
  "*-scanner.js",
  "env-validator.*",
  // Skip redaction scripts
  "redact-*.mjs",
  "redact-*.js",
  // Skip profile page (webhook placeholder text)
  "profile/page.tsx",
  // Skip security event services (contain event type definitions with "api_key" in names)
  "security-event-service.ts",
  "security-events.ts",
  // Skip security suite (contains pattern definitions for detecting secrets, not actual secrets)
  "security-suite.ts",
  "*-suite.ts",
];

/**
 * Extract all process.env usages from code
 */
function extractEnvUsages(content, filePath) {
  const usages = [];

  // Match process.env.VAR_NAME
  const processEnvPattern = /process\.env\.([A-Z][A-Z0-9_]*)/g;
  let match;
  while ((match = processEnvPattern.exec(content)) !== null) {
    usages.push({
      variable: match[1],
      file: filePath,
      line: content.substring(0, match.index).split("\n").length,
      isClientSide: /NEXT_PUBLIC_|VITE_|REACT_APP_/.test(match[1]),
    });
  }

  // Match process.env['VAR_NAME'] or process.env["VAR_NAME"]
  const bracketPattern = /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g;
  while ((match = bracketPattern.exec(content)) !== null) {
    usages.push({
      variable: match[1],
      file: filePath,
      line: content.substring(0, match.index).split("\n").length,
      isClientSide: /NEXT_PUBLIC_|VITE_|REACT_APP_/.test(match[1]),
    });
  }

  // Match import.meta.env.VAR_NAME (Vite)
  const vitePattern = /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g;
  while ((match = vitePattern.exec(content)) !== null) {
    usages.push({
      variable: match[1],
      file: filePath,
      line: content.substring(0, match.index).split("\n").length,
      isClientSide: true,
    });
  }

  return usages;
}

/**
 * Detect hardcoded secrets
 */
function detectSecrets(content, filePath) {
  const secrets = [];

  for (const { name, pattern, severity } of SECRET_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Skip if it looks like a placeholder
        if (/your[_-]?|example|placeholder|xxx|test|demo|sample/i.test(match)) {
          continue;
        }

        secrets.push({
          type: name,
          file: filePath,
          severity,
          snippet: match.substring(0, 50) + (match.length > 50 ? "..." : ""),
          line: content.substring(0, content.indexOf(match)).split("\n").length,
        });
      }
    }
  }

  return secrets;
}

/**
 * Detect dev/localhost URLs
 */
function detectDevUrls(content, filePath) {
  const devUrls = [];

  for (const { name, pattern, severity } of DEV_URL_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Skip if in a comment or clearly conditional
        const idx = content.indexOf(match);
        const lineStart = content.lastIndexOf("\n", idx) + 1;
        const line = content.substring(lineStart, content.indexOf("\n", idx));

        if (/^\s*\/\/|^\s*\*|^\s*#/.test(line)) {
          continue; // Skip comments
        }

        devUrls.push({
          type: name,
          file: filePath,
          severity,
          url: match,
          line: content.substring(0, idx).split("\n").length,
        });
      }
    }
  }

  return devUrls;
}

/**
 * Check for leaked NEXT_PUBLIC secrets
 */
function checkPublicEnvLeaks(envUsages) {
  const leaks = [];

  for (const usage of envUsages) {
    if (usage.isClientSide) {
      // Check if this public env var contains sensitive data
      const sensitivePatterns = [
        /SECRET/i,
        /PASSWORD/i,
        /PRIVATE/i,
        /KEY(?!_ID)/i, // KEY but not KEY_ID
        /TOKEN/i,
        /CREDENTIAL/i,
        /AUTH/i,
      ];

      for (const pattern of sensitivePatterns) {
        if (pattern.test(usage.variable)) {
          leaks.push({
            variable: usage.variable,
            file: usage.file,
            line: usage.line,
            risk: `Client-exposed variable name contains "${pattern.source}"`,
          });
          break;
        }
      }
    }
  }

  return leaks;
}

/**
 * Generate .env.example content
 */
function generateEnvExample(envUsages) {
  const uniqueVars = new Map();

  for (const usage of envUsages) {
    if (!uniqueVars.has(usage.variable)) {
      uniqueVars.set(usage.variable, {
        variable: usage.variable,
        files: [usage.file],
        isClientSide: usage.isClientSide,
      });
    } else {
      uniqueVars.get(usage.variable).files.push(usage.file);
    }
  }

  // Sort and categorize
  const critical = [];
  const required = [];
  const optional = [];
  const other = [];

  for (const [varName, info] of uniqueVars) {
    if (ENV_CLASSIFICATIONS.critical.includes(varName)) {
      critical.push({ ...info, classification: "critical" });
    } else if (ENV_CLASSIFICATIONS.required.includes(varName)) {
      required.push({ ...info, classification: "required" });
    } else if (ENV_CLASSIFICATIONS.optional.includes(varName)) {
      optional.push({ ...info, classification: "optional" });
    } else {
      other.push({ ...info, classification: "unknown" });
    }
  }

  // Generate .env.example
  const lines = [
    "# ============================================",
    "# Environment Variables",
    "# Generated by guardrail Env Audit",
    "# ============================================",
    "",
  ];

  if (critical.length > 0) {
    lines.push("# ----- CRITICAL (Required for security) -----");
    for (const v of critical) {
      lines.push(`${v.variable}=`);
    }
    lines.push("");
  }

  if (required.length > 0) {
    lines.push("# ----- REQUIRED -----");
    for (const v of required) {
      const defaultVal = getDefaultValue(v.variable);
      lines.push(`${v.variable}=${defaultVal}`);
    }
    lines.push("");
  }

  if (optional.length > 0) {
    lines.push("# ----- OPTIONAL -----");
    for (const v of optional) {
      const defaultVal = getDefaultValue(v.variable);
      lines.push(`# ${v.variable}=${defaultVal}`);
    }
    lines.push("");
  }

  if (other.length > 0) {
    lines.push("# ----- OTHER (review classification) -----");
    for (const v of other) {
      const prefix = v.isClientSide ? "# [CLIENT] " : "# ";
      lines.push(`${prefix}${v.variable}=`);
    }
  }

  return {
    content: lines.join("\n"),
    variables: [...critical, ...required, ...optional, ...other],
  };
}

/**
 * Get sensible default value for env var
 */
function getDefaultValue(varName) {
  const defaults = {
    NODE_ENV: "development",
    PORT: "3000",
    HOST: "0.0.0.0",
    LOG_LEVEL: "info",
    DEBUG: "false",
  };
  return defaults[varName] || "";
}

/**
 * Check if a path should be skipped
 */
function shouldSkipPath(itemPath, itemName) {
  const normalized = itemPath.replace(/\\/g, "/");

  for (const p of SKIP_PATTERNS) {
    if (p.includes("*")) {
      // Glob pattern - match against filename
      const regex = new RegExp(p.replace(/\./g, "\\.").replace(/\*/g, ".*"));
      if (regex.test(itemName)) return true;
    } else if (p.endsWith("/")) {
      // Directory pattern
      const dirPattern = p.slice(0, -1);
      if (
        normalized.includes(`/${dirPattern}/`) ||
        normalized.includes(`/${dirPattern}`)
      )
        return true;
    } else {
      // Check if pattern appears as a path segment
      if (itemName === p || normalized.split("/").includes(p)) return true;
    }
  }
  return false;
}

/**
 * Scan directory for env issues
 */
function scanDirectory(dir, results) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const itemPath = path.join(dir, item);

    // Skip patterns - check both item name and full path
    if (shouldSkipPath(itemPath, item)) {
      continue;
    }

    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      scanDirectory(itemPath, results);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(item)) {
      const content = fs.readFileSync(itemPath, "utf8");
      const relativePath = path.relative(results.projectPath, itemPath);

      // Extract env usages
      const usages = extractEnvUsages(content, relativePath);
      results.envUsages.push(...usages);

      // Detect secrets
      const secrets = detectSecrets(content, relativePath);
      results.secrets.push(...secrets);

      // Detect dev URLs
      const devUrls = detectDevUrls(content, relativePath);
      results.devUrls.push(...devUrls);
    }
  }
}

/**
 * Check current env against required
 */
function checkMissingEnv(envUsages) {
  const missing = [];
  const uniqueVars = [...new Set(envUsages.map((u) => u.variable))];

  for (const varName of uniqueVars) {
    // Check if critical/required and not set
    if (
      ENV_CLASSIFICATIONS.critical.includes(varName) ||
      ENV_CLASSIFICATIONS.required.includes(varName)
    ) {
      if (!process.env[varName]) {
        missing.push({
          variable: varName,
          classification: ENV_CLASSIFICATIONS.critical.includes(varName)
            ? "critical"
            : "required",
        });
      }
    }
  }

  return missing;
}

/**
 * Main audit function
 */
async function auditEnvSecrets(projectPath = ".") {
  const results = {
    projectPath: path.resolve(projectPath),
    envUsages: [],
    secrets: [],
    devUrls: [],
    publicEnvLeaks: [],
    missingEnv: [],
    envExample: null,
  };

  // Scan project
  scanDirectory(results.projectPath, results);

  // Check for public env leaks
  results.publicEnvLeaks = checkPublicEnvLeaks(results.envUsages);

  // Check missing env
  results.missingEnv = checkMissingEnv(results.envUsages);

  // Generate .env.example
  results.envExample = generateEnvExample(results.envUsages);

  return results;
}

/**
 * Generate report
 */
function formatEnvResults(results) {
  const lines = [];

  lines.push("# 🔑 Environment & Secrets Audit Report\n");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Project:** ${results.projectPath}\n`);

  // Summary
  lines.push("## 📊 Summary\n");
  lines.push("| Issue Type | Count | Severity |");
  lines.push("|------------|-------|----------|");

  const criticalSecrets = results.secrets.filter(
    (s) => s.severity === "critical",
  ).length;
  const highSecrets = results.secrets.filter(
    (s) => s.severity === "high",
  ).length;

  lines.push(
    `| 🔴 Hardcoded Secrets | ${results.secrets.length} | ${criticalSecrets > 0 ? "**CRITICAL**" : highSecrets > 0 ? "High" : "None"} |`,
  );
  lines.push(
    `| 🟠 Public Env Leaks | ${results.publicEnvLeaks.length} | ${results.publicEnvLeaks.length > 0 ? "High" : "None"} |`,
  );
  lines.push(`| 🟡 Dev URLs in Code | ${results.devUrls.length} | Medium |`);
  lines.push(
    `| ⚠️ Missing Env Vars | ${results.missingEnv.length} | ${results.missingEnv.some((m) => m.classification === "critical") ? "High" : "Medium"} |`,
  );
  lines.push(
    `| 📝 Total Env Vars Used | ${results.envExample.variables.length} | Info |`,
  );
  lines.push("");

  // Critical: Hardcoded secrets
  if (results.secrets.length > 0) {
    lines.push("## 🚨 Hardcoded Secrets Detected\n");
    lines.push(
      "**IMMEDIATE ACTION REQUIRED** - Remove these from code and use environment variables!\n",
    );

    const bySeverity = {
      critical: results.secrets.filter((s) => s.severity === "critical"),
      high: results.secrets.filter((s) => s.severity === "high"),
      medium: results.secrets.filter((s) => s.severity === "medium"),
    };

    if (bySeverity.critical.length > 0) {
      lines.push("### 🔴 Critical\n");
      for (const secret of bySeverity.critical) {
        lines.push(`- **${secret.type}** in \`${secret.file}:${secret.line}\``);
        lines.push(`  - Snippet: \`${secret.snippet}\``);
      }
      lines.push("");
    }

    if (bySeverity.high.length > 0) {
      lines.push("### 🟠 High\n");
      for (const secret of bySeverity.high) {
        lines.push(`- **${secret.type}** in \`${secret.file}:${secret.line}\``);
      }
      lines.push("");
    }
  }

  // Public env leaks
  if (results.publicEnvLeaks.length > 0) {
    lines.push("## 🟠 Client-Exposed Sensitive Variables\n");
    lines.push(
      "These NEXT_PUBLIC_/VITE_ variables may expose sensitive data to clients:\n",
    );
    for (const leak of results.publicEnvLeaks) {
      lines.push(`- **${leak.variable}** in \`${leak.file}:${leak.line}\``);
      lines.push(`  - Risk: ${leak.risk}`);
    }
    lines.push("");
  }

  // Dev URLs
  if (results.devUrls.length > 0) {
    lines.push("## 🟡 Development URLs in Code\n");
    lines.push(
      "These hardcoded localhost/dev URLs may cause issues in production:\n",
    );
    for (const url of results.devUrls.slice(0, 20)) {
      lines.push(`- ${url.url} in \`${url.file}:${url.line}\``);
    }
    if (results.devUrls.length > 20) {
      lines.push(`- ... and ${results.devUrls.length - 20} more`);
    }
    lines.push("");
  }

  // Missing env vars
  if (results.missingEnv.length > 0) {
    lines.push("## ⚠️ Missing Environment Variables\n");
    lines.push(
      "These required variables are not set in the current environment:\n",
    );
    for (const missing of results.missingEnv) {
      const icon = missing.classification === "critical" ? "🔴" : "🟠";
      lines.push(
        `- ${icon} **${missing.variable}** (${missing.classification})`,
      );
    }
    lines.push("");
  }

  // Env vars summary
  lines.push("## 📝 Environment Variables Used\n");
  lines.push(
    `Found ${results.envExample.variables.length} unique environment variables.\n`,
  );

  const clientVars = results.envExample.variables.filter((v) => v.isClientSide);
  const serverVars = results.envExample.variables.filter(
    (v) => !v.isClientSide,
  );

  lines.push(`- **Server-side:** ${serverVars.length}`);
  lines.push(`- **Client-side:** ${clientVars.length}`);
  lines.push("");

  // Generated .env.example
  lines.push("## 📄 Generated .env.example\n");
  lines.push("```bash");
  lines.push(results.envExample.content);
  lines.push("```\n");

  // Recommendations
  lines.push("## 💡 Recommendations\n");

  if (results.secrets.length > 0) {
    lines.push("### 🔴 Immediate Actions");
    lines.push("1. **Rotate all exposed secrets immediately**");
    lines.push("2. Remove hardcoded values and use environment variables");
    lines.push("3. Add secrets to `.gitignore` and use `.env.local`");
    lines.push(
      "4. Consider using a secrets manager (Vault, AWS Secrets Manager)\n",
    );
  }

  if (results.devUrls.length > 0) {
    lines.push("### 🟡 Before Deployment");
    lines.push("1. Replace hardcoded URLs with environment variables");
    lines.push(
      "2. Use `process.env.API_URL` instead of `http://localhost:3000`",
    );
    lines.push("3. Add URL validation to ensure production URLs are used\n");
  }

  lines.push("### ✅ Best Practices");
  lines.push("1. Never commit `.env` files with real secrets");
  lines.push("2. Use `.env.example` as a template (committed to git)");
  lines.push("3. Validate all required env vars at startup");
  lines.push("4. Use typed env validation (zod, envalid)");
  lines.push("5. Separate client and server env vars clearly\n");

  return lines.join("\n");
}

// CLI execution
if (require.main === module) {
  const projectPath = process.argv[2] || ".";

  console.log("🔑 Auditing environment variables and secrets...\n");

  auditEnvSecrets(projectPath)
    .then((results) => {
      const report = formatEnvResults(results);
      console.log(report);

      // Save report
      const reportDir = path.join(projectPath, ".guardrail");
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      fs.writeFileSync(path.join(reportDir, "env-secrets-report.md"), report);
      fs.writeFileSync(
        path.join(reportDir, "env.example"),
        results.envExample.content,
      );

      console.log(`\n📄 Reports saved to: ${reportDir}/`);
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}

module.exports = { auditEnvSecrets, formatEnvResults };
