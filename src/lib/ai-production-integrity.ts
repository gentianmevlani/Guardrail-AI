/**
 * AI-Enhanced Production Integrity Service
 *
 * Combines static analysis with LLM-powered insights for:
 * - Intelligent fix suggestions with code examples
 * - Security risk assessment with attack vector analysis
 * - Priority scoring based on business impact
 * - Natural language explanations of complex issues
 * - Pattern-based vulnerability detection
 */

export interface AIAnalysisConfig {
  openaiApiKey?: string;
  model?: string;
  enableAI?: boolean;
  maxTokens?: number;
}

export interface IntegrityFinding {
  id: string;
  category: "api" | "auth" | "secrets" | "routes" | "mocks" | "reality";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  file?: string;
  line?: number;
  code?: string;
  aiAnalysis?: AIFindingAnalysis;
}

export interface AIFindingAnalysis {
  riskExplanation: string;
  attackVectors: string[];
  businessImpact: string;
  suggestedFix: string;
  codeExample?: string;
  relatedFindings?: string[];
  confidence: number;
}

export interface AIProductionReport {
  score: number;
  grade: string;
  canShip: boolean;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  findings: IntegrityFinding[];
  aiInsights: AIInsights;
  timestamp: string;
}

export interface AIInsights {
  overallAssessment: string;
  topRisks: string[];
  quickWins: string[];
  architecturalConcerns: string[];
  securityPosture: "strong" | "moderate" | "weak" | "critical";
  estimatedFixTime: string;
  prioritizedActions: PrioritizedAction[];
}

export interface PrioritizedAction {
  priority: number;
  action: string;
  reason: string;
  effort: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  findingIds: string[];
}

export class AIProductionIntegrityService {
  private config: AIAnalysisConfig;
  private findings: IntegrityFinding[] = [];

  constructor(config: AIAnalysisConfig = {}) {
    this.config = {
      model: "gpt-4o-mini",
      enableAI: true,
      maxTokens: 4000,
      ...config,
    };
  }

