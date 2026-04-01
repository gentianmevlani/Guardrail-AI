/**
 * guardrail MCP Client
 *
 * Runs workspace scans and ship checks via the published CLI (`execCLI`).
 * The resolved MCP server path is the same bundle used by Cursor/MCP hosts over stdio;
 * use {@link getConnectionStatus} / {@link getMcpServerPath} to surface it in the UI.
 */

import * as vscode from "vscode";
import { spawn, exec } from "child_process";
import * as path from "path";
import {
  probeMcpStdioProtocol,
  type McpProtocolProbeResult,
} from "./mcp-stdio-probe";
import { normalizeScanJsonData } from "./scan-cli-map";
import {
  canShipFromScanState,
  gradeFromScanScore,
  GUARDRAIL_SHIP_SCORE_THRESHOLD,
} from "@guardrail/core";
import {
  FREE_TIER_ISSUE_DETAILS_UPGRADE_HINT,
  shouldHideIssueDetailsForTier,
} from "./tier-context";

export type { McpProtocolProbeResult } from "./mcp-stdio-probe";

export interface ScanResult {
  /** `null` when the CLI did not emit a score (parse failure or missing fields) — not the same as 0. */
  score: number | null;
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
  /** When Free tier (or unauthenticated as free): findings cleared; counts remain in `cliSummary`. */
  issueDetailsRedacted?: boolean;
  upgradeHint?: string;
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
  issueDetailsRedacted?: boolean;
  upgradeHint?: string;
  /** When redacted, number of issues that were hidden (score still reflects full check). */
  redactedIssueCount?: number;
}

/** How the extension reaches Guardrail: CLI for scans; MCP bundle is for IDE/Cursor config alongside the same tools. */
export interface GuardrailConnectionStatus {
  cliPath: string;
  cliAvailable: boolean;
  mcpServerPath: string;
  /** True when `mcp-server/index.js` exists at the resolved path (repo or node_modules). */
  mcpBundleFound: boolean;
  /**
   * Optional stdio probe: JSON-RPC `initialize` over MCP framing.
   * `skipped` when no bundle; `path_only` when the file exists but handshake failed or timed out.
   */
  mcpProtocol: McpProtocolProbeResult;
  /** Current implementation runs `guardrail scan` / `ship` via CLI, not stdio MCP in this process. */
  scanTransport: "cli";
  /** Effective product tier (API → login cache → CLI state). */
  resolvedTier: string;
}

export class GuardrailMCPClient {
  private static readonly _MCP_PROBE_TTL_MS = 60_000;

  private outputChannel: vscode.OutputChannel;
  private mcpServerPath: string;
  private cliPath: string;
  private _mcpProbeCache:
    | { path: string; at: number; mcpProtocol: McpProtocolProbeResult }
    | null = null;

  private readonly resolveTier?: () => Promise<string>;

