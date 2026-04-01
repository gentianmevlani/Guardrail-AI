/**
 * AI Intelligence Suite
 *
 * Unified AI-powered code intelligence combining:
 * - Code Review (security, performance, quality, style)
 * - Code Explanation (natural language understanding)
 * - Bug Prediction (ML-based defect prediction)
 * - Pattern Learning (self-improving rules)
 *
 * This is the brain of guardrail - it understands code like a senior engineer.
 */

import * as fs from "fs/promises";
import * as path from "path";
import {
  aiCodeReviewer,
  type CodeReview,
  type ReviewComment,
} from "../ai-code-reviewer";
import { aiCodeExplainer } from "../ai-code-explainer";
import {
  predictiveBugDetector,
  type BugPrediction,
} from "../ai/bug-prediction";
import { aiPatternLearner, type LearningReport } from "../ai-pattern-learner";

// ============================================================================
// TYPES
// ============================================================================

export interface AIAnalysisResult {
  file: string;
  timestamp: string;
  duration: number;

  // Code Review
  review: {
    score: number;
    grade: string;
    comments: ReviewComment[];
    summary: string;
    recommendations: string[];
  };

  // Bug Predictions
  bugs: {
    predictions: BugPrediction[];
    riskScore: number;
    criticalCount: number;
    estimatedImpact: number;
  };

  // Code Explanation
  explanation: {
    summary: string;
    purpose: string;
    complexity: string;
    keyComponents: string[];
  };

  // Combined Intelligence
  intelligence: {
    overallScore: number;
    verdict: "excellent" | "good" | "needs-work" | "critical";
    topIssues: AIIssue[];
    actionItems: ActionItem[];
    learningInsights: string[];
  };
}

export interface AIIssue {
  id: string;
  type: "security" | "bug" | "performance" | "quality" | "style";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  file: string;
  line?: number;
  fixSuggestion: string;
  confidence: number;
  source: "review" | "prediction" | "pattern";
}

export interface ActionItem {
  priority: number;
  action: string;
  reason: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
}

export interface AIIntelligenceConfig {
  enableReview: boolean;
  enableBugPrediction: boolean;
  enableExplanation: boolean;
  enableLearning: boolean;
  strictness: "strict" | "moderate" | "lenient";
  focus?: "all" | "security" | "performance" | "quality";
}

export interface ProjectAnalysis {
  projectPath: string;
  timestamp: string;
  duration: number;
  filesAnalyzed: number;

  // Aggregated scores
  scores: {
    overall: number;
    security: number;
    quality: number;
    performance: number;
    maintainability: number;
  };

  // All issues across files
  issues: AIIssue[];

  // Bug predictions
  bugPredictions: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    topRisks: BugPrediction[];
  };

  // Recommendations
  recommendations: string[];

  // Learning insights
  learning: LearningReport;

  // File-level results
  fileResults: Map<string, AIAnalysisResult>;
}

// ============================================================================
// AI INTELLIGENCE SUITE
// ============================================================================

class AIIntelligenceSuite {
  private defaultConfig: AIIntelligenceConfig = {
    enableReview: true,
    enableBugPrediction: true,
    enableExplanation: true,
    enableLearning: true,
    strictness: "moderate",
    focus: "all",
  };

  /**
   * Analyze a single file with full AI intelligence
   */
  async analyzeFile(
    filePath: string,
    projectPath: string,
    config: Partial<AIIntelligenceConfig> = {},
  ): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    const cfg = { ...this.defaultConfig, ...config };

    console.log(
      `🧠 AI Intelligence analyzing: ${path.relative(projectPath, filePath)}`,
    );

    // Read file
    const code = await fs.readFile(filePath, "utf-8");

    // Run all AI analyses in parallel
    const [reviewResult, bugResult, explanationResult] = await Promise.all([
      cfg.enableReview ? this.runReview(filePath, projectPath, cfg) : null,
      cfg.enableBugPrediction ? this.runBugPrediction(code, filePath) : null,
      cfg.enableExplanation ? this.runExplanation(code, filePath) : null,
    ]);

