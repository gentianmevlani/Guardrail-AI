#!/usr/bin/env node
/**
 * PR Reality Check Script
 * Analyzes changed files in a PR and generates a report with findings
 *
 * Usage: CHANGED_FILES="file1.ts file2.js" node scripts/pr-reality-check.js
 */

const fs = require("fs");
const path = require("path");

const CHANGED_FILES = process.env.CHANGED_FILES || "";

class PRRealityChecker {
  constructor() {
    this.findings = [];
    this.filesAnalyzed = 0;
  }

  async run() {
    console.log("🔮 PR Reality Check starting...\n");

    const files = CHANGED_FILES.split(" ").filter((f) => f.trim());

    if (files.length === 0) {
      console.log("No files to analyze");
      this.saveReport({
        score: 100,
        summary: { critical: 0, warnings: 0, suggestions: 0 },
        filesAnalyzed: 0,
        findings: [],
      });
      return;
    }

    console.log(`Analyzing ${files.length} changed files...\n`);

    for (const file of files) {
      await this.analyzeFile(file);
    }

    const report = this.generateReport();
    this.saveReport(report);
    this.printSummary(report);
  }

  async analyzeFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`⏭️  Skipping ${filePath} (not found)`);
        return;
      }

      const code = fs.readFileSync(filePath, "utf8");
      const fileFindings = this.analyze(code, filePath);

      this.findings.push(...fileFindings);
      this.filesAnalyzed++;

      const icon = fileFindings.length > 0 ? "⚠️" : "✅";
      console.log(`${icon} ${filePath}: ${fileFindings.length} findings`);
    } catch (error) {
      console.error(`❌ Error analyzing ${filePath}:`, error.message);
    }
  }

  analyze(code, fileName) {
    const findings = [];

    // Silent catch blocks
    const silentCatchRegex = /catch\s*\([^)]*\)\s*\{(\s*)\}/g;
    let match;
    while ((match = silentCatchRegex.exec(code)) !== null) {
      findings.push({
        type: "critical",
        category: "silent-failure",
        file: fileName,
        line: this.getLineNumber(code, match.index),
        code: "catch { }",
        intent: "Error handling suggests failures are being managed",
        reality: "Errors are caught but silently ignored",
        explanation:
          "Silent catches hide bugs. Log, rethrow, or handle meaningfully.",
        confidence: 0.95,
      });
    }

    // Validation functions without boolean return
    const validationFnRegex =
      /function\s+(validate|check|verify|is|has|can)\w*\s*\([^)]*\)/gi;
    while ((match = validationFnRegex.exec(code)) !== null) {
      const fnName = match[0].match(/function\s+(\w+)/)?.[1] || "unknown";
      if (!this.functionReturnsBoolean(code, fnName)) {
        findings.push({
          type: "critical",
          category: "naming-mismatch",
          file: fileName,
          line: this.getLineNumber(code, match.index),
          code: match[0],
          intent: `Function "${fnName}" implies validation returning true/false`,
          reality: "This function may not return a boolean",
          explanation: "Callers expect boolean validation results.",
          confidence: 0.85,
        });
      }
    }

    // Async without await
    const asyncFnRegex =
      /async\s+function\s+(\w+)[^{]*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    while ((match = asyncFnRegex.exec(code)) !== null) {
      const fnName = match[1];
      const fnBody = match[2];
      if (!/await\s+/.test(fnBody)) {
        findings.push({
          type: "warning",
          category: "async-timing-illusion",
          file: fileName,
          line: this.getLineNumber(code, match.index),
          code: `async function ${fnName}`,
          intent: "Marked async implies asynchronous operations",
          reality: "This async function never awaits anything",
          explanation: "Unnecessary async adds overhead and confusion.",
          confidence: 0.9,
        });
      }
    }

    // == instead of ===
    const looseEqualityRegex = /[^=!]={2}[^=]/g;
    while ((match = looseEqualityRegex.exec(code)) !== null) {
      findings.push({
        type: "warning",
        category: "type-coercion-trap",
        file: fileName,
        line: this.getLineNumber(code, match.index),
        code: match[0].trim(),
        intent: "Equality comparison",
        reality: "Using == allows type coercion with surprising results",
        explanation: "Use === for predictable comparisons.",
        confidence: 0.9,
      });
    }

    // process.env without fallback
    const envRegex = /process\.env\.(\w+)(?!\s*\|\||\s*\?\?)/g;
    while ((match = envRegex.exec(code)) !== null) {
      findings.push({
        type: "warning",
        category: "dependency-assumption",
        file: fileName,
        line: this.getLineNumber(code, match.index),
        code: match[0],
        intent: "Assumes environment variable always exists",
        reality: "No fallback if env var is missing",
        explanation: 'Use process.env.VAR ?? "default" or validate at startup.',
        confidence: 0.85,
      });
    }

    // JSON.parse without try-catch
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
          file: fileName,
          line: this.getLineNumber(code, jsonParseIndex),
          code: "JSON.parse(...)",
          intent: "Assumes input is always valid JSON",
          reality: "Invalid JSON will throw and crash if uncaught",
          explanation: "Wrap JSON.parse in try-catch.",
          confidence: 0.9,
        });
      }
    }

    // "should never happen" comments
    const shouldNeverRegex = /should\s*n[o']?t\s*(ever\s*)?happen/gi;
    while ((match = shouldNeverRegex.exec(code)) !== null) {
      findings.push({
        type: "warning",
        category: "boundary-blindness",
        file: fileName,
        line: this.getLineNumber(code, match.index),
        code: "// should never happen",
        intent: "Comment claims this code path is impossible",
        reality:
          "If it can't happen, the code shouldn't exist. If it can, handle it.",
        explanation:
          '"Should never happen" comments often precede production incidents.',
        confidence: 0.85,
      });
    }

    // TODO/FIXME markers
    const todoRegex = /\/\/\s*(TODO|FIXME|XXX|HACK):/gi;
    while ((match = todoRegex.exec(code)) !== null) {
      findings.push({
        type: "suggestion",
        category: "incomplete-implementation",
        file: fileName,
        line: this.getLineNumber(code, match.index),
        code: match[0],
        intent: "Temporary marker for future work",
        reality: "This may ship to production unfinished",
        explanation: "Resolve TODOs before shipping or track them externally.",
        confidence: 0.7,
      });
    }

    // console.log statements
    const consoleLogRegex = /console\.(log|debug|info)\s*\(/g;
    while ((match = consoleLogRegex.exec(code)) !== null) {
      findings.push({
        type: "suggestion",
        category: "debug-code",
        file: fileName,
        line: this.getLineNumber(code, match.index),
        code: "console.log(...)",
        intent: "Debug output during development",
        reality: "Debug logs may leak sensitive data in production",
        explanation: "Use a proper logging library with log levels.",
        confidence: 0.6,
      });
    }

    // Hardcoded secrets patterns
    const secretPatterns = [
      /['"]sk-[a-zA-Z0-9]{20,}['"]/g,
      /['"]ghp_[a-zA-Z0-9]{36}['"]/g,
      /password\s*[=:]\s*['"][^'"]+['"]/gi,
      /api[_-]?key\s*[=:]\s*['"][^'"]+['"]/gi,
      /secret\s*[=:]\s*['"][^'"]+['"]/gi,
    ];

    for (const pattern of secretPatterns) {
      while ((match = pattern.exec(code)) !== null) {
        findings.push({
          type: "critical",
          category: "hardcoded-secret",
          file: fileName,
          line: this.getLineNumber(code, match.index),
          code: match[0].substring(0, 20) + "...",
          intent: "Configuration value",
          reality: "Hardcoded secret will be exposed in version control",
          explanation: "Use environment variables or a secrets manager.",
          confidence: 0.95,
        });
      }
    }

    return findings;
  }

  functionReturnsBoolean(code, fnName) {
    const fnMatch = code.match(
      new RegExp(`function\\s+${fnName}[^{]*\\{([\\s\\S]*?)\\n\\}`),
    );
    if (!fnMatch) return true;
    const body = fnMatch[1];
    return (
      /return\s+(true|false)\s*;/.test(body) ||
      /return\s+[^;]+\s*(===|!==|==|!=|<|>)/.test(body)
    );
  }

  getLineNumber(code, index) {
    return code.substring(0, index).split("\n").length;
  }

  generateReport() {
    const critical = this.findings.filter((f) => f.type === "critical").length;
    const warnings = this.findings.filter((f) => f.type === "warning").length;
    const suggestions = this.findings.filter(
      (f) => f.type === "suggestion",
    ).length;

    // Calculate score
    let score = 100;
    for (const finding of this.findings) {
      const penalty =
        finding.confidence *
        (finding.type === "critical" ? 15 : finding.type === "warning" ? 8 : 3);
      score -= penalty;
    }
    score = Math.max(0, Math.round(score));

    return {
      score,
      summary: { critical, warnings, suggestions },
      filesAnalyzed: this.filesAnalyzed,
      findings: this.findings.sort((a, b) => {
        const priority = { critical: 0, warning: 1, suggestion: 2 };
        return priority[a.type] - priority[b.type];
      }),
      timestamp: new Date().toISOString(),
    };
  }

  saveReport(report) {
    const reportDir = ".guardrail";
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(reportDir, "pr-report.json"),
      JSON.stringify(report, null, 2),
    );
  }

  printSummary(report) {
    console.log("\n" + "=".repeat(50));
    console.log("🔮 REALITY CHECK SUMMARY");
    console.log("=".repeat(50));
    console.log(`Score: ${report.score}/100`);
    console.log(`Files analyzed: ${report.filesAnalyzed}`);
    console.log(`Critical: ${report.summary.critical}`);
    console.log(`Warnings: ${report.summary.warnings}`);
    console.log(`Suggestions: ${report.summary.suggestions}`);
    console.log("=".repeat(50));

    if (report.summary.critical > 0) {
      console.log("\n❌ CRITICAL ISSUES FOUND - Review required\n");
      for (const f of report.findings
        .filter((f) => f.type === "critical")
        .slice(0, 5)) {
        console.log(`  • ${f.file}:${f.line} - ${f.category}`);
        console.log(`    ${f.reality}`);
      }
    } else if (report.summary.warnings > 0) {
      console.log("\n⚠️  WARNINGS FOUND - Consider reviewing\n");
    } else {
      console.log("\n✅ No critical issues found!\n");
    }

    console.log("Report saved to .guardrail/pr-report.json");
    console.log("\n--- Context Enhanced by guardrail AI ---\n");
  }
}

// Run
const checker = new PRRealityChecker();
checker.run().catch((error) => {
  console.error("Reality check failed:", error);
  process.exit(1);
});
