import * as vscode from "vscode";
import { CLIService } from "./services/cli-service";

export interface Finding {
  type: "critical" | "warning" | "suggestion";
  category: string;
  line?: number;
  code: string;
  intent: string;
  reality: string;
  explanation: string;
  confidence: number;
}

export interface RealityCheckResult {
  file: string;
  timestamp: string;
  overallScore: number;
  findings: Finding[];
  summary: {
    critical: number;
    warnings: number;
    suggestions: number;
  };
}

export interface ProductionIntegrityResult {
  integrity: {
    score: number;
    grade: string;
    canShip: boolean;
  };
  counts: {
    api: { connected: number; missing: number };
    auth: { protected: number; exposed: number };
    secrets: { critical: number };
    routes: { deadLinks: number };
    mocks: { critical: number; high: number };
  };
}

export class RealityCheckService {
  private apiEndpoint: string;

  constructor() {
    const config = vscode.workspace.getConfiguration("guardrail");
    const ep = config.get<string>("apiEndpoint");
    this.apiEndpoint =
      ep && ep.trim().length > 0
        ? ep.trim().replace(/\/$/, "")
        : "https://api.guardrailai.dev";
  }

  /**
   * Normalize `guardrail ship --json` (and nested `scan` + `verdict`) into the
   * production audit shape expected by the webview.
   */
  private extractShipPayload(data: Record<string, unknown>): Record<string, unknown> {
    if (data.scan && typeof data.scan === "object") {
      const scan = data.scan as Record<string, unknown>;
      const verdict = data.verdict;
      const canShip = verdict === "GO";
      return {
        ...scan,
        canShip,
        grade:
          typeof scan.grade === "string"
            ? scan.grade
            : typeof data.grade === "string"
              ? data.grade
              : "—",
        score:
          typeof scan.score === "number"
            ? scan.score
            : typeof data.score === "number"
              ? data.score
              : 0,
      };
    }
    return data;
  }

  private mapShipCliToProductionIntegrity(
    data: Record<string, unknown>,
  ): ProductionIntegrityResult {
    const score = typeof data.score === "number" ? data.score : 0;
    const grade = typeof data.grade === "string" ? data.grade : "—";
    const canShip = Boolean(data.canShip);
    const issues = Array.isArray(data.issues)
      ? (data.issues as { type?: string; category?: string }[])
      : [];
    const rawCounts =
      data.counts && typeof data.counts === "object"
        ? (data.counts as Record<string, unknown>)
        : {};

    if (
      rawCounts.api &&
      typeof rawCounts.api === "object" &&
      "connected" in (rawCounts.api as object)
    ) {
      return {
        integrity: { score, grade, canShip },
        counts: rawCounts as unknown as ProductionIntegrityResult["counts"],
      };
    }

    const secretsNum =
      typeof rawCounts.secrets === "number"
        ? rawCounts.secrets
        : issues.filter(
            (i) =>
              String(i.category || "")
                .toLowerCase()
                .includes("secret") && i.type === "critical",
          ).length;
    const mocksNum =
      typeof rawCounts.mocks === "number"
        ? rawCounts.mocks
        : issues.filter((i) =>
            String(i.category || "")
              .toLowerCase()
              .includes("mock"),
          ).length;
    const authNum = typeof rawCounts.auth === "number" ? rawCounts.auth : 0;
    const routesNum = typeof rawCounts.routes === "number" ? rawCounts.routes : 0;

    return {
      integrity: { score, grade, canShip },
      counts: {
        api: { connected: routesNum > 0 ? 1 : 0, missing: 0 },
        auth: { protected: authNum, exposed: 0 },
        secrets: { critical: secretsNum },
        routes: { deadLinks: routesNum },
        mocks: { critical: mocksNum, high: 0 },
      },
    };
  }

