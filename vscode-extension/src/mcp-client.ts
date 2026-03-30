/**
 * guardrail MCP Client
 *
 * Communicates with the local guardrail MCP server via stdio transport.
 * Falls back to direct CLI execution if MCP server is not running.
 */

import * as vscode from "vscode";
import { spawn, exec } from "child_process";
import * as path from "path";

export interface ScanResult {
  score: number;
  grade: string;
  canShip: boolean;
  counts: {
    secrets?: number;
    auth?: number;
    mocks?: number;
    routes?: number;
    integrity?: number;
  };
  issues: Issue[];
}

export interface Issue {
  type: "critical" | "warning" | "suggestion";
  category: string;
  file?: string;
  line?: number;
  message: string;
  fix?: string;
}

export interface ValidateResult {
  score: number;
  status: "passed" | "failed";
  issues: Issue[];
}

export class GuardrailMCPClient {
  private outputChannel: vscode.OutputChannel;
  private mcpServerPath: string;
  private cliPath: string;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("guardrail");

    // Find paths relative to extension
    const extensionPath =
      vscode.extensions.getExtension("guardrail.guardrail")?.extensionPath ||
      path.join(__dirname, "..", "..");

    // Look for CLI in common locations
    this.mcpServerPath = this.findPath([
      path.join(extensionPath, "..", "mcp-server", "index.js"),
      path.join(
        extensionPath,
        "node_modules",
        "@guardrail",
        "mcp-server",
        "index.js",
      ),
    ]);

