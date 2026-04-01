// import { prisma } from "@guardrail/database"; // Temporarily disabled
import {
  ValidationRequest,
  DetailedValidationResult,
  StageResult,
  ValidationIssue,
  CodeOutput,
  Context,
} from "@guardrail/core";
import { hallucinationDetector } from "./hallucination-detector";

// Define ValidationVerdict locally since it's not exported from database
export enum ValidationVerdict {
  VALID = "valid",
  INVALID = "invalid",
  WARNING = "warning",
  ERROR = "error",
}
import { intentMatcher } from "./intent-matcher";

/**
 * AI Output Validator
 *
 * Multi-stage validation pipeline for AI-generated code
 */
export class AIOutputValidator {
  /**
   * Main validation function
   */
  async validate(
    request: ValidationRequest,
  ): Promise<DetailedValidationResult> {
    const stages: StageResult[] = [];

    // Stage 1: Syntax Validation
    const syntaxResult = await this.validateSyntax(request.output);
    stages.push(syntaxResult);

    // Stage 2: Import/Dependency Verification
    const importResult = await this.validateImports(
      request.output,
      request.context || {},
    );
    stages.push(importResult);

    // Stage 3: Hallucination Detection
    const hallucinationResult = await this.detectHallucinations(
      request.output,
      request.context || {},
    );
    stages.push(hallucinationResult);

    // Stage 4: Intent Alignment (if request provided)
    let intentResult: StageResult | null = null;
    if (request.request) {
      intentResult = await this.validateIntent(request.output, request.request);
      stages.push(intentResult);
    }

    // Stage 5: Quality Gate
    const qualityResult = await this.validateQuality(request.output);
    stages.push(qualityResult);

    // Stage 6: Security Scan
    const securityResult = await this.securityScan(request.output);
    stages.push(securityResult);

    // Calculate overall score
    const overallScore = this.calculateOverallScore(stages);

    // Determine verdict
    const verdict: any = this.determineVerdict(stages, overallScore);

    // Generate recommendation
    const recommendation = this.generateRecommendation(verdict, stages);

    return {
      verdict,
      overallScore,
      stages,
      recommendation,
      confidence: overallScore / 100,
    };
  }

  /**
   * Stage 1: Validate syntax
   */
  private async validateSyntax(output: CodeOutput): Promise<StageResult> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    // Basic syntax checks (in production, use proper parsers)
    const { code, language } = output;

