/**
 * Pre-Deployment Checker
 *
 * Comprehensive deployment gate that prevents shipping broken code.
 * Runs all quality checks and blocks deployment if critical issues exist.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { vibecoderDetector } from "./vibecoder-detector";
import { polishService } from "./polish/polish-service";
import { semanticVibeAnalyzer } from "./semantic-vibe-analyzer";
import { designSystemEnforcer } from "./design-system-enforcer";
import { envValidator } from "./env-validator";

export interface DeploymentGate {
  name: string;
  description: string;
  severity: "blocker" | "warning" | "info";
  check: (projectPath: string) => Promise<GateResult>;
}

export interface GateResult {
  passed: boolean;
  message: string;
  details?: string[];
  score?: number;
}

export interface PreDeployReport {
  canDeploy: boolean;
  timestamp: Date;
  projectPath: string;
  overallScore: number;
  gates: Array<{
    name: string;
    severity: string;
    passed: boolean;
    message: string;
    details?: string[];
  }>;
  blockers: string[];
  warnings: string[];
  summary: string;
  recommendations: string[];
}

export interface PreDeployConfig {
  minVibeScore?: number;
  minPolishScore?: number;
  minSemanticScore?: number;
  maxDesignViolations?: number;
  requireTests?: boolean;
  requireEnvExample?: boolean;
  requireNoSecrets?: boolean;
  requireErrorBoundary?: boolean;
  requireRateLimiting?: boolean;
  customGates?: DeploymentGate[];
  skipGates?: string[];
}

const DEFAULT_CONFIG: PreDeployConfig = {
  minVibeScore: 60,
  minPolishScore: 50,
  minSemanticScore: 40,
  maxDesignViolations: 100,
  requireTests: true,
  requireEnvExample: true,
  requireNoSecrets: true,
  requireErrorBoundary: true,
  requireRateLimiting: false,
};

class PreDeployChecker {
  private gates: DeploymentGate[] = [];

  constructor() {
    this.registerDefaultGates();
  }

  /**
   * Run all pre-deployment checks
   */
  async check(
    projectPath: string,
    config: PreDeployConfig = {},
  ): Promise<PreDeployReport> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const results: PreDeployReport["gates"] = [];
    const blockers: string[] = [];
    const warnings: string[] = [];

    // Filter gates based on skipGates config
    const activeGates = this.gates.filter(
      (gate) => !mergedConfig.skipGates?.includes(gate.name),
    );

    // Add custom gates
    if (mergedConfig.customGates) {
      activeGates.push(...mergedConfig.customGates);
    }

    // Run all gates
    for (const gate of activeGates) {
      try {
        const result = await gate.check(projectPath);

        results.push({
          name: gate.name,
          severity: gate.severity,
          passed: result.passed,
          message: result.message,
          details: result.details,
        });

        if (!result.passed) {
          if (gate.severity === "blocker") {
            blockers.push(`${gate.name}: ${result.message}`);
          } else if (gate.severity === "warning") {
            warnings.push(`${gate.name}: ${result.message}`);
          }
        }
      } catch (error) {
        results.push({
          name: gate.name,
          severity: gate.severity,
          passed: false,
          message: `Gate check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });

        if (gate.severity === "blocker") {
          blockers.push(`${gate.name}: Check failed with error`);
        }
      }
    }

    // Calculate overall score
    const passedGates = results.filter((r) => r.passed).length;
    const overallScore = Math.round((passedGates / results.length) * 100);

    // Generate summary and recommendations
    const canDeploy = blockers.length === 0;
    const summary = this.generateSummary(canDeploy, blockers, warnings);
    const recommendations = this.generateRecommendations(results, mergedConfig);

    return {
      canDeploy,
      timestamp: new Date(),
      projectPath,
      overallScore,
      gates: results,
      blockers,
      warnings,
      summary,
      recommendations,
    };
  }

  /**
   * Register default deployment gates
   */
  private registerDefaultGates() {
    // Gate 1: Vibe Score
    this.gates.push({
      name: "Vibe Score",
      description: "Minimum vibe score requirement",
      severity: "blocker",
      check: async (projectPath) => {
        const report = await vibecoderDetector.analyze(projectPath);
        const minScore = DEFAULT_CONFIG.minVibeScore || 60;
        return {
          passed: report.score >= minScore,
          message:
            report.score >= minScore
              ? `Vibe score ${report.score}% meets minimum (${minScore}%)`
              : `Vibe score ${report.score}% below minimum (${minScore}%)`,
          score: report.score,
          details: report.missingCritical.map((m) => `Missing: ${m.feature}`),
        };
      },
    });

    // Gate 2: Critical Features
    this.gates.push({
      name: "Critical Features",
      description: "No missing critical features",
      severity: "blocker",
      check: async (projectPath) => {
        const report = await vibecoderDetector.analyze(projectPath);
        return {
          passed: report.missingCritical.length === 0,
          message:
            report.missingCritical.length === 0
              ? "All critical features present"
              : `${report.missingCritical.length} critical feature(s) missing`,
          details: report.missingCritical.map((m) => m.feature),
        };
      },
    });

    // Gate 3: Polish Score
    this.gates.push({
      name: "Polish Score",
      description: "Minimum polish score requirement",
      severity: "warning",
      check: async (projectPath) => {
        const report = await polishService.analyzeProject(projectPath);
        const minScore = DEFAULT_CONFIG.minPolishScore || 50;
        return {
          passed: report.score >= minScore,
          message:
            report.score >= minScore
              ? `Polish score ${report.score}% meets minimum (${minScore}%)`
              : `Polish score ${report.score}% below minimum (${minScore}%)`,
          score: report.score,
        };
      },
    });

    // Gate 4: No Critical Polish Issues
    this.gates.push({
      name: "Critical Polish Issues",
      description: "No critical polish issues",
      severity: "blocker",
      check: async (projectPath) => {
        const report = await polishService.analyzeProject(projectPath);
        const criticalIssues = report.issues.filter(
          (i) => i.severity === "critical",
        );
        return {
          passed: criticalIssues.length === 0,
          message:
            criticalIssues.length === 0
              ? "No critical polish issues"
              : `${criticalIssues.length} critical polish issue(s) found`,
          details: criticalIssues.map((i) => i.title),
        };
      },
    });

    // Gate 5: Implementation Quality
    this.gates.push({
      name: "Implementation Quality",
      description: "Semantic quality analysis",
      severity: "warning",
      check: async (projectPath) => {
        const report = await semanticVibeAnalyzer.analyze(projectPath);
        const minScore = DEFAULT_CONFIG.minSemanticScore || 40;
        const poorFeatures = report.checks.filter((c) => c.quality === "poor");
        return {
          passed: report.overallQuality >= minScore && poorFeatures.length <= 2,
          message:
            report.overallQuality >= minScore
              ? `Implementation quality ${report.overallQuality}% acceptable`
              : `Implementation quality ${report.overallQuality}% needs improvement`,
          score: report.overallQuality,
          details: poorFeatures.map(
            (f) => `${f.feature}: ${f.issues[0] || "Poor quality"}`,
          ),
        };
      },
    });

    // Gate 6: Environment Configuration
    this.gates.push({
      name: "Environment Config",
      description: "Environment configuration exists",
      severity: "blocker",
      check: async (projectPath) => {
        const envExample = path.join(projectPath, ".env.example");
        const envLocal = path.join(projectPath, ".env.local");
        const env = path.join(projectPath, ".env");

        const hasEnvExample = await this.fileExists(envExample);
        const hasEnv =
          (await this.fileExists(envLocal)) || (await this.fileExists(env));

        return {
          passed: hasEnvExample,
          message: hasEnvExample
            ? ".env.example exists for documentation"
            : "Missing .env.example - other developers cannot configure the app",
          details: !hasEnvExample
            ? ['Run "guardrail fix" to generate .env.example']
            : undefined,
        };
      },
    });

    // Gate 7: No Hardcoded Secrets
    this.gates.push({
      name: "No Hardcoded Secrets",
      description: "No secrets in source code",
      severity: "blocker",
      check: async (projectPath) => {
        const secrets = await this.scanForSecrets(projectPath);
        return {
          passed: secrets.length === 0,
          message:
            secrets.length === 0
              ? "No hardcoded secrets detected"
              : `${secrets.length} potential secret(s) found in code`,
          details: secrets.slice(0, 5),
        };
      },
    });

    // Gate 8: Git Status Clean
    this.gates.push({
      name: "Git Status",
      description: "No uncommitted changes",
      severity: "warning",
      check: async (projectPath) => {
        try {
          const status = execSync("git status --porcelain", {
            cwd: projectPath,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
          });
          const hasChanges = status.trim().length > 0;
          return {
            passed: !hasChanges,
            message: hasChanges
              ? "Uncommitted changes detected"
              : "Working directory clean",
            details: hasChanges ? status.split("\n").slice(0, 5) : undefined,
          };
        } catch {
          return {
            passed: true,
            message: "Git status check skipped (not a git repo)",
          };
        }
      },
    });

    // Gate 9: Tests Pass
    this.gates.push({
      name: "Tests Pass",
      description: "All tests must pass",
      severity: "blocker",
      check: async (projectPath) => {
        const hasTests = await this.hasTestFiles(projectPath);

        if (!hasTests) {
          return {
            passed: false,
            message: "No test files found",
            details: ["Add tests to ensure code quality"],
          };
        }

        try {
          // Try to run tests
          execSync("npm test -- --passWithNoTests 2>&1", {
            cwd: projectPath,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 120000, // 2 minute timeout
          });
          return {
            passed: true,
            message: "All tests pass",
          };
        } catch (error) {
          return {
            passed: false,
            message: "Tests failed",
            details: ['Run "npm test" to see failures'],
          };
        }
      },
    });

    // Gate 10: TypeScript Compilation
    this.gates.push({
      name: "TypeScript Build",
      description: "TypeScript compiles without errors",
      severity: "blocker",
      check: async (projectPath) => {
        const hasTsConfig = await this.fileExists(
          path.join(projectPath, "tsconfig.json"),
        );

        if (!hasTsConfig) {
          return {
            passed: true,
            message: "Not a TypeScript project (skipped)",
          };
        }

        try {
          execSync("npx tsc --noEmit 2>&1", {
            cwd: projectPath,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 60000,
          });
          return {
            passed: true,
            message: "TypeScript compiles successfully",
          };
        } catch (error) {
          const output =
            error instanceof Error ? (error as any).stdout || "" : "";
          const errorCount = (output.match(/error TS/g) || []).length;
          return {
            passed: false,
            message: `TypeScript compilation failed (${errorCount} error(s))`,
            details: ['Run "npx tsc --noEmit" to see errors'],
          };
        }
      },
    });

    // Gate 11: Package Vulnerabilities
    this.gates.push({
      name: "Package Security",
      description: "No high/critical vulnerabilities",
      severity: "blocker",
      check: async (projectPath) => {
        try {
          const result = execSync("npm audit --json 2>&1", {
            cwd: projectPath,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
          });

          const audit = JSON.parse(result);
          const high = audit.metadata?.vulnerabilities?.high || 0;
          const critical = audit.metadata?.vulnerabilities?.critical || 0;

          return {
            passed: high === 0 && critical === 0,
            message:
              high === 0 && critical === 0
                ? "No high/critical vulnerabilities"
                : `${high} high, ${critical} critical vulnerabilities found`,
            details:
              high + critical > 0
                ? ['Run "npm audit fix" to resolve']
                : undefined,
          };
        } catch (error) {
          // npm audit returns non-zero when vulnerabilities found
          try {
            const output = (error as any).stdout || "";
            const audit = JSON.parse(output);
            const high = audit.metadata?.vulnerabilities?.high || 0;
            const critical = audit.metadata?.vulnerabilities?.critical || 0;

            return {
              passed: high === 0 && critical === 0,
              message:
                high === 0 && critical === 0
                  ? "No high/critical vulnerabilities"
                  : `${high} high, ${critical} critical vulnerabilities`,
            };
          } catch {
            return {
              passed: true,
              message: "Package audit skipped",
            };
          }
        }
      },
    });

    // Gate 12: Design System (Warning only)
    this.gates.push({
      name: "Design System",
      description: "Design system compliance",
      severity: "info",
      check: async (projectPath) => {
        const report = await designSystemEnforcer.analyze(projectPath);
        const maxViolations = DEFAULT_CONFIG.maxDesignViolations || 100;
        return {
          passed: report.violations.length <= maxViolations,
          message:
            report.violations.length <= maxViolations
              ? `${report.violations.length} style violations (acceptable)`
              : `${report.violations.length} style violations exceed limit (${maxViolations})`,
          score: report.score,
        };
      },
    });

    // Gate 13: Build Success
    this.gates.push({
      name: "Build Success",
      description: "Project builds successfully",
      severity: "blocker",
      check: async (projectPath) => {
        const packageJson = path.join(projectPath, "package.json");

        try {
          const content = await fs.promises.readFile(packageJson, "utf8");
          const pkg = JSON.parse(content);

          if (!pkg.scripts?.build) {
            return {
              passed: true,
              message: "No build script (skipped)",
            };
          }

          execSync("npm run build 2>&1", {
            cwd: projectPath,
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 300000, // 5 minute timeout
          });

          return {
            passed: true,
            message: "Build completed successfully",
          };
        } catch (error) {
          return {
            passed: false,
            message: "Build failed",
            details: ['Run "npm run build" to see errors'],
          };
        }
      },
    });
  }

  /**
   * Scan for potential secrets in source code
   */
  private async scanForSecrets(projectPath: string): Promise<string[]> {
    const secrets: string[] = [];
    const patterns = [
      /['"]sk-[a-zA-Z0-9]{20,}['"]/, // OpenAI keys
      /['"]sk-ant-[a-zA-Z0-9]{20,}['"]/, // Anthropic keys
      /['"][A-Z0-9]{20}['"].*['"][a-zA-Z0-9/+=]{40}['"]/, // AWS keys
      /password\s*[:=]\s*['"][^'"]{8,}['"]/i, // Passwords
      /api[_-]?key\s*[:=]\s*['"][^'"]{16,}['"]/i, // API keys
      /secret\s*[:=]\s*['"][^'"]{16,}['"]/i, // Secrets
      /private[_-]?key/i, // Private keys
    ];

    const srcDirs = ["src", "lib", "app", "pages", "components"];

    for (const dir of srcDirs) {
      const dirPath = path.join(projectPath, dir);
      if (await this.fileExists(dirPath)) {
        await this.scanDirectory(dirPath, patterns, secrets);
      }
    }

    return secrets;
  }

  private async scanDirectory(
    dir: string,
    patterns: RegExp[],
    results: string[],
  ): Promise<void> {
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          await this.scanDirectory(fullPath, patterns, results);
        } else if (item.isFile() && /\.(ts|tsx|js|jsx|json)$/.test(item.name)) {
          try {
            const content = await fs.promises.readFile(fullPath, "utf8");
            for (const pattern of patterns) {
              if (pattern.test(content)) {
                results.push(`Potential secret in ${item.name}`);
                break;
              }
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  private shouldIgnore(name: string): boolean {
    return [
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      "coverage",
      ".turbo",
    ].includes(name);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async hasTestFiles(projectPath: string): Promise<boolean> {
    const testDirs = ["__tests__", "tests", "test", "spec"];
    const testPatterns = [".test.", ".spec.", "_test.", "_spec."];

    for (const dir of testDirs) {
      if (await this.fileExists(path.join(projectPath, dir))) {
        return true;
      }
    }

    // Check for test files in src
    const srcPath = path.join(projectPath, "src");
    if (await this.fileExists(srcPath)) {
      try {
        const files = await this.findFiles(srcPath, 3);
        return files.some((f) => testPatterns.some((p) => f.includes(p)));
      } catch {
        return false;
      }
    }

    return false;
  }

  private async findFiles(
    dir: string,
    maxDepth: number,
    depth = 0,
  ): Promise<string[]> {
    if (depth > maxDepth) return [];

    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(
            ...(await this.findFiles(
              path.join(dir, item.name),
              maxDepth,
              depth + 1,
            )),
          );
        } else if (item.isFile()) {
          files.push(item.name);
        }
      }
    } catch {
      // Skip inaccessible directories
    }

    return files;
  }

  private generateSummary(
    canDeploy: boolean,
    blockers: string[],
    warnings: string[],
  ): string {
    if (canDeploy && warnings.length === 0) {
      return "🚀 All checks passed! Ready to deploy.";
    }
    if (canDeploy && warnings.length > 0) {
      return `⚠️ Ready to deploy with ${warnings.length} warning(s). Review before shipping.`;
    }
    return `🛑 DEPLOYMENT BLOCKED: ${blockers.length} critical issue(s) must be resolved.`;
  }

  private generateRecommendations(
    results: PreDeployReport["gates"],
    config: PreDeployConfig,
  ): string[] {
    const recommendations: string[] = [];

    const failed = results.filter((r) => !r.passed);

    for (const gate of failed) {
      switch (gate.name) {
        case "Vibe Score":
          recommendations.push('Run "guardrail fix" to add missing features');
          break;
        case "Critical Features":
          recommendations.push(
            "Add critical features: auth, database, error handling",
          );
          break;
        case "Environment Config":
          recommendations.push('Run "guardrail fix" to generate .env.example');
          break;
        case "No Hardcoded Secrets":
          recommendations.push("Move secrets to environment variables");
          break;
        case "Tests Pass":
          recommendations.push('Fix failing tests with "npm test"');
          break;
        case "TypeScript Build":
          recommendations.push('Fix TypeScript errors with "npx tsc --noEmit"');
          break;
        case "Package Security":
          recommendations.push(
            'Run "npm audit fix" to resolve vulnerabilities',
          );
          break;
        case "Build Success":
          recommendations.push('Fix build errors with "npm run build"');
          break;
      }
    }

    return Array.from(new Set(recommendations)); // Deduplicate
  }

  /**
   * Add a custom deployment gate
   */
  addGate(gate: DeploymentGate): void {
    this.gates.push(gate);
  }

  /**
   * Get all registered gates
   */
  getGates(): DeploymentGate[] {
    return [...this.gates];
  }
}

export const preDeployChecker = new PreDeployChecker();