    this.cliPath = this.findPath([
      path.join(extensionPath, "..", "bin", "guardrail.js"),
      path.join(
        extensionPath,
        "node_modules",
        "@guardrail",
        "cli",
        "bin",
        "guardrail.js",
      ),
      "guardrail", // Global install
    ]);
  }

  private findPath(candidates: string[]): string {
    const fs = require("fs");
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          return p;
        }
      } catch {}
    }
    return candidates[candidates.length - 1]; // Return last as fallback
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
  }

  /**
   * Scan workspace for issues
   */
  async scan(
    projectPath: string,
    profile: string = "quick",
  ): Promise<ScanResult> {
    this.log(`Scanning ${projectPath} with profile: ${profile}`);

    try {
      const result = await this.execCLI(
        "scan",
        [`--profile=${profile}`, "--json"],
        projectPath,
      );

      return this.parseScanResult(result);
    } catch (error: any) {
      this.log(`Scan error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Quick ship check
   */
  async ship(projectPath: string): Promise<ScanResult> {
    this.log(`Ship check for ${projectPath}`);

    try {
      const result = await this.execCLI("ship", ["--json"], projectPath);
      return this.parseScanResult(result);
    } catch (error: any) {
      this.log(`Ship check error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate AI-generated code
   */
  async validate(code: string, intent?: string): Promise<ValidateResult> {
    this.log(`Validating code snippet`);

    // Use local validation for speed
    const issues: Issue[] = [];
    let score = 100;

    // Check for hallucinated imports
    const importMatches = code.matchAll(/import\s+.*from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      const pkg = match[1];
      if (!pkg.startsWith(".") && !pkg.startsWith("@")) {
        // Could be hallucinated - flag for review
        if (this.isLikelyHallucinated(pkg)) {
          issues.push({
            type: "warning",
            category: "hallucination",
            message: `Import '${pkg}' may be hallucinated - verify it exists`,
          });
          score -= 10;
        }
      }
    }

    // Check for mock patterns in code
    if (/mock|fake|dummy|test|placeholder/i.test(code)) {
      issues.push({
        type: "warning",
        category: "mock-code",
        message:
          "Code contains mock/test patterns - ensure this is intentional",
      });
      score -= 5;
    }

    // Check for hardcoded credentials
    if (
      /password\s*[:=]\s*['"][^'"]+['"]/i.test(code) ||
      /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i.test(code)
    ) {
      issues.push({
        type: "critical",
        category: "hardcoded-secret",
        message: "Hardcoded credential detected",
      });
      score -= 30;
    }

    // Intent mismatch check
    if (intent) {
      const intentScore = this.checkIntentMatch(code, intent);
      if (intentScore < 0.5) {
        issues.push({
          type: "warning",
          category: "intent-mismatch",
          message: "Code may not match stated intent",
        });
        score -= 15;
      }
    }

    return {
      score: Math.max(0, score),
      status: score >= 70 ? "passed" : "failed",
      issues,
    };
  }

  private isLikelyHallucinated(pkg: string): boolean {
    // Common hallucinated package patterns
    const suspiciousPatterns = [
      /^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/, // Too many hyphens
      /v\d+$/, // Version suffix
      /^@[a-z]+\/[a-z]+-[a-z]+-[a-z]+$/, // Overly specific scoped package
    ];
    return suspiciousPatterns.some((p) => p.test(pkg));
  }

  private checkIntentMatch(code: string, intent: string): number {
    const intentWords = intent.toLowerCase().split(/\s+/);
    const codeWords = code.toLowerCase().split(/\s+/);

    let matches = 0;
    for (const word of intentWords) {
      if (word.length > 3 && codeWords.some((cw) => cw.includes(word))) {
        matches++;
      }
    }

    return intentWords.length > 0 ? matches / intentWords.length : 1;
  }

  /**
   * Get last scan summary
   */
  async getLastScan(projectPath: string): Promise<ScanResult | null> {
    try {
      const fs = require("fs").promises;
      const summaryPath = path.join(projectPath, ".guardrail", "summary.json");
      const content = await fs.readFile(summaryPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Execute CLI command
   */
  public execCLI(
    command: string,
    args: string[],
    cwd: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Check if cliPath is a file or global command
      const fs = require("fs");
      let fullCommand: string;
      
      if (fs.existsSync(this.cliPath)) {
        // It's a file, run with node
        fullCommand = `node "${this.cliPath}" ${command} ${args.join(" ")}`;
      } else {
        // It's a global command
        fullCommand = `"${this.cliPath}" ${command} ${args.join(" ")}`;
      }
      
      this.log(`Executing: ${fullCommand}`);

      exec(
        fullCommand,
        {
          cwd,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, GUARDRAIL_SKIP_AUTH: "1" },
        },
        (error, stdout, stderr) => {
          if (error && !stdout) {
            reject(new Error(stderr || error.message));
          } else {
            resolve(stdout);
          }
        },
      );
    });
  }

  private parseScanResult(output: string): ScanResult {
    try {
      // Try to parse as JSON first
      const json = JSON.parse(output);
      return {
        score: json.score || 0,
        grade: json.grade || "F",
        canShip: json.canShip || false,
        counts: json.counts || {},
        issues: json.issues || [],
      };
    } catch {
      // Parse text output
      const scoreMatch = output.match(/Score:\s*(\d+)/i);
      const gradeMatch = output.match(/Grade:\s*([A-F][+-]?)/i);
      const canShipMatch = output.match(/(SHIP|NO-SHIP|CLEAR|BLOCKED)/i);

      return {
        score: scoreMatch ? parseInt(scoreMatch[1], 10) : 0,
        grade: gradeMatch ? gradeMatch[1] : "F",
        canShip: canShipMatch ? /SHIP|CLEAR/.test(canShipMatch[1]) : false,
        counts: {},
        issues: [],
      };
    }
  }

  /**
   * Check if guardrail CLI is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const fs = require("fs");
      return fs.existsSync(this.cliPath) || (await this.checkGlobalCLI());
    } catch {
      return false;
    }
  }

  private checkGlobalCLI(): Promise<boolean> {
    return new Promise((resolve) => {
      exec("guardrail --version", (error) => {
        resolve(!error);
      });
    });
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}
