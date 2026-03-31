/**
 * Ship Badge Generator
 *
 * "One-click shareable proof that your app is real."
 *
 * Generates badges + hosted permalinks for:
 * ✅ No Mock Data Detected
 * ✅ No Localhost/Ngrok
 * ✅ All required env vars present
 * ✅ Billing not simulated
 * ✅ DB is real
 * ✅ OAuth callbacks not localhost
 *
 * Vibecoders slap this on README / landing page / Product Hunt for social proof.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  STRIPE_PK_TEST_PREFIX,
  STRIPE_TEST_PREFIX,
} from "guardrail-security";

export interface ShipCheck {
  id: string;
  name: string;
  shortName: string;
  status: "pass" | "fail" | "warning" | "skip";
  message: string;
  details?: string[];
}

export interface ShipBadgeResult {
  projectId: string;
  projectName: string;
  verdict: "ship" | "no-ship" | "review";
  score: number;
  checks: ShipCheck[];
  badges: ShipBadges;
  timestamp: string;
  expiresAt: string;
  permalink: string;
  embedCode: string;
}

export interface ShipBadges {
  main: string; // Main ship/no-ship badge
  mockData: string; // No mock data badge
  realApi: string; // No localhost/ngrok badge
  envVars: string; // Env vars present badge
  billing: string; // Real billing badge
  database: string; // Real database badge
  oauth: string; // OAuth not localhost badge
  combined: string; // All-in-one badge strip
}

export interface ShipBadgeConfig {
  projectPath: string;
  projectName?: string;
  checks?: string[];
  outputDir?: string;
  baseUrl?: string;
}

const BADGE_COLORS = {
  pass: "#4ade80", // Green
  fail: "#f87171", // Red
  warning: "#fbbf24", // Yellow
  skip: "#9ca3af", // Gray
  ship: "#22c55e", // Bright green
  noship: "#ef4444", // Bright red
};

export class ShipBadgeGenerator {
  /**
   * Run all ship checks and generate badges
   */
  async generateShipBadge(config: ShipBadgeConfig): Promise<ShipBadgeResult> {
    const projectName = config.projectName || path.basename(config.projectPath);
    const projectId = this.generateProjectId(config.projectPath);

    // Run all checks
    const checks = await this.runAllChecks(config.projectPath);

    // Calculate verdict
    const { verdict, score } = this.calculateVerdict(checks);

    // Generate badges
    const badges = this.generateAllBadges(checks, verdict, score);

    // Generate permalink (would be hosted on guardrail servers in production)
    const permalink = `https://guardrail.dev/badge/${projectId}`;
    const embedCode = this.generateEmbedCode(projectId, verdict, projectName);

    // Save badges if output dir specified
    if (config.outputDir) {
      await this.saveBadges(badges, config.outputDir);
    }

    const result: ShipBadgeResult = {
      projectId,
      projectName,
      verdict,
      score,
      checks,
      badges,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      permalink,
      embedCode,
    };

    // Save result JSON
    if (config.outputDir) {
      await fs.promises.writeFile(
        path.join(config.outputDir, "ship-badge-result.json"),
        JSON.stringify(result, null, 2),
      );
    }

    return result;
  }

  /**
   * Run all ship-worthiness checks
   */
  private async runAllChecks(projectPath: string): Promise<ShipCheck[]> {
    const checks: ShipCheck[] = [];

    // 1. No Mock Data
    checks.push(await this.checkNoMockData(projectPath));

    // 2. No Localhost/Ngrok
    checks.push(await this.checkNoLocalhost(projectPath));

    // 3. Env Vars Present
    checks.push(await this.checkEnvVars(projectPath));

    // 4. Real Billing (not simulated)
    checks.push(await this.checkRealBilling(projectPath));

    // 5. Real Database
    checks.push(await this.checkRealDatabase(projectPath));

    // 6. OAuth Callbacks
    checks.push(await this.checkOAuthCallbacks(projectPath));

    return checks;
  }

  /**
   * Check for mock data patterns
   */
  private async checkNoMockData(projectPath: string): Promise<ShipCheck> {
    const patterns = [
      /MockProvider/g,
      /useMock\(/g,
      /mock-context/g,
      /const\s+mock\w*\s*=/gi,
      /lorem\s+ipsum/gi,
      /john\.doe|jane\.doe/gi,
      /user@example\.com/gi,
    ];

    const issues: string[] = [];
    const files = await this.findSourceFiles(projectPath);

    for (const file of files.slice(0, 100)) {
      // Limit for performance
      try {
        const content = await fs.promises.readFile(file, "utf-8");
        const relativePath = path.relative(projectPath, file);

        // Skip test files
        if (this.isTestFile(relativePath)) continue;

        for (const pattern of patterns) {
          pattern.lastIndex = 0;
          if (pattern.test(content)) {
            issues.push(`${relativePath}: ${pattern.source}`);
            break;
          }
        }
      } catch (e) {
        // Skip unreadable files
      }
    }

    return {
      id: "no-mock-data",
      name: "No Mock Data Detected",
      shortName: "Mock Data",
      status: issues.length === 0 ? "pass" : "fail",
      message:
        issues.length === 0
          ? "No mock data patterns found in production code"
          : `Found ${issues.length} mock data patterns`,
      details: issues.slice(0, 5),
    };
  }

  /**
   * Check for localhost/ngrok URLs
   */
  private async checkNoLocalhost(projectPath: string): Promise<ShipCheck> {
    const patterns = [
      /localhost:\d+/g,
      /127\.0\.0\.1:\d+/g,
      /\.ngrok\.io/g,
      /\.ngrok-free\.app/g,
      /jsonplaceholder\.typicode\.com/g,
    ];

    const issues: string[] = [];
    const configFiles = [
      ".env",
      ".env.production",
      "next.config.js",
      "next.config.mjs",
      "vite.config.ts",
      "vite.config.js",
      "src/config/api.ts",
      "src/lib/api.ts",
    ];

    for (const configFile of configFiles) {
      const filePath = path.join(projectPath, configFile);
      if (fs.existsSync(filePath)) {
        try {
          const content = await fs.promises.readFile(filePath, "utf-8");
          for (const pattern of patterns) {
            pattern.lastIndex = 0;
            const matches = content.match(pattern);
            if (matches) {
              issues.push(`${configFile}: ${matches[0]}`);
            }
          }
        } catch (e) {
          // Skip
        }
      }
    }

    return {
      id: "no-localhost",
      name: "No Localhost/Ngrok",
      shortName: "Real URLs",
      status: issues.length === 0 ? "pass" : "fail",
      message:
        issues.length === 0
          ? "No localhost or temporary URLs in config"
          : `Found ${issues.length} localhost/ngrok URLs`,
      details: issues,
    };
  }

  /**
   * Check for required environment variables
   */
  private async checkEnvVars(projectPath: string): Promise<ShipCheck> {
    const requiredVars = [
      "DATABASE_URL",
      "API_URL",
      "NEXTAUTH_URL",
      "NEXTAUTH_SECRET",
    ];

    const envPath = path.join(projectPath, ".env");
    const envProdPath = path.join(projectPath, ".env.production");

    let envContent = "";
    if (fs.existsSync(envProdPath)) {
      envContent = await fs.promises.readFile(envProdPath, "utf-8");
    } else if (fs.existsSync(envPath)) {
      envContent = await fs.promises.readFile(envPath, "utf-8");
    }

    // Also check .env.example to see what's expected
    const examplePath = path.join(projectPath, ".env.example");
    let expectedVars: string[] = [];
    if (fs.existsSync(examplePath)) {
      const exampleContent = await fs.promises.readFile(examplePath, "utf-8");
      expectedVars = exampleContent
        .split("\n")
        .filter((line) => line.includes("=") && !line.startsWith("#"))
        .map((line) => line.split("=")[0]?.trim() || "");
    }

    const missing: string[] = [];
    const varsToCheck = expectedVars.length > 0 ? expectedVars : requiredVars;

    for (const varName of varsToCheck) {
      const regex = new RegExp(`^${varName}=.+`, "m");
      if (!regex.test(envContent)) {
        missing.push(varName);
      }
    }

    const hasEnvFile = fs.existsSync(envPath) || fs.existsSync(envProdPath);

    return {
      id: "env-vars",
      name: "Environment Variables Present",
      shortName: "Env Vars",
      status: !hasEnvFile ? "skip" : missing.length === 0 ? "pass" : "warning",
      message: !hasEnvFile
        ? "No .env file found"
        : missing.length === 0
          ? "All expected environment variables are set"
          : `Missing ${missing.length} environment variables`,
      details: missing.slice(0, 5),
    };
  }

  /**
   * Check for real billing (not demo/test)
   */
  private async checkRealBilling(projectPath: string): Promise<ShipCheck> {
    const testKeyPatterns = [
      new RegExp(STRIPE_TEST_PREFIX, "g"),
      new RegExp(STRIPE_PK_TEST_PREFIX, "g"),
      /STRIPE_TEST/g,
      /demo_billing/gi,
      /simulate.*payment/gi,
      /fake.*billing/gi,
    ];

    const issues: string[] = [];
    const files = await this.findSourceFiles(projectPath);

    // Check for Stripe/billing related files
    const billingFiles = files.filter((f) =>
      /stripe|billing|payment|checkout/i.test(f),
    );

    if (billingFiles.length === 0) {
      return {
        id: "real-billing",
        name: "Billing Not Simulated",
        shortName: "Billing",
        status: "skip",
        message: "No billing code detected",
      };
    }

    for (const file of billingFiles) {
      try {
        const content = await fs.promises.readFile(file, "utf-8");
        const relativePath = path.relative(projectPath, file);

        if (this.isTestFile(relativePath)) continue;

        for (const pattern of testKeyPatterns) {
          pattern.lastIndex = 0;
          if (pattern.test(content)) {
            issues.push(`${relativePath}: ${pattern.source}`);
          }
        }
      } catch (e) {
        // Skip
      }
    }

    return {
      id: "real-billing",
      name: "Billing Not Simulated",
      shortName: "Billing",
      status: issues.length === 0 ? "pass" : "fail",
      message:
        issues.length === 0
          ? "No test billing keys or demo billing code found"
          : `Found ${issues.length} test/demo billing patterns`,
      details: issues.slice(0, 5),
    };
  }

  /**
   * Check for real database connection
   */
  private async checkRealDatabase(projectPath: string): Promise<ShipCheck> {
    const fakeDbPatterns = [
      /sqlite:memory/gi,
      /\.sqlite$/gi,
      /mockdb/gi,
      /fake.*database/gi,
      /in-memory.*db/gi,
    ];

    const envPath = path.join(projectPath, ".env");
    const envProdPath = path.join(projectPath, ".env.production");

    let dbUrl = "";

    for (const p of [envProdPath, envPath]) {
      if (fs.existsSync(p)) {
        const content = await fs.promises.readFile(p, "utf-8");
        const match = content.match(/DATABASE_URL=(.+)/);
        if (match) {
          dbUrl = match[1] || "";
          break;
        }
      }
    }

    if (!dbUrl) {
      return {
        id: "real-database",
        name: "Database Is Real",
        shortName: "Database",
        status: "skip",
        message: "No DATABASE_URL found",
      };
    }

    const isFake =
      fakeDbPatterns.some((p) => p.test(dbUrl)) || /localhost/.test(dbUrl);

    return {
      id: "real-database",
      name: "Database Is Real",
      shortName: "Database",
      status: isFake ? "warning" : "pass",
      message: isFake
        ? "Database URL points to local/fake database"
        : "Database URL appears to be a real hosted database",
    };
  }

  /**
   * Check OAuth callback URLs
   */
  private async checkOAuthCallbacks(projectPath: string): Promise<ShipCheck> {
    const authFiles = [
      "src/app/api/auth/[...nextauth]/route.ts",
      "src/pages/api/auth/[...nextauth].ts",
      "src/lib/auth.ts",
      "src/config/auth.ts",
    ];

    const issues: string[] = [];

    for (const authFile of authFiles) {
      const filePath = path.join(projectPath, authFile);
      if (fs.existsSync(filePath)) {
        try {
          const content = await fs.promises.readFile(filePath, "utf-8");

          if (/callbackUrl.*localhost/i.test(content)) {
            issues.push(`${authFile}: localhost callback URL`);
          }
          if (/redirect.*localhost/i.test(content)) {
            issues.push(`${authFile}: localhost redirect`);
          }
        } catch (e) {
          // Skip
        }
      }
    }

    // Also check NEXTAUTH_URL
    const envPath = path.join(projectPath, ".env");
    if (fs.existsSync(envPath)) {
      const content = await fs.promises.readFile(envPath, "utf-8");
      const match = content.match(/NEXTAUTH_URL=(.+)/);
      if (match && match[1] && /localhost/i.test(match[1])) {
        issues.push(".env: NEXTAUTH_URL points to localhost");
      }
    }

    const hasAuthCode = authFiles.some((f) =>
      fs.existsSync(path.join(projectPath, f)),
    );

    return {
      id: "oauth-callbacks",
      name: "OAuth Callbacks Not Localhost",
      shortName: "OAuth",
      status: !hasAuthCode ? "skip" : issues.length === 0 ? "pass" : "fail",
      message: !hasAuthCode
        ? "No OAuth/auth code detected"
        : issues.length === 0
          ? "OAuth callbacks configured for production"
          : `Found ${issues.length} localhost OAuth issues`,
      details: issues,
    };
  }

  /**
   * Calculate overall verdict
   */
  private calculateVerdict(checks: ShipCheck[]): {
    verdict: "ship" | "no-ship" | "review";
    score: number;
  } {
    const activeChecks = checks.filter((c) => c.status !== "skip");
    const passed = activeChecks.filter((c) => c.status === "pass").length;
    const failed = activeChecks.filter((c) => c.status === "fail").length;
    const warnings = activeChecks.filter((c) => c.status === "warning").length;

    const score =
      activeChecks.length > 0
        ? Math.round((passed / activeChecks.length) * 100)
        : 100;

    let verdict: "ship" | "no-ship" | "review";
    if (failed > 0) {
      verdict = "no-ship";
    } else if (warnings > 0) {
      verdict = "review";
    } else {
      verdict = "ship";
    }

    return { verdict, score };
  }

  /**
   * Generate all badge SVGs
   */
  private generateAllBadges(
    checks: ShipCheck[],
    verdict: "ship" | "no-ship" | "review",
    score: number,
  ): ShipBadges {
    const mainColor =
      verdict === "ship"
        ? BADGE_COLORS.ship
        : verdict === "no-ship"
          ? BADGE_COLORS.noship
          : BADGE_COLORS.warning;

    return {
      main: this.createBadge(
        "guardrail",
        verdict === "ship"
          ? "🚀 SHIP IT"
          : verdict === "no-ship"
            ? "🛑 NO SHIP"
            : "⚠️ REVIEW",
        mainColor,
      ),
      mockData: this.createCheckBadge(
        checks.find((c) => c.id === "no-mock-data")!,
      ),
      realApi: this.createCheckBadge(
        checks.find((c) => c.id === "no-localhost")!,
      ),
      envVars: this.createCheckBadge(checks.find((c) => c.id === "env-vars")!),
      billing: this.createCheckBadge(
        checks.find((c) => c.id === "real-billing")!,
      ),
      database: this.createCheckBadge(
        checks.find((c) => c.id === "real-database")!,
      ),
      oauth: this.createCheckBadge(
        checks.find((c) => c.id === "oauth-callbacks")!,
      ),
      combined: this.createCombinedBadge(checks, score),
    };
  }

  /**
   * Create a single check badge
   */
  private createCheckBadge(check: ShipCheck): string {
    const icon =
      check.status === "pass"
        ? "✅"
        : check.status === "fail"
          ? "❌"
          : check.status === "warning"
            ? "⚠️"
            : "⏭️";

    const color = BADGE_COLORS[check.status];
    const label = check.shortName;
    const value =
      check.status === "pass"
        ? "Pass"
        : check.status === "fail"
          ? "Fail"
          : check.status === "warning"
            ? "Warning"
            : "Skip";

    return this.createBadge(label, `${icon} ${value}`, color);
  }

  /**
   * Create a combined badge strip
   */
  private createCombinedBadge(checks: ShipCheck[], score: number): string {
    const passed = checks.filter((c) => c.status === "pass").length;
    const total = checks.filter((c) => c.status !== "skip").length;

    const color =
      score >= 80
        ? BADGE_COLORS.pass
        : score >= 50
          ? BADGE_COLORS.warning
          : BADGE_COLORS.fail;

    return this.createBadge(
      "Ship Score",
      `${passed}/${total} (${score}%)`,
      color,
      "for-the-badge",
    );
  }

  /**
   * Create SVG badge
   */
  private createBadge(
    label: string,
    value: string,
    color: string,
    style: "flat" | "for-the-badge" = "flat",
  ): string {
    const labelWidth = label.length * 7 + 10;
    const valueWidth = value.length * 7 + 10;
    const totalWidth = labelWidth + valueWidth;
    const height = style === "for-the-badge" ? 28 : 20;
    const fontSize = 11;
    const labelBg = "#555";

    if (style === "for-the-badge") {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">
  <linearGradient id="smooth" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-color="#000" stop-opacity=".3"/>
    <stop offset="1" stop-color="#000" stop-opacity=".5"/>
  </linearGradient>
  <rect rx="4" width="${totalWidth}" height="${height}" fill="${labelBg}"/>
  <rect rx="4" x="${labelWidth}" width="${valueWidth}" height="${height}" fill="${color}"/>
  <rect rx="4" width="${totalWidth}" height="${height}" fill="url(#smooth)"/>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="${fontSize}" font-weight="bold">
    <text x="${labelWidth / 2}" y="${height / 2 + 4}" fill="#010101" fill-opacity=".3">${this.escapeHtml(label)}</text>
    <text x="${labelWidth / 2}" y="${height / 2 + 3}">${this.escapeHtml(label)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="${height / 2 + 4}" fill="#010101" fill-opacity=".3">${this.escapeHtml(value)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="${height / 2 + 3}">${this.escapeHtml(value)}</text>
  </g>
</svg>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">
  <linearGradient id="smooth" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="round">
    <rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#round)">
    <rect width="${labelWidth}" height="${height}" fill="${labelBg}"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="${height}" fill="${color}"/>
    <rect width="${totalWidth}" height="${height}" fill="url(#smooth)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="${fontSize}">
    <text x="${labelWidth / 2}" y="${height / 2 + 4}" fill="#010101" fill-opacity=".3">${this.escapeHtml(label)}</text>
    <text x="${labelWidth / 2}" y="${height / 2 + 3}">${this.escapeHtml(label)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="${height / 2 + 4}" fill="#010101" fill-opacity=".3">${this.escapeHtml(value)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="${height / 2 + 3}">${this.escapeHtml(value)}</text>
  </g>
</svg>`;
  }

  /**
   * Generate embed code for README
   */
  private generateEmbedCode(
    projectId: string,
    verdict: string,
    projectName: string,
  ): string {
    return `<!-- guardrail Ship Badge -->
[![guardrail Ship Status](https://guardrail.dev/api/badge/${projectId}/main.svg)](https://guardrail.dev/badge/${projectId})
[![Mock Data](https://guardrail.dev/api/badge/${projectId}/mock-data.svg)](https://guardrail.dev/badge/${projectId})
[![Real APIs](https://guardrail.dev/api/badge/${projectId}/real-api.svg)](https://guardrail.dev/badge/${projectId})
<!-- End guardrail Ship Badge -->

---

**${projectName}** verified by [guardrail](https://guardrail.dev) - Stop shipping pretend features.`;
  }

  /**
   * Save badges to directory
   */
  private async saveBadges(
    badges: ShipBadges,
    outputDir: string,
  ): Promise<void> {
    await fs.promises.mkdir(outputDir, { recursive: true });

    const files: [keyof ShipBadges, string][] = [
      ["main", "ship-status.svg"],
      ["mockData", "mock-data.svg"],
      ["realApi", "real-api.svg"],
      ["envVars", "env-vars.svg"],
      ["billing", "billing.svg"],
      ["database", "database.svg"],
      ["oauth", "oauth.svg"],
      ["combined", "ship-score.svg"],
    ];

    for (const [key, filename] of files) {
      await fs.promises.writeFile(
        path.join(outputDir, filename),
        badges[key],
        "utf-8",
      );
    }
  }

  /**
   * Generate project ID from path
   */
  private generateProjectId(projectPath: string): string {
    const hash = crypto
      .createHash("sha256")
      .update(projectPath)
      .digest("hex")
      .slice(0, 12);
    return hash;
  }

  /**
   * Find source files
   */
  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = [".ts", ".tsx", ".js", ".jsx"];
    const excludeDirs = [
      "node_modules",
      ".git",
      ".next",
      "dist",
      "build",
      "coverage",
    ];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (
              !excludeDirs.includes(entry.name) &&
              !entry.name.startsWith(".")
            ) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (e) {
        // Skip
      }
    };

    await walk(projectPath);
    return files;
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(filePath: string): boolean {
    const testPatterns = [
      /__tests__/,
      /\.test\./,
      /\.spec\./,
      /test\//,
      /tests\//,
      /e2e\//,
      /__mocks__/,
      /stories\//,
    ];
    return testPatterns.some((p) => p.test(filePath));
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Generate human-readable report
   */
  generateReport(result: ShipBadgeResult): string {
    const lines: string[] = [];

    lines.push(
      "╔══════════════════════════════════════════════════════════════╗",
    );
    lines.push(
      "║              🚀 guardrail Ship Badge Report 🚀              ║",
    );
    lines.push(
      "╚══════════════════════════════════════════════════════════════╝",
    );
    lines.push("");

    const verdictEmoji =
      result.verdict === "ship"
        ? "🚀"
        : result.verdict === "no-ship"
          ? "🛑"
          : "⚠️";
    const verdictText =
      result.verdict === "ship"
        ? "SHIP IT!"
        : result.verdict === "no-ship"
          ? "NO SHIP"
          : "NEEDS REVIEW";

    lines.push(`${verdictEmoji} VERDICT: ${verdictText}`);
    lines.push(`   Ship Score: ${result.score}/100`);
    lines.push(`   Project: ${result.projectName}`);
    lines.push("");
    lines.push("─".repeat(64));
    lines.push("");
    lines.push("CHECKS:");
    lines.push("");

    for (const check of result.checks) {
      const icon =
        check.status === "pass"
          ? "✅"
          : check.status === "fail"
            ? "❌"
            : check.status === "warning"
              ? "⚠️"
              : "⏭️";
      lines.push(`${icon} ${check.name}`);
      lines.push(`   ${check.message}`);
      if (check.details && check.details.length > 0) {
        for (const detail of check.details) {
          lines.push(`      • ${detail}`);
        }
      }
      lines.push("");
    }

    lines.push("─".repeat(64));
    lines.push("");
    lines.push("ADD TO YOUR README:");
    lines.push("");
    lines.push(result.embedCode);
    lines.push("");
    lines.push("─".repeat(64));
    lines.push(`Permalink: ${result.permalink}`);
    lines.push(`Generated: ${result.timestamp}`);
    lines.push(`Expires: ${result.expiresAt}`);

    return lines.join("\n");
  }
}

export const shipBadgeGenerator = new ShipBadgeGenerator();