  /**
   * Analyze production integrity with AI enhancement
   */
  async analyze(auditResults: any): Promise<AIProductionReport> {
    // Convert audit results to findings
    this.findings = this.convertToFindings(auditResults);

    // Calculate base score
    const score = this.calculateScore();
    const grade = this.getGrade(score);

    // Generate AI insights if enabled
    let aiInsights: AIInsights;
    if (this.config.enableAI && this.config.openaiApiKey) {
      aiInsights = await this.generateAIInsights();

      // Enhance individual findings with AI analysis
      await this.enhanceFindingsWithAI();
    } else {
      aiInsights = this.generateLocalInsights();
    }

    return {
      score,
      grade,
      canShip:
        score >= 70 &&
        this.findings.filter((f) => f.severity === "critical").length === 0,
      summary: {
        total: this.findings.length,
        critical: this.findings.filter((f) => f.severity === "critical").length,
        high: this.findings.filter((f) => f.severity === "high").length,
        medium: this.findings.filter((f) => f.severity === "medium").length,
        low: this.findings.filter((f) => f.severity === "low").length,
      },
      findings: this.findings,
      aiInsights,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Convert raw audit results to normalized findings
   */
  private convertToFindings(results: any): IntegrityFinding[] {
    const findings: IntegrityFinding[] = [];
    let idCounter = 1;

    // API findings
    if (results.api?.missing) {
      for (const item of results.api.missing) {
        findings.push({
          id: `api-${idCounter++}`,
          category: "api",
          severity: "high",
          title: "Missing Backend Endpoint",
          description: `Frontend calls ${item.method} ${item.path} but no backend handler exists`,
          file: item.file,
          code: `${item.method} ${item.path}`,
        });
      }
    }

    // Auth findings
    if (results.auth?.analysis) {
      for (const endpoint of results.auth.analysis.adminExposed || []) {
        findings.push({
          id: `auth-${idCounter++}`,
          category: "auth",
          severity: "critical",
          title: "Admin Endpoint Exposed Without Auth",
          description: `${endpoint.method} ${endpoint.path} is an admin endpoint without authentication`,
          file: endpoint.file,
          line: endpoint.line,
        });
      }

      for (const endpoint of results.auth.analysis.sensitiveUnprotected || []) {
        findings.push({
          id: `auth-${idCounter++}`,
          category: "auth",
          severity: "high",
          title: "Sensitive Endpoint Unprotected",
          description: `${endpoint.method} ${endpoint.path} handles sensitive data without auth`,
          file: endpoint.file,
          line: endpoint.line,
        });
      }
    }

    // Secret findings
    if (results.env?.secrets) {
      for (const secret of results.env.secrets) {
        findings.push({
          id: `secret-${idCounter++}`,
          category: "secrets",
          severity: secret.severity === "critical" ? "critical" : "high",
          title: `Hardcoded ${secret.type}`,
          description: `Found hardcoded ${secret.type} in source code`,
          file: secret.file,
          line: secret.line,
          code: secret.match?.substring(0, 30) + "...",
        });
      }
    }

    // Route findings
    if (results.routes?.integrity) {
      for (const link of results.routes.integrity.deadLinks || []) {
        findings.push({
          id: `route-${idCounter++}`,
          category: "routes",
          severity: "medium",
          title: "Dead Link (404 Risk)",
          description: `Link to ${link.href} has no matching page`,
          file: link.file,
          line: link.line,
        });
      }
    }

    // Mock findings
    if (results.mocks) {
      const allMocks = [
        ...(results.mocks.issues || []),
        ...(results.mocks.packageIssues || []),
      ];
      for (const mock of allMocks) {
        findings.push({
          id: `mock-${idCounter++}`,
          category: "mocks",
          severity:
            mock.severity === "critical"
              ? "critical"
              : mock.severity === "high"
                ? "high"
                : "medium",
          title: `Mock Code: ${mock.name}`,
          description:
            mock.reason ||
            `Found ${mock.name} which may indicate test code in production`,
          file: mock.file,
          line: mock.line,
        });
      }
    }

    // Reality Check findings (if available)
    if (results.realityCheck?.findings) {
      for (const finding of results.realityCheck.findings) {
        findings.push({
          id: `reality-${idCounter++}`,
          category: "reality",
          severity:
            finding.type === "critical"
              ? "critical"
              : finding.type === "warning"
                ? "high"
                : "medium",
          title: finding.category
            .replace(/-/g, " ")
            .replace(/\b\w/g, (l: string) => l.toUpperCase()),
          description: `Intent: ${finding.intent}\nReality: ${finding.reality}`,
          file: finding.file,
          line: finding.line,
          code: finding.code,
        });
      }
    }

    return findings;
  }

  /**
   * Generate AI-powered insights for the overall report
   */
  private async generateAIInsights(): Promise<AIInsights> {
    const findingsSummary = this.summarizeFindingsForAI();

    const prompt = `You are a senior security engineer reviewing a production readiness audit. Analyze these findings and provide actionable insights.

FINDINGS SUMMARY:
${findingsSummary}

Respond with JSON only:
{
  "overallAssessment": "1-2 sentence overall security/production readiness assessment",
  "topRisks": ["Top 3 most critical risks that could cause incidents"],
  "quickWins": ["3-5 low-effort fixes that would significantly improve the score"],
  "architecturalConcerns": ["Any systemic/architectural issues you notice"],
  "securityPosture": "strong|moderate|weak|critical",
  "estimatedFixTime": "Realistic time estimate to fix critical issues (e.g., '2-4 hours', '1-2 days')",
  "prioritizedActions": [
    {
      "priority": 1,
      "action": "Specific action to take",
      "reason": "Why this is important",
      "effort": "low|medium|high",
      "impact": "low|medium|high",
      "findingIds": ["relevant finding IDs"]
    }
  ]
}

Focus on:
1. Security vulnerabilities that could lead to data breaches
2. Issues that would cause production incidents
3. Compliance risks (GDPR, SOC2, etc.)
4. Quick fixes vs. architectural changes needed`;

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert security auditor. Respond only with valid JSON.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: this.config.maxTokens,
            response_format: { type: "json_object" },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("No response from AI");
      }

      return JSON.parse(content);
    } catch (error) {
      console.error("AI insights generation failed:", error);
      return this.generateLocalInsights();
    }
  }