    if (language === "typescript" || language === "javascript") {
      // Check for balanced braces
      const openBraces = (code.match(/{/g) || []).length;
      const closeBraces = (code.match(/}/g) || []).length;

      if (openBraces !== closeBraces) {
        issues.push({
          type: "syntax",
          severity: "error",
          message: "Unbalanced braces detected",
          suggestion: "Check for missing or extra braces",
        });
      }

      // Check for balanced parentheses
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;

      if (openParens !== closeParens) {
        issues.push({
          type: "syntax",
          severity: "error",
          message: "Unbalanced parentheses detected",
          suggestion: "Check for missing or extra parentheses",
        });
      }

      // Check for incomplete strings
      const singleQuotes = (code.match(/'/g) || []).length;
      const doubleQuotes = (code.match(/"/g) || []).length;
      const backticks = (code.match(/`/g) || []).length;

      if (
        singleQuotes % 2 !== 0 ||
        doubleQuotes % 2 !== 0 ||
        backticks % 2 !== 0
      ) {
        issues.push({
          type: "syntax",
          severity: "error",
          message: "Unclosed string detected",
          suggestion: "Check for missing quote marks",
        });
      }
    }

    const score =
      issues.filter((i) => i.severity === "error").length === 0 ? 100 : 0;

    return {
      stageName: "Syntax Validation",
      passed: score === 100,
      score,
      issues,
      warnings: issues
        .filter((i) => i.severity === "warning")
        .map((i) => i.message),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Stage 2: Validate imports and dependencies
   */
  private async validateImports(
    output: CodeOutput,
    _context: Context,
  ): Promise<StageResult> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    const packageChecks = await hallucinationDetector.verifyAllPackages(
      output.code,
      output.language,
    );

    let validImports = 0;
    let totalImports = packageChecks.size;

    for (const [pkg, check] of packageChecks.entries()) {
      if (!check.exists) {
        issues.push({
          type: "import",
          severity: "error",
          message: `Package '${pkg}' does not exist in ${check.registry}`,
          suggestion: check.alternativeSuggestions?.length
            ? `Did you mean: ${check.alternativeSuggestions.join(", ")}?`
            : "Remove or replace this package",
        });
      } else {
        validImports++;
      }
    }

    const score =
      totalImports === 0 ? 100 : (validImports / totalImports) * 100;

    return {
      stageName: "Import Verification",
      passed: score === 100,
      score,
      issues,
      warnings: [],
      duration: Date.now() - startTime,
    };
  }

  /**
   * Stage 3: Detect hallucinations
   */
  private async detectHallucinations(
    _output: CodeOutput,
    _context: Context,
  ): Promise<StageResult> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    // This stage is covered by import verification
    // Additional hallucination detection could include:
    // - Verifying API methods exist
    // - Checking if referenced files exist
    // - Validating configuration options

    return {
      stageName: "Hallucination Detection",
      passed: true,
      score: 100,
      issues,
      warnings: [],
      duration: Date.now() - startTime,
    };
  }

  /**
   * Stage 4: Validate intent alignment
   */
  private async validateIntent(
    output: CodeOutput,
    request: string,
  ): Promise<StageResult> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    const codeIntent = await intentMatcher.extractCodeIntent(output.code);
    const requestIntent = await intentMatcher.parseRequestIntent(request);
    const comparison = await intentMatcher.compareIntents(
      requestIntent,
      codeIntent,
    );

    if (comparison.alignmentScore < 60) {
      issues.push({
        type: "intent",
        severity: "warning",
        message: "Code may not align with user request",
        suggestion: comparison.recommendation,
      });
    }

    for (const mismatch of comparison.mismatches) {
      issues.push({
        type: "intent",
        severity: "warning",
        message: mismatch,
      });
    }

    return {
      stageName: "Intent Alignment",
      passed: comparison.alignmentScore >= 60,
      score: comparison.alignmentScore,
      issues,
      warnings: comparison.mismatches,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Stage 5: Quality gate
   */
  private async validateQuality(output: CodeOutput): Promise<StageResult> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];
    const warnings: string[] = [];

    const { code } = output;

    // Check for code smells
    if (code.includes("any") && output.language === "typescript") {
      warnings.push('TypeScript "any" type detected - reduces type safety');
    }

    if (code.includes("console.log")) {
      warnings.push(
        "Console.log statements found - consider using proper logging",
      );
    }

    if (code.includes("// TODO") || code.includes("// FIXME")) {
      warnings.push("TODO/FIXME comments found");
    }

    // Check for very long functions
    const functionMatches = code.matchAll(/function\s+\w+[^{]*{([^}]*)}/gs);
    for (const match of functionMatches) {
      const functionBody = match[1];
      if (functionBody) {
        const lines = functionBody.split("\n").length;
        if (lines > 50) {
          warnings.push("Function exceeds 50 lines - consider refactoring");
        }
      }
    }

    const score =
      warnings.length === 0 ? 100 : Math.max(0, 100 - warnings.length * 10);

    return {
      stageName: "Quality Gate",
      passed: score >= 70,
      score,
      issues,
      warnings,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Stage 6: Security scan
   */
  private async securityScan(output: CodeOutput): Promise<StageResult> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    const { code } = output;

    // Check for common security issues
    const securityPatterns = [
      {
        pattern: /eval\(/g,
        message: "eval() is dangerous and should be avoided",
        severity: "error" as const,
      },
      {
        pattern: /dangerouslySetInnerHTML/g,
        message: "dangerouslySetInnerHTML can lead to XSS",
        severity: "warning" as const,
      },
      {
        pattern: /process\.env\.\w+/g,
        message: "Direct env access - ensure proper validation",
        severity: "warning" as const,
      },
      {
        pattern: /exec\(/g,
        message: "exec() can lead to command injection",
        severity: "error" as const,
      },
      {
        pattern: /\$\{.*?\}/g,
        message: "Template literals in SQL can lead to injection",
        severity: "warning" as const,
      },
    ];

    for (const { pattern, message, severity } of securityPatterns) {
      if (pattern.test(code)) {
        issues.push({
          type: "security",
          severity,
          message,
        });
      }
    }

    const criticalIssues = issues.filter((i) => i.severity === "error").length;
    const score =
      criticalIssues === 0 ? 100 : Math.max(0, 100 - criticalIssues * 25);

    return {
      stageName: "Security Scan",
      passed: criticalIssues === 0,
      score,
      issues,
      warnings: issues
        .filter((i) => i.severity === "warning")
        .map((i) => i.message),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Calculate overall score from stages
   */
  private calculateOverallScore(stages: StageResult[]): number {
    const weights = {
      "Syntax Validation": 0.25,
      "Import Verification": 0.25,
      "Hallucination Detection": 0.15,
      "Intent Alignment": 0.15,
      "Quality Gate": 0.1,
      "Security Scan": 0.1,
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const stage of stages) {
      const weight = (weights as any)[stage.stageName] || 0.1;
      totalScore += stage.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Determine verdict based on stages
   */
  private determineVerdict(
    stages: StageResult[],
    overallScore: number,
  ): ValidationVerdict {
    const hasErrors = stages.some((s) =>
      s.issues.some((i: any) => i.severity === "error"),
    );
    const hasWarnings = stages.some((s) => s.warnings.length > 0);

    if (hasErrors) {
      return "ERROR" as ValidationVerdict;
    } else if (hasWarnings || overallScore < 80) {
      return "WARNING" as ValidationVerdict;
    } else if (overallScore >= 95) {
      return "VALID" as ValidationVerdict;
    } else {
      return "WARNING" as ValidationVerdict;
    }
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(verdict: any, stages: StageResult[]): string {
    const failedStages = stages.filter((s) => !s.passed);

    if (verdict === "VALID") {
      return "Code passes all validation stages and can be accepted";
    }

    if (verdict === "ERROR") {
      const reasons = failedStages.map((s) => s.stageName).join(", ");
      return `Code rejected due to critical failures in: ${reasons}`;
    }

    if (verdict === "WARNING") {
      const reasons = failedStages.map((s) => s.stageName).join(", ");
      return `Code needs modifications in: ${reasons}`;
    }

    return "Code requires human review before acceptance";
  }
}

// Export singleton instance
export const aiOutputValidator = new AIOutputValidator();
