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
  /** Present when output came from `guardrail scan --json` (severity buckets; use when issues are empty due to free-tier redaction). */
  cliSummary?: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
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
   * Scan workspace for issues (`guardrail scan --json`; no `--profile` — not supported by current CLI).
   */
  async scan(projectPath: string): Promise<ScanResult> {
    this.log(`Scanning ${projectPath}`);

    try {
      const result = await this.execCLI("scan", ["--json"], projectPath);

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
   * Load last machine-readable scan (same shapes as CLI stdout).
   * Prefers `scan.json`, then `ship.json`, then legacy `summary.json`.
   */
  async getLastScan(projectPath: string): Promise<ScanResult | null> {
    const fs = require("fs").promises;
    const guardrailDir = path.join(projectPath, ".guardrail");
    const candidates = [
      path.join(guardrailDir, "scan.json"),
      path.join(guardrailDir, "ship.json"),
      path.join(guardrailDir, "summary.json"),
    ];
    for (const p of candidates) {
      try {
        const content = await fs.readFile(p, "utf-8");
        return this.parseScanResult(content);
      } catch {
        continue;
      }
    }
    return null;
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
    const raw = this.extractJsonPayload(output);
    try {
      const parsed: unknown = JSON.parse(raw);
      return this.jsonToScanResult(parsed);
    } catch {
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

  /** First JSON object in stdout (CLI may print a newline before `{`). */
  private extractJsonPayload(output: string): string {
    const t = output.trim();
    if (t.startsWith("{")) return t;
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return t.slice(start, end + 1);
    }
    return t;
  }

  private scoreToGrade(score: number): string {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }

  private severityToIssueType(sev: string): Issue["type"] {
    const s = (sev || "").toLowerCase();
    if (s === "critical") return "critical";
    if (s === "high" || s === "medium") return "warning";
    return "suggestion";
  }

  private cliFindingToIssue(f: Record<string, unknown>): Issue {
    const sev = String(f.severity ?? "");
    const typ = String(f.type ?? "finding");
    const file = typeof f.file === "string" ? f.file : undefined;
    const line = typeof f.line === "number" ? f.line : undefined;
    const parts = [typ, sev ? `(${sev})` : ""].filter(Boolean).join(" ");
    const loc = file ? ` — ${file}${line != null ? `:${line}` : ""}` : "";
    return {
      type: this.severityToIssueType(sev),
      category: typ,
      file,
      line,
      message: `${parts}${loc}`,
    };
  }

  private scanRecordToScanResult(
    scanObj: Record<string, unknown>,
    canShipOverride?: boolean,
  ): ScanResult {
    const summary = scanObj.summary as Record<string, unknown> | undefined;
    const totalScore =
      typeof summary?.totalScore === "number"
        ? summary.totalScore
        : typeof scanObj.score === "number"
          ? scanObj.score
          : 0;

    const rawFindings = Array.isArray(scanObj.findings) ? scanObj.findings : [];
    const issues: Issue[] = rawFindings.map((item) =>
      this.cliFindingToIssue(item as Record<string, unknown>),
    );

    const cliSummary =
      summary && typeof summary.totalFindings === "number"
        ? {
            totalFindings: summary.totalFindings,
            critical: Number(summary.critical) || 0,
            high: Number(summary.high) || 0,
            medium: Number(summary.medium) || 0,
            low: Number(summary.low) || 0,
          }
        : undefined;

    const verdict = scanObj.verdict;
    let canShip = canShipOverride;
    if (canShip === undefined) {
      if (verdict === "PASS") canShip = true;
      else if (verdict === "FAIL" || verdict === "WARN") canShip = false;
      else canShip = false;
    }

    const grade =
      typeof scanObj.grade === "string"
        ? scanObj.grade
        : this.scoreToGrade(totalScore);

    const counts =
      scanObj.counts && typeof scanObj.counts === "object"
        ? (scanObj.counts as ScanResult["counts"])
        : {};

    return {
      score: totalScore,
      grade,
      canShip,
      counts,
      issues,
      ...(cliSummary ? { cliSummary } : {}),
    };
  }

  private jsonToScanResult(json: unknown): ScanResult {
    if (!json || typeof json !== "object") {
      return {
        score: 0,
        grade: "F",
        canShip: false,
        counts: {},
        issues: [],
      };
    }

    const j = json as Record<string, unknown>;

    // Standardized CLI wrapper: { success, data }
    if (j.success === true && j.data && typeof j.data === "object") {
      return this.jsonToScanResult(j.data);
    }

    // `guardrail ship --json`: nested scan + GO | NO-GO | WARN
    if (
      j.scan &&
      typeof j.scan === "object" &&
      (j.verdict === "GO" || j.verdict === "NO-GO" || j.verdict === "WARN")
    ) {
      const scanPart = this.scanRecordToScanResult(
        j.scan as Record<string, unknown>,
        j.verdict === "GO",
      );
      const deadUI = j.deadUI as Record<string, unknown> | undefined;
      const deadFindings = deadUI?.findings;
      const extra: Issue[] = [];
      if (Array.isArray(deadFindings)) {
        for (const item of deadFindings) {
          const df = item as Record<string, unknown>;
          const sev = String(df.severity ?? "");
          extra.push({
            type: this.severityToIssueType(sev),
            category: String(df.type ?? "dead-ui"),
            file: typeof df.file === "string" ? df.file : undefined,
            line: typeof df.line === "number" ? df.line : undefined,
            message: String(df.issue ?? df.type ?? "Dead UI finding"),
          });
        }
      }
      return {
        ...scanPart,
        issues: [...scanPart.issues, ...extra],
        canShip: j.verdict === "GO",
      };
    }

    // `guardrail scan --json` (findings + summary.totalScore; takes precedence over empty legacy issues)
    if (j.findings !== undefined || j.summary !== undefined) {
      return this.scanRecordToScanResult(j);
    }

    // Legacy extension shape: score + issues[]
    if (Array.isArray(j.issues) && j.issues.length > 0) {
      return {
        score: typeof j.score === "number" ? j.score : 0,
        grade: typeof j.grade === "string" ? j.grade : "F",
        canShip: Boolean(j.canShip),
        counts:
          j.counts && typeof j.counts === "object"
            ? (j.counts as ScanResult["counts"])
            : {},
        issues: j.issues as Issue[],
      };
    }

    // Runner `summary.json` (no findings list)
    if (
      typeof j.score === "number" &&
      !j.findings &&
      !j.scan &&
      !Array.isArray(j.issues)
    ) {
      return {
        score: j.score,
        grade: typeof j.grade === "string" ? j.grade : this.scoreToGrade(j.score),
        canShip: Boolean(j.canShip),
        counts:
          j.counts && typeof j.counts === "object"
            ? (j.counts as ScanResult["counts"])
            : {},
        issues: [],
      };
    }

    // Last resort: flat score / issues
    return {
      score: typeof j.score === "number" ? j.score : 0,
      grade: typeof j.grade === "string" ? j.grade : "F",
      canShip: Boolean(j.canShip),
      counts:
        j.counts && typeof j.counts === "object"
          ? (j.counts as ScanResult["counts"])
          : {},
      issues: Array.isArray(j.issues) ? (j.issues as Issue[]) : [],
    };
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