  /**
   * Enhance individual findings with AI analysis
   */
  private async enhanceFindingsWithAI(): Promise<void> {
    // Only enhance critical and high severity findings to save API calls
    const criticalFindings = this.findings
      .filter((f) => f.severity === "critical" || f.severity === "high")
      .slice(0, 10); // Limit to top 10

    const batchPrompt = this.buildBatchAnalysisPrompt(criticalFindings);

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert security engineer providing fix suggestions.",
              },
              { role: "user", content: batchPrompt },
            ],
            temperature: 0.3,
            max_tokens: this.config.maxTokens,
            response_format: { type: "json_object" },
          }),
        },
      );

      if (!response.ok) return;

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) return;

      const analyses = JSON.parse(content).analyses || [];

      for (const analysis of analyses) {
        const finding = this.findings.find((f) => f.id === analysis.id);
        if (finding) {
          finding.aiAnalysis = {
            riskExplanation: analysis.riskExplanation,
            attackVectors: analysis.attackVectors || [],
            businessImpact: analysis.businessImpact,
            suggestedFix: analysis.suggestedFix,
            codeExample: analysis.codeExample,
            confidence: analysis.confidence || 0.85,
          };
        }
      }
    } catch (error) {
      console.error("AI finding enhancement failed:", error);
    }
  }

  /**
   * Build batch analysis prompt for multiple findings
   */
  private buildBatchAnalysisPrompt(findings: IntegrityFinding[]): string {
    const findingsJson = findings.map((f) => ({
      id: f.id,
      category: f.category,
      severity: f.severity,
      title: f.title,
      description: f.description,
      file: f.file,
      code: f.code,
    }));

    return `Analyze these security/production findings and provide fix suggestions:

${JSON.stringify(findingsJson, null, 2)}

For each finding, respond with JSON:
{
  "analyses": [
    {
      "id": "finding-id",
      "riskExplanation": "Plain English explanation of why this is risky",
      "attackVectors": ["How an attacker could exploit this"],
      "businessImpact": "What could go wrong in business terms",
      "suggestedFix": "Step-by-step fix instructions",
      "codeExample": "Code snippet showing the fix (if applicable)",
      "confidence": 0.85
    }
  ]
}

Be specific and actionable. Include real code examples where helpful.`;
  }

  /**
   * Generate local insights without AI
   */
  private generateLocalInsights(): AIInsights {
    const critical = this.findings.filter((f) => f.severity === "critical");
    const high = this.findings.filter((f) => f.severity === "high");

    const topRisks: string[] = [];
    const quickWins: string[] = [];
    const architecturalConcerns: string[] = [];

    // Analyze findings by category
    const byCategory = {
      auth: this.findings.filter((f) => f.category === "auth"),
      secrets: this.findings.filter((f) => f.category === "secrets"),
      api: this.findings.filter((f) => f.category === "api"),
      mocks: this.findings.filter((f) => f.category === "mocks"),
      routes: this.findings.filter((f) => f.category === "routes"),
    };

    if (byCategory.auth.filter((f) => f.severity === "critical").length > 0) {
      topRisks.push(
        "Unauthenticated admin endpoints could allow unauthorized access to sensitive operations",
      );
    }

    if (byCategory.secrets.length > 0) {
      topRisks.push(
        "Hardcoded secrets in source code risk credential exposure if code is leaked",
      );
    }

    if (byCategory.mocks.filter((f) => f.severity === "critical").length > 0) {
      topRisks.push(
        "Mock/test code in production could bypass security controls or return fake data",
      );
    }

    if (byCategory.api.length > 5) {
      architecturalConcerns.push(
        "Multiple missing API endpoints suggest frontend-backend contract drift",
      );
    }

    if (byCategory.auth.length > 3) {
      architecturalConcerns.push(
        "Multiple auth issues suggest missing centralized authentication middleware",
      );
    }

    // Quick wins based on severity and category
    if (byCategory.mocks.length > 0) {
      quickWins.push(
        "Remove console.log statements and test imports from production files",
      );
    }

    if (
      byCategory.routes.filter((f) => f.title.includes("Dead Link")).length > 0
    ) {
      quickWins.push(
        "Fix dead links by adding missing pages or correcting href values",
      );
    }

    if (
      byCategory.secrets.filter((f) => f.description.includes("localhost"))
        .length > 0
    ) {
      quickWins.push(
        "Replace hardcoded localhost URLs with environment variables",
      );
    }

    // Determine security posture
    let securityPosture: "strong" | "moderate" | "weak" | "critical" =
      "moderate";
    if (
      critical.length > 3 ||
      byCategory.auth.filter((f) => f.severity === "critical").length > 0
    ) {
      securityPosture = "critical";
    } else if (critical.length > 0 || high.length > 5) {
      securityPosture = "weak";
    } else if (high.length === 0 && critical.length === 0) {
      securityPosture = "strong";
    }

    // Estimate fix time
    const totalIssues = critical.length * 2 + high.length;
    let estimatedFixTime = "1-2 hours";
    if (totalIssues > 20) estimatedFixTime = "2-3 days";
    else if (totalIssues > 10) estimatedFixTime = "4-8 hours";
    else if (totalIssues > 5) estimatedFixTime = "2-4 hours";

    // Generate prioritized actions
    const prioritizedActions: PrioritizedAction[] = [];
    let priority = 1;

    if (byCategory.auth.filter((f) => f.severity === "critical").length > 0) {
      prioritizedActions.push({
        priority: priority++,
        action: "Add authentication middleware to admin endpoints",
        reason: "Prevents unauthorized access to sensitive operations",
        effort: "medium",
        impact: "high",
        findingIds: byCategory.auth
          .filter((f) => f.severity === "critical")
          .map((f) => f.id),
      });
    }

    if (
      byCategory.secrets.filter((f) => f.severity === "critical").length > 0
    ) {
      prioritizedActions.push({
        priority: priority++,
        action: "Remove hardcoded secrets and rotate credentials",
        reason: "Prevents credential theft if code is exposed",
        effort: "low",
        impact: "high",
        findingIds: byCategory.secrets
          .filter((f) => f.severity === "critical")
          .map((f) => f.id),
      });
    }

    if (byCategory.mocks.filter((f) => f.severity === "critical").length > 0) {
      prioritizedActions.push({
        priority: priority++,
        action: "Remove mock/test code from production files",
        reason: "Ensures real data and security controls are used",
        effort: "low",
        impact: "high",
        findingIds: byCategory.mocks
          .filter((f) => f.severity === "critical")
          .map((f) => f.id),
      });
    }

    return {
      overallAssessment: this.generateOverallAssessment(
        critical.length,
        high.length,
      ),
      topRisks: topRisks.slice(0, 3),
      quickWins: quickWins.slice(0, 5),
      architecturalConcerns,
      securityPosture,
      estimatedFixTime,
      prioritizedActions,
    };
  }

  /**
   * Generate overall assessment text
   */
  private generateOverallAssessment(
    criticalCount: number,
    highCount: number,
  ): string {
    if (criticalCount === 0 && highCount === 0) {
      return "Codebase is in good shape for production. No critical security issues detected.";
    } else if (criticalCount > 3) {
      return `Critical security gaps detected. ${criticalCount} issues require immediate attention before any production deployment.`;
    } else if (criticalCount > 0) {
      return `Found ${criticalCount} critical issue(s) that must be resolved before shipping. Overall security posture needs improvement.`;
    } else {
      return `No critical issues but ${highCount} high-priority items should be addressed soon to maintain security standards.`;
    }
  }

  /**
   * Summarize findings for AI prompt
   */
  private summarizeFindingsForAI(): string {
    const byCategoryAndSeverity: Record<string, Record<string, number>> = {};

    for (const finding of this.findings) {
      if (!byCategoryAndSeverity[finding.category]) {
        byCategoryAndSeverity[finding.category] = {};
      }
      byCategoryAndSeverity[finding.category][finding.severity] =
        (byCategoryAndSeverity[finding.category][finding.severity] || 0) + 1;
    }

    const lines: string[] = [];
    lines.push(`Total findings: ${this.findings.length}`);
    lines.push(
      `Critical: ${this.findings.filter((f) => f.severity === "critical").length}`,
    );
    lines.push(
      `High: ${this.findings.filter((f) => f.severity === "high").length}`,
    );
    lines.push(
      `Medium: ${this.findings.filter((f) => f.severity === "medium").length}`,
    );
    lines.push(
      `Low: ${this.findings.filter((f) => f.severity === "low").length}`,
    );
    lines.push("");
    lines.push("By category:");

    for (const [category, severities] of Object.entries(
      byCategoryAndSeverity,
    )) {
      lines.push(`  ${category}: ${JSON.stringify(severities)}`);
    }

    lines.push("");
    lines.push("Sample critical/high findings:");

    const samples = this.findings
      .filter((f) => f.severity === "critical" || f.severity === "high")
      .slice(0, 10);

    for (const f of samples) {
      lines.push(
        `  - [${f.severity.toUpperCase()}] ${f.title}: ${f.description.substring(0, 100)}`,
      );
    }

    return lines.join("\n");
  }

  /**
   * Calculate integrity score
   */
  private calculateScore(): number {
    let score = 100;

    for (const finding of this.findings) {
      switch (finding.severity) {
        case "critical":
          score -= 15;
          break;
        case "high":
          score -= 8;
          break;
        case "medium":
          score -= 3;
          break;
        case "low":
          score -= 1;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Get letter grade
   */
  private getGrade(score: number): string {
    if (score >= 95) return "A+";
    if (score >= 90) return "A";
    if (score >= 85) return "A-";
    if (score >= 80) return "B+";
    if (score >= 75) return "B";
    if (score >= 70) return "B-";
    if (score >= 65) return "C+";
    if (score >= 60) return "C";
    if (score >= 55) return "C-";
    if (score >= 50) return "D";
    return "F";
  }

  /**
   * Generate AI-powered fix for a specific finding
   */
  async generateFix(
    findingId: string,
  ): Promise<{ fix: string; code?: string } | null> {
    const finding = this.findings.find((f) => f.id === findingId);
    if (!finding) return null;

    if (!this.config.enableAI || !this.config.openaiApiKey) {
      return this.generateLocalFix(finding);
    }

    const prompt = `Generate a specific fix for this security/production issue:

Category: ${finding.category}
Severity: ${finding.severity}
Title: ${finding.title}
Description: ${finding.description}
File: ${finding.file || "unknown"}
Code: ${finding.code || "N/A"}

Provide:
1. Step-by-step instructions to fix this issue
2. A code example showing the fix (if applicable)

Be specific and actionable. Format as JSON:
{
  "fix": "Step by step instructions",
  "code": "// Code example if applicable"
}`;

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert developer providing security fixes.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 1000,
            response_format: { type: "json_object" },
          }),
        },
      );

      if (!response.ok) {
        return this.generateLocalFix(finding);
      }

      const data = await response.json();
      return JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } catch (error) {
      return this.generateLocalFix(finding);
    }
  }

  /**
   * Generate local fix suggestion without AI
   */
  private generateLocalFix(finding: IntegrityFinding): {
    fix: string;
    code?: string;
  } {
    switch (finding.category) {
      case "auth":
        return {
          fix: "1. Add authentication middleware to the route\n2. Check user session/token\n3. Verify required permissions\n4. Return 401/403 for unauthorized access",
          code: `// Add auth middleware
app.use('/admin/*', requireAuth, requireRole('admin'));

// Or for individual routes
router.get('/admin/users', requireAuth, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // ... handler
});`,
        };

      case "secrets":
        return {
          fix: "1. Remove the hardcoded secret from code\n2. Add the variable to .env file\n3. Update code to use process.env\n4. Rotate the exposed credential immediately",
          code: `// Before (bad)
const apiKey = 'sk-abc123...';

// After (good)
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API_KEY environment variable required');
}`,
        };

      case "mocks":
        return {
          fix: "1. Remove mock/test imports from production files\n2. Move test utilities to test directories\n3. Use environment-based conditionals if needed\n4. Verify no test data is returned in production",
          code: `// Remove these from production files
// import { mockData } from './test-utils';
// console.log('debug:', data);

// If conditional behavior needed, use env vars
if (process.env.NODE_ENV === 'test') {
  // test-only code
}`,
        };

      case "api":
        return {
          fix: "1. Create the missing backend endpoint\n2. Implement the expected request/response contract\n3. Add appropriate error handling\n4. Update API documentation",
        };

      case "routes":
        return {
          fix: "1. Create the missing page/route\n2. Or update the link href to point to an existing page\n3. Or add a redirect from the old path to the new one",
        };

      default:
        return {
          fix: "Review the finding and apply appropriate fix based on the specific issue.",
        };
    }
  }
}

export default AIProductionIntegrityService;