  constructor(options?: { resolveTier?: () => Promise<string> }) {
    this.resolveTier = options?.resolveTier;
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

  /** Resolved path to the MCP server entry (for Cursor/VS Code MCP config). */
  getMcpServerPath(): string {
    return this.mcpServerPath;
  }

  /** Resolved CLI path or global command name. */
  getCliPath(): string {
    return this.cliPath;
  }

  async getConnectionStatus(): Promise<GuardrailConnectionStatus> {
    const fs = require("fs") as typeof import("fs");
    const mcpBundleFound = fs.existsSync(this.mcpServerPath);
    const cliAvailable = await this.checkAvailability();

    let mcpProtocol: McpProtocolProbeResult = "skipped";
    if (mcpBundleFound) {
      const now = Date.now();
      const c = this._mcpProbeCache;
      const cacheOk =
        c &&
        c.path === this.mcpServerPath &&
        now - c.at < GuardrailMCPClient._MCP_PROBE_TTL_MS;
      if (cacheOk) {
        mcpProtocol = c.mcpProtocol;
      } else {
        const probed = await probeMcpStdioProtocol(this.mcpServerPath, {
          log: (msg) => this.log(msg),
        });
        mcpProtocol = probed === "skipped" ? "path_only" : probed;
        this._mcpProbeCache = {
          path: this.mcpServerPath,
          at: now,
          mcpProtocol,
        };
      }
    } else {
      this._mcpProbeCache = null;
    }

    let resolvedTier = "free";
    if (this.resolveTier) {
      try {
        resolvedTier = await this.resolveTier();
      } catch {
        resolvedTier = "free";
      }
    }

    return {
      cliPath: this.cliPath,
      cliAvailable,
      mcpServerPath: this.mcpServerPath,
      mcpBundleFound,
      mcpProtocol,
      scanTransport: "cli",
      resolvedTier,
    };
  }

  /**
   * Scan workspace for issues (`guardrail scan --json`; no `--profile` — not supported by current CLI).
   */
  async scan(projectPath: string): Promise<ScanResult> {
    this.log(`Scanning ${projectPath}`);

    try {
      const result = await this.execCLI("scan", ["--json"], projectPath);

      return this.applyTierScanPolicy(this.parseScanResult(result));
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
      return this.applyTierScanPolicy(this.parseScanResult(result));
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

    const base: ValidateResult = {
      score: Math.max(0, score),
      status:
        score >= GUARDRAIL_SHIP_SCORE_THRESHOLD ? "passed" : "failed",
      issues,
    };
    return this.applyTierValidatePolicy(base);
  }

  private async applyTierScanPolicy(result: ScanResult): Promise<ScanResult> {
    if (!this.resolveTier) {
      return result;
    }
    const tier = await this.resolveTier();
    if (!shouldHideIssueDetailsForTier(tier)) {
      return result;
    }
    return {
      ...result,
      issues: [],
      issueDetailsRedacted: true,
      upgradeHint: FREE_TIER_ISSUE_DETAILS_UPGRADE_HINT,
    };
  }

  private async applyTierValidatePolicy(
    result: ValidateResult,
  ): Promise<ValidateResult> {
    if (!this.resolveTier) {
      return result;
    }
    const tier = await this.resolveTier();
    if (!shouldHideIssueDetailsForTier(tier)) {
      return result;
    }
    const n = result.issues.length;
    return {
      ...result,
      issues: [],
      issueDetailsRedacted: true,
      upgradeHint: FREE_TIER_ISSUE_DETAILS_UPGRADE_HINT,
      redactedIssueCount: n,
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
        return await this.applyTierScanPolicy(this.parseScanResult(content));
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
      const normalized =
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
          ? normalizeScanJsonData(parsed as Record<string, unknown>)
          : parsed;
      return this.jsonToScanResult(normalized);
    } catch {
      const scoreMatch = output.match(/Score:\s*(\d+)/i);
      const gradeMatch = output.match(/Grade:\s*([A-F][+-]?)/i);
      const canShipMatch = output.match(/(SHIP|NO-SHIP|CLEAR|BLOCKED)/i);

      return {
        score: scoreMatch ? parseInt(scoreMatch[1], 10) : null,
        grade: gradeMatch ? gradeMatch[1] : "?",
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
          : null;

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
      const v =
        verdict === "PASS" || verdict === "FAIL" || verdict === "WARN"
          ? verdict
          : undefined;
      canShip = canShipFromScanState(totalScore, v);
    }

    const grade =
      typeof scanObj.grade === "string"
        ? scanObj.grade
        : gradeFromScanScore(totalScore);

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
        score: null,
        grade: "?",
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
      const sc = typeof j.score === "number" ? j.score : null;
      return {
        score: sc,
        grade: typeof j.grade === "string" ? j.grade : gradeFromScanScore(sc),
        canShip:
          typeof j.canShip === "boolean"
            ? j.canShip
            : canShipFromScanState(sc, undefined),
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
        grade:
          typeof j.grade === "string" ? j.grade : gradeFromScanScore(j.score),
        canShip:
          typeof j.canShip === "boolean"
            ? j.canShip
            : canShipFromScanState(j.score, undefined),
        counts:
          j.counts && typeof j.counts === "object"
            ? (j.counts as ScanResult["counts"])
            : {},
        issues: [],
      };
    }

    // Last resort: flat score / issues
    const lastSc = typeof j.score === "number" ? j.score : null;
    return {
      score: lastSc,
      grade: typeof j.grade === "string" ? j.grade : gradeFromScanScore(lastSc),
      canShip:
        typeof j.canShip === "boolean"
          ? j.canShip
          : canShipFromScanState(lastSc, undefined),
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