  async analyzeCode(code: string, fileName: string): Promise<Finding[]> {
    // First try the API endpoint
    try {
      const response = await fetch(`${this.apiEndpoint}/api/reality-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, file: fileName }),
      });

      if (response.ok) {
        const result = await response.json() as { success?: boolean; data?: { findings?: Finding[] } };
        if (result.success && result.data) {
          return result.data.findings || [];
        }
      }
    } catch (error) {
      console.log("API not available, using local analysis");
    }

    // Fall back to local analysis
    return this.analyzeLocally(code, fileName);
  }

  private analyzeLocally(code: string, fileName: string): Finding[] {
    const findings: Finding[] = [];

    // Check for silent catch blocks
    const silentCatchMatch = code.match(/catch\s*\([^)]*\)\s*\{(\s*)\}/);
    if (silentCatchMatch) {
      findings.push({
        type: "critical",
        category: "silent-failure",
        code: "catch { }",
        intent: "Error handling suggests failures are being managed",
        reality: "Errors are caught but silently ignored",
        explanation:
          "Silent catches hide bugs. Log, rethrow, or handle meaningfully.",
        confidence: 0.95,
        line: this.getLineNumber(code, silentCatchMatch.index || 0),
      });
    }

    // Check for validation functions that might not return boolean
    const validationFnMatch = code.match(
      /function\s+(validate|check|verify|is|has|can)\w*\s*\([^)]*\)/gi,
    );
    if (validationFnMatch) {
      for (const match of validationFnMatch) {
        const fnName = match.match(/function\s+(\w+)/)?.[1] || "unknown";
        if (!this.functionReturnsBoolean(code, fnName)) {
          findings.push({
            type: "critical",
            category: "naming-mismatch",
            code: match,
            intent: `Function "${fnName}" implies validation returning true/false`,
            reality: "This function may not return a boolean",
            explanation: "Callers expect boolean validation results.",
            confidence: 0.85,
            line: this.getLineNumber(code, code.indexOf(match)),
          });
        }
      }
    }

    // Check for async functions without await
    const asyncFnMatches = code.matchAll(
      /async\s+function\s+(\w+)[^{]*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g,
    );
    for (const match of asyncFnMatches) {
      const fnName = match[1];
      const fnBody = match[2];
      if (!/await\s+/.test(fnBody)) {
        findings.push({
          type: "warning",
          category: "async-timing-illusion",
          code: `async function ${fnName}`,
          intent: "Marked async implies asynchronous operations",
          reality: "This async function never awaits anything",
          explanation: "Unnecessary async adds overhead and confusion.",
          confidence: 0.9,
          line: this.getLineNumber(code, match.index || 0),
        });
      }
    }

    // Check for == instead of ===
    const looseEqualityMatch = code.match(/[^=!]={2}[^=]/);
    if (looseEqualityMatch) {
      findings.push({
        type: "warning",
        category: "type-coercion-trap",
        code: looseEqualityMatch[0],
        intent: "Equality comparison",
        reality: "Using == allows type coercion with surprising results",
        explanation: "Use === for predictable comparisons.",
        confidence: 0.9,
        line: this.getLineNumber(code, looseEqualityMatch.index || 0),
      });
    }

    // Check for process.env without fallback
    const envMatches = code.matchAll(/process\.env\.(\w+)(?!\s*\|\||\s*\?\?)/g);
    for (const match of envMatches) {
      findings.push({
        type: "warning",
        category: "dependency-assumption",
        code: match[0],
        intent: "Assumes environment variable always exists",
        reality: "No fallback if env var is missing",
        explanation: 'Use process.env.VAR ?? "default" or validate at startup.',
        confidence: 0.85,
        line: this.getLineNumber(code, match.index || 0),
      });
    }

    // Check for JSON.parse without try-catch
    const jsonParseIndex = code.indexOf("JSON.parse");
    if (jsonParseIndex !== -1) {
      const before = code.substring(
        Math.max(0, jsonParseIndex - 200),
        jsonParseIndex,
      );
      if (!/try\s*\{[^}]*$/.test(before)) {
        findings.push({
          type: "warning",
          category: "error-handling-illusion",
          code: "JSON.parse(...)",
          intent: "Assumes input is always valid JSON",
          reality: "Invalid JSON will throw and crash if uncaught",
          explanation: "Wrap JSON.parse in try-catch.",
          confidence: 0.9,
          line: this.getLineNumber(code, jsonParseIndex),
        });
      }
    }

    // Check for "should never happen" comments
    if (/should\s*n[o']?t\s*(ever\s*)?happen/i.test(code)) {
      const matchIndex = code.search(/should\s*n[o']?t\s*(ever\s*)?happen/i);
      findings.push({
        type: "warning",
        category: "boundary-blindness",
        code: "// should never happen",
        intent: "Comment claims this code path is impossible",
        reality:
          "If it can't happen, the code shouldn't exist. If it can, handle it.",
        explanation:
          '"Should never happen" comments often precede production incidents.',
        confidence: 0.85,
        line: this.getLineNumber(code, matchIndex),
      });
    }

    // Check for TODO/FIXME in code
    const todoMatch = code.match(/\/\/\s*(TODO|FIXME|XXX|HACK):/i);
    if (todoMatch) {
      findings.push({
        type: "suggestion",
        category: "incomplete-implementation",
        code: todoMatch[0],
        intent: "Temporary marker for future work",
        reality: "This may ship to production unfinished",
        explanation: "Resolve TODOs before shipping or track them externally.",
        confidence: 0.7,
        line: this.getLineNumber(code, todoMatch.index || 0),
      });
    }

    // Check for console.log in code
    if (/console\.(log|debug|info)\s*\(/.test(code)) {
      const matchIndex = code.search(/console\.(log|debug|info)\s*\(/);
      findings.push({
        type: "suggestion",
        category: "debug-code",
        code: "console.log(...)",
        intent: "Debug output during development",
        reality: "Debug logs may leak sensitive data in production",
        explanation: "Use a proper logging library with log levels.",
        confidence: 0.6,
        line: this.getLineNumber(code, matchIndex),
      });
    }

    return findings;
  }

  private functionReturnsBoolean(code: string, fnName: string): boolean {
    const fnMatch = code.match(
      new RegExp(`function\\s+${fnName}[^{]*\\{([\\s\\S]*?)\\n\\}`),
    );
    if (!fnMatch) return true; // Assume it's fine if we can't find it
    const body = fnMatch[1];
    return (
      /return\s+(true|false)\s*;/.test(body) ||
      /return\s+[^;]+\s*(===|!==|==|!=|<|>)/.test(body)
    );
  }

  private getLineNumber(code: string, index: number): number {
    return code.substring(0, index).split("\n").length;
  }

  async productionIntegrityCheck(
    projectPath: string,
  ): Promise<ProductionIntegrityResult> {
    try {
      const response = await fetch(`${this.apiEndpoint}/api/reality-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath, mode: "full" }),
      });

      if (response.ok) {
        const result = (await response.json()) as {
          data?: ProductionIntegrityResult;
        };
        if (result.data) {
          return result.data;
        }
      }
    } catch {
      /* fall through to CLI */
    }

    const cli = new CLIService(projectPath);
    const cliResult = await cli.getProductionIntegrity();
    if (cliResult.success && cliResult.data && typeof cliResult.data === "object") {
      const raw = cliResult.data as Record<string, unknown>;
      const flat = this.extractShipPayload(raw);
      return this.mapShipCliToProductionIntegrity(flat);
    }

    return {
      integrity: { score: 0, grade: "—", canShip: false },
      counts: {
        api: { connected: 0, missing: 0 },
        auth: { protected: 0, exposed: 0 },
        secrets: { critical: 0 },
        routes: { deadLinks: 0 },
        mocks: { critical: 0, high: 0 },
      },
    };
  }
}