    // Combine results into unified intelligence
    const intelligence = this.combineIntelligence(
      reviewResult,
      bugResult,
      explanationResult,
      filePath,
    );

    // Record learning event
    if (cfg.enableLearning && intelligence.topIssues.length > 0) {
      await this.recordLearning(intelligence.topIssues, filePath);
    }

    const duration = Date.now() - startTime;

    return {
      file: path.relative(projectPath, filePath),
      timestamp: new Date().toISOString(),
      duration,
      review: reviewResult
        ? {
            score: reviewResult.overallScore,
            grade: this.scoreToGrade(reviewResult.overallScore),
            comments: reviewResult.comments,
            summary: reviewResult.summary,
            recommendations: reviewResult.recommendations,
          }
        : {
            score: 100,
            grade: "A",
            comments: [],
            summary: "Review skipped",
            recommendations: [],
          },
      bugs: bugResult
        ? {
            predictions: bugResult,
            riskScore: this.calculateRiskScore(bugResult),
            criticalCount: bugResult.filter((b) => b.severity === "critical")
              .length,
            estimatedImpact: bugResult.reduce(
              (sum, b) => sum + b.predictedImpact.estimatedCost,
              0,
            ),
          }
        : {
            predictions: [],
            riskScore: 0,
            criticalCount: 0,
            estimatedImpact: 0,
          },
      explanation: explanationResult
        ? {
            summary: explanationResult.summary,
            purpose: explanationResult.purpose,
            complexity: `${explanationResult.howItWorks.length} steps`,
            keyComponents: explanationResult.keyComponents.map((k) => k.name),
          }
        : {
            summary: "Explanation skipped",
            purpose: "Unknown",
            complexity: "Unknown",
            keyComponents: [],
          },
      intelligence,
    };
  }

  /**
   * Analyze entire project
   */
  async analyzeProject(
    projectPath: string,
    config: Partial<AIIntelligenceConfig> = {},
  ): Promise<ProjectAnalysis> {
    const startTime = Date.now();
    const cfg = { ...this.defaultConfig, ...config };

    console.log(`🧠 AI Intelligence analyzing project: ${projectPath}`);

    // Get all source files
    const files = await this.getSourceFiles(projectPath);
    console.log(`📁 Found ${files.length} files to analyze`);

    const fileResults = new Map<string, AIAnalysisResult>();
    const allIssues: AIIssue[] = [];
    const allBugs: BugPrediction[] = [];

    let totalScore = 0;
    let securityScore = 0;
    let qualityScore = 0;
    let performanceScore = 0;

    // Analyze each file
    for (const file of files) {
      try {
        const result = await this.analyzeFile(file, projectPath, cfg);
        fileResults.set(file, result);

        // Collect issues
        allIssues.push(...result.intelligence.topIssues);
        allBugs.push(...result.bugs.predictions);

        // Aggregate scores
        totalScore += result.intelligence.overallScore;
        securityScore += this.calculateCategoryScore(result, "security");
        qualityScore += this.calculateCategoryScore(result, "quality");
        performanceScore += this.calculateCategoryScore(result, "performance");
      } catch (error) {
        console.error(`Error analyzing ${file}:`, error);
      }
    }

    const fileCount = files.length || 1;

    // Get learning report
    const learning = await aiPatternLearner.generateReport();

    // Generate project recommendations
    const recommendations = this.generateProjectRecommendations(
      allIssues,
      allBugs,
    );

    const duration = Date.now() - startTime;

    return {
      projectPath,
      timestamp: new Date().toISOString(),
      duration,
      filesAnalyzed: files.length,
      scores: {
        overall: Math.round(totalScore / fileCount),
        security: Math.round(securityScore / fileCount),
        quality: Math.round(qualityScore / fileCount),
        performance: Math.round(performanceScore / fileCount),
        maintainability: Math.round(
          (qualityScore + performanceScore) / (fileCount * 2),
        ),
      },
      issues: this.prioritizeIssues(allIssues),
      bugPredictions: {
        total: allBugs.length,
        critical: allBugs.filter((b) => b.severity === "critical").length,
        high: allBugs.filter((b) => b.severity === "high").length,
        medium: allBugs.filter((b) => b.severity === "medium").length,
        low: allBugs.filter((b) => b.severity === "low").length,
        topRisks: allBugs
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 10),
      },
      recommendations,
      learning,
      fileResults,
    };
  }

  /**
   * Ask AI a question about code
   */
  async askAboutCode(
    code: string,
    question: string,
    context?: { file?: string; projectPath?: string },
  ): Promise<{
    answer: string;
    confidence: number;
    relatedIssues: AIIssue[];
    suggestions: string[];
  }> {
    const result = await aiCodeExplainer.askAboutCode(code, question, context);

    // Also run quick analysis to find related issues
    const relatedIssues: AIIssue[] = [];

    // Check for security in question
    if (
      question.toLowerCase().includes("security") ||
      question.toLowerCase().includes("safe")
    ) {
      const review = await aiCodeReviewer.review(
        context?.file || "temp.ts",
        context?.projectPath || ".",
        { focus: "security" },
      );

      relatedIssues.push(
        ...review.comments.map((c) =>
          this.reviewCommentToIssue(c, context?.file || ""),
        ),
      );
    }

    return {
      answer: result.answer,
      confidence: result.confidence,
      relatedIssues,
      suggestions: result.suggestions,
    };
  }

  /**
   * Generate fix prompts for AI coding assistants
   */
  async generateFixPrompts(
    analysis: AIAnalysisResult | ProjectAnalysis,
  ): Promise<string[]> {
    const prompts: string[] = [];

    const issues =
      "fileResults" in analysis
        ? analysis.issues
        : analysis.intelligence.topIssues;

    for (const issue of issues.slice(0, 10)) {
      const prompt = this.createFixPrompt(issue);
      prompts.push(prompt);
    }

    return prompts;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async runReview(
    filePath: string,
    projectPath: string,
    config: AIIntelligenceConfig,
  ): Promise<CodeReview> {
    try {
      return await aiCodeReviewer.review(filePath, projectPath, {
        focus: config.focus,
        strictness: config.strictness,
      });
    } catch (error) {
      console.warn(`Review failed for ${filePath}:`, error);
      return {
        file: filePath,
        overallScore: 100,
        comments: [],
        summary: "Review failed",
        recommendations: [],
        timeToReview: 0,
        confidence: 0,
      };
    }
  }

  private async runBugPrediction(
    code: string,
    filePath: string,
  ): Promise<BugPrediction[]> {
    try {
      return await predictiveBugDetector.analyzeCode(code, filePath);
    } catch (error) {
      console.warn(`Bug prediction failed for ${filePath}:`, error);
      return [];
    }
  }

  private async runExplanation(code: string, filePath: string) {
    try {
      return await aiCodeExplainer.explainCode({
        code,
        file: filePath,
        experienceLevel: "intermediate",
      });
    } catch (error) {
      console.warn(`Explanation failed for ${filePath}:`, error);
      return null;
    }
  }

  private combineIntelligence(
    review: CodeReview | null,
    bugs: BugPrediction[] | null,
    explanation: any,
    filePath: string,
  ): AIAnalysisResult["intelligence"] {
    const issues: AIIssue[] = [];

    // Convert review comments to issues
    if (review) {
      for (const comment of review.comments) {
        issues.push(this.reviewCommentToIssue(comment, filePath));
      }
    }

    // Convert bug predictions to issues
    if (bugs) {
      for (const bug of bugs) {
        issues.push(this.bugPredictionToIssue(bug));
      }
    }

    // Calculate overall score
    const reviewScore = review?.overallScore || 100;
    const bugScore = bugs ? Math.max(0, 100 - bugs.length * 10) : 100;
    const overallScore = Math.round((reviewScore + bugScore) / 2);

    // Determine verdict
    const verdict =
      overallScore >= 90
        ? "excellent"
        : overallScore >= 70
          ? "good"
          : overallScore >= 50
            ? "needs-work"
            : "critical";

    // Generate action items
    const actionItems = this.generateActionItems(issues);

    // Generate learning insights
    const learningInsights = this.generateLearningInsights(issues, explanation);

    return {
      overallScore,
      verdict,
      topIssues: this.prioritizeIssues(issues).slice(0, 10),
      actionItems,
      learningInsights,
    };
  }

  private reviewCommentToIssue(comment: ReviewComment, file: string): AIIssue {
    return {
      id: `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type:
        comment.type === "security"
          ? "security"
          : comment.type === "performance"
            ? "performance"
            : comment.type === "bug"
              ? "bug"
              : comment.type === "style"
                ? "style"
                : "quality",
      severity: comment.severity,
      title: comment.message,
      description: comment.suggestion || comment.message,
      file,
      line: comment.line,
      fixSuggestion: comment.suggestion || "Review and fix the issue",
      confidence: comment.confidence,
      source: "review",
    };
  }

  private bugPredictionToIssue(bug: BugPrediction): AIIssue {
    const typeMap: Record<string, AIIssue["type"]> = {
      sql_injection: "security",
      xss: "security",
      csrf: "security",
      authentication_bypass: "security",
      authorization_failure: "security",
      security_vulnerability: "security",
      performance_issue: "performance",
      resource_exhaustion: "performance",
      null_pointer: "bug",
      memory_leak: "bug",
      race_condition: "bug",
      deadlock: "bug",
      infinite_loop: "bug",
      type_error: "bug",
      logic_error: "bug",
    };

    return {
      id: bug.id,
      type: typeMap[bug.bugType] || "bug",
      severity: bug.severity,
      title: `Predicted: ${bug.bugType.replace(/_/g, " ")}`,
      description: bug.description,
      file: bug.filePath,
      line: bug.lineNumber,
      fixSuggestion: bug.fixSuggestion,
      confidence: bug.confidence,
      source: "prediction",
    };
  }

  private generateActionItems(issues: AIIssue[]): ActionItem[] {
    const items: ActionItem[] = [];

    // Group by type and severity
    const critical = issues.filter((i) => i.severity === "critical");
    const security = issues.filter((i) => i.type === "security");
    const performance = issues.filter((i) => i.type === "performance");

    if (critical.length > 0) {
      items.push({
        priority: 1,
        action: `Fix ${critical.length} critical issues immediately`,
        reason: "Critical issues can cause production failures",
        effort: "high",
        impact: "high",
      });
    }

    if (security.length > 0) {
      items.push({
        priority: 2,
        action: `Address ${security.length} security vulnerabilities`,
        reason: "Security issues expose the application to attacks",
        effort: "medium",
        impact: "high",
      });
    }

    if (performance.length > 0) {
      items.push({
        priority: 3,
        action: `Optimize ${performance.length} performance issues`,
        reason: "Performance issues affect user experience",
        effort: "medium",
        impact: "medium",
      });
    }

    return items.sort((a, b) => a.priority - b.priority);
  }

  private generateLearningInsights(
    issues: AIIssue[],
    explanation: any,
  ): string[] {
    const insights: string[] = [];

    // Analyze patterns in issues
    const typeCount = new Map<string, number>();
    for (const issue of issues) {
      typeCount.set(issue.type, (typeCount.get(issue.type) || 0) + 1);
    }

    for (const [type, count] of typeCount.entries()) {
      if (count >= 3) {
        insights.push(
          `Pattern detected: ${count} ${type} issues - consider team training`,
        );
      }
    }

    if (explanation?.complexity === "High") {
      insights.push("Code complexity is high - consider refactoring");
    }

    return insights;
  }

  private prioritizeIssues(issues: AIIssue[]): AIIssue[] {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const typeOrder = {
      security: 0,
      bug: 1,
      performance: 2,
      quality: 3,
      style: 4,
    };

    return issues.sort((a, b) => {
      const severityDiff =
        severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      const typeDiff = typeOrder[a.type] - typeOrder[b.type];
      if (typeDiff !== 0) return typeDiff;

      return b.confidence - a.confidence;
    });
  }

  private calculateRiskScore(bugs: BugPrediction[]): number {
    if (bugs.length === 0) return 0;

    let score = 0;
    for (const bug of bugs) {
      const severityWeight =
        bug.severity === "critical"
          ? 40
          : bug.severity === "high"
            ? 25
            : bug.severity === "medium"
              ? 15
              : 5;
      score += severityWeight * bug.confidence;
    }

    return Math.min(100, score);
  }

  private calculateCategoryScore(
    result: AIAnalysisResult,
    category: string,
  ): number {
    const relevantComments = result.review.comments.filter(
      (c) =>
        (category === "security" && c.type === "security") ||
        (category === "quality" &&
          (c.type === "bug" || c.type === "suggestion")) ||
        (category === "performance" && c.type === "performance"),
    );

    return Math.max(0, 100 - relevantComments.length * 10);
  }

  private generateProjectRecommendations(
    issues: AIIssue[],
    bugs: BugPrediction[],
  ): string[] {
    const recommendations: string[] = [];

    const criticalCount = issues.filter(
      (i) => i.severity === "critical",
    ).length;
    const securityCount = issues.filter((i) => i.type === "security").length;
    const bugCount = bugs.length;

    if (criticalCount > 0) {
      recommendations.push(
        `🔴 ${criticalCount} critical issues require immediate attention`,
      );
    }

    if (securityCount > 5) {
      recommendations.push(
        `🔒 High number of security issues (${securityCount}) - schedule security review`,
      );
    }

    if (bugCount > 10) {
      recommendations.push(
        `🐛 ${bugCount} potential bugs predicted - increase test coverage`,
      );
    }

    if (issues.length > 50) {
      recommendations.push(
        `📊 Technical debt is accumulating - allocate time for refactoring`,
      );
    }

    return recommendations;
  }

  private createFixPrompt(issue: AIIssue): string {
    return `Fix the following ${issue.type} issue in ${issue.file}${issue.line ? ` at line ${issue.line}` : ""}:

**Issue:** ${issue.title}
**Severity:** ${issue.severity}
**Description:** ${issue.description}

**Suggested Fix:** ${issue.fixSuggestion}

Please implement the fix while:
1. Maintaining existing functionality
2. Following the codebase conventions
3. Adding appropriate error handling
4. Including any necessary tests`;
  }

  private async recordLearning(issues: AIIssue[], file: string): Promise<void> {
    for (const issue of issues.slice(0, 5)) {
      await aiPatternLearner.recordEvent({
        type: "correction",
        ruleId: issue.id,
        file,
        context: issue.description,
        userAction: "fixed",
      });
    }
  }

  private scoreToGrade(score: number): string {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }

  private async getSourceFiles(projectPath: string): Promise<string[]> {
    const extensions = [".ts", ".tsx", ".js", ".jsx"];
    const excludedDirs = ["node_modules", ".git", "dist", "build", ".next"];
    const files: string[] = [];

    const walk = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && !excludedDirs.includes(entry.name)) {
            await walk(fullPath);
          } else if (
            entry.isFile() &&
            extensions.some((ext) => entry.name.endsWith(ext))
          ) {
            files.push(fullPath);
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    await walk(projectPath);
    return files.slice(0, 100); // Limit for performance
  }
}

// Export singleton instance
export const aiIntelligenceSuite = new AIIntelligenceSuite();
export default aiIntelligenceSuite;
