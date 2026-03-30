import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

interface IntegrityFinding {
  id: string;
  category: "api" | "auth" | "secrets" | "routes" | "mocks" | "reality";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  file?: string;
  line?: number;
  code?: string;
  aiAnalysis?: {
    riskExplanation: string;
    attackVectors: string[];
    businessImpact: string;
    suggestedFix: string;
    codeExample?: string;
    confidence: number;
  };
}

interface AIInsights {
  overallAssessment: string;
  topRisks: string[];
  quickWins: string[];
  architecturalConcerns: string[];
  securityPosture: "strong" | "moderate" | "weak" | "critical";
  estimatedFixTime: string;
  prioritizedActions: {
    priority: number;
    action: string;
    reason: string;
    effort: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    findingIds: string[];
  }[];
}

interface ProductionIntegrityReport {
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

export async function productionIntegrityRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/production-integrity/analyze
   * Run full production integrity analysis with AI enhancement
   */
  fastify.post(
    "/analyze",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const {
        code,
        projectPath,
        auditResults,
        enableAI = true,
      } = request.body as {
        code?: string;
        projectPath?: string;
        auditResults?: unknown;
        enableAI?: boolean;
      };

      try {
        const openaiApiKey = process.env.OPENAI_API_KEY;

        // If audit results provided, use them directly
        let results = auditResults;

        // If code provided, run inline analysis
        if (code && !results) {
          results = analyzeCodeInline(code);
        }

        if (!results) {
          return reply.status(400).send({
            success: false,
            error: "Either code or auditResults must be provided",
          });
        }

        // Run AI-enhanced analysis
        const report = await runAIAnalysis(results, {
          enableAI: enableAI && !!openaiApiKey,
          openaiApiKey,
        });

        return reply.send({
          success: true,
          data: report,
        });
      } catch (error: unknown) {
        fastify.log.error({ error }, "Production integrity analysis failed");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Analysis failed",
        });
      }
    },
  );

  /**
   * POST /api/production-integrity/fix
   * Get AI-generated fix for a specific finding
   */
  fastify.post("/fix", async (request: FastifyRequest, reply: FastifyReply) => {
    const { finding } = request.body as { finding: IntegrityFinding };

    if (!finding) {
      return reply.status(400).send({
        success: false,
        error: "Finding is required",
      });
    }

    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;

      if (openaiApiKey) {
        const fix = await generateAIFix(finding, openaiApiKey);
        return reply.send({ success: true, data: fix });
      } else {
        const fix = generateLocalFix(finding);
        return reply.send({ success: true, data: fix });
      }
    } catch (error: unknown) {
      return reply.status(500).send({
        success: false,
        error: toErrorMessage(error),
      });
    }
  });

  /**
   * POST /api/production-integrity/explain
   * Get AI explanation for a finding
   */
  fastify.post(
    "/explain",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { finding, context } = request.body as {
        finding: IntegrityFinding;
        context?: string;
      };

      if (!finding) {
        return reply.status(400).send({
          success: false,
          error: "Finding is required",
        });
      }

      try {
        const openaiApiKey = process.env.OPENAI_API_KEY;

        if (openaiApiKey) {
          const explanation = await generateAIExplanation(
            finding,
            context,
            openaiApiKey,
          );
          return reply.send({ success: true, data: explanation });
        } else {
          return reply.send({
            success: true,
            data: {
              explanation: getLocalExplanation(finding),
              attackScenario: "AI explanation requires OpenAI API key",
              complianceImpact: [],
            },
          });
        }
      } catch (error: unknown) {
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error),
        });
      }
    },
  );

  /**
   * GET /api/production-integrity/categories
   * Get available finding categories with descriptions
   */
  fastify.get(
    "/categories",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: {
          categories: [
            {
              id: "api",
              name: "API Wiring",
              description: "Frontend-backend endpoint mismatches",
              severities: ["high", "medium"],
            },
            {
              id: "auth",
              name: "Authentication & Authorization",
              description: "Missing or weak auth on endpoints",
              severities: ["critical", "high", "medium"],
            },
            {
              id: "secrets",
              name: "Secrets & Credentials",
              description: "Hardcoded secrets, leaked API keys",
              severities: ["critical", "high"],
            },
            {
              id: "routes",
              name: "Route Integrity",
              description: "Dead links, orphan pages, navigation issues",
              severities: ["medium", "low"],
            },
            {
              id: "mocks",
              name: "Mock/Test Code",
              description: "Test code, console.logs, mock data in production",
              severities: ["critical", "high", "medium"],
            },
            {
              id: "reality",
              name: "Reality Check",
              description: "Code behavior vs developer intent mismatches",
              severities: ["critical", "high", "medium"],
            },
          ],
        },
      });
    },
  );
}

/**
 * Inline code analysis for simple requests
 */
function analyzeCodeInline(code: string): any {
  const findings: any = {
    auth: { analysis: { adminExposed: [], sensitiveUnprotected: [] } },
    secrets: { secrets: [] },
    mocks: { issues: [], packageIssues: [] },
    realityCheck: { findings: [] },
  };

  // Check for hardcoded secrets
  const secretPatterns = [
    { pattern: /['"]sk-[a-zA-Z0-9]{20,}['"]/, type: "OpenAI API Key" },
    { pattern: /['"]ghp_[a-zA-Z0-9]{36}['"]/, type: "GitHub PAT" },
    { pattern: /password\s*[=:]\s*['"][^'"]+['"]/, type: "Hardcoded Password" },
    {
      pattern: /api[_-]?key\s*[=:]\s*['"][^'"]+['"]/,
      type: "Hardcoded API Key",
    },
    { pattern: /secret\s*[=:]\s*['"][^'"]+['"]/, type: "Hardcoded Secret" },
  ];

  for (const { pattern, type } of secretPatterns) {
    const match = code.match(pattern);
    if (match) {
      findings.secrets.secrets.push({
        type,
        severity: "critical",
        file: "inline",
        line: code.substring(0, match.index).split("\n").length,
        match: match[0].substring(0, 20) + "...",
      });
    }
  }

  // Check for console.log
  const consoleMatches = code.matchAll(/console\.(log|debug|info)\s*\(/g);
  for (const match of consoleMatches) {
    findings.mocks.issues.push({
      name: "console.log",
      severity: "medium",
      file: "inline",
      line: code.substring(0, match.index).split("\n").length,
    });
  }

  // Check for TODO/FIXME
  const todoMatches = code.matchAll(/\/\/\s*(TODO|FIXME|XXX|HACK):/gi);
  for (const match of todoMatches) {
    findings.mocks.issues.push({
      name: match[1].toUpperCase(),
      severity: "low",
      file: "inline",
      line: code.substring(0, match.index).split("\n").length,
      reason: "Incomplete implementation marker",
    });
  }

  // Reality Check patterns
  // Silent catch
  if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(code)) {
    findings.realityCheck.findings.push({
      type: "critical",
      category: "silent-failure",
      intent: "Error handling suggests failures are managed",
      reality: "Errors are caught but silently ignored",
      file: "inline",
    });
  }

  // Async without await
  const asyncMatches = code.matchAll(
    /async\s+function\s+(\w+)[^{]*\{([^}]*)\}/g,
  );
  for (const match of asyncMatches) {
    if (!/await\s+/.test(match[2])) {
      findings.realityCheck.findings.push({
        type: "warning",
        category: "async-timing-illusion",
        intent: `Function ${match[1]} is async`,
        reality: "This async function never awaits anything",
        file: "inline",
      });
    }
  }

  return findings;
}

/**
 * Run AI-enhanced analysis
 */
async function runAIAnalysis(
  auditResults: any,
  config: { enableAI: boolean; openaiApiKey?: string },
): Promise<ProductionIntegrityReport> {
  const findings = convertToFindings(auditResults);
  const score = calculateScore(findings);
  const grade = getGrade(score);

  let aiInsights: AIInsights;

  if (config.enableAI && config.openaiApiKey) {
    aiInsights = await generateAIInsights(findings, config.openaiApiKey);
  } else {
    aiInsights = generateLocalInsights(findings);
  }

  return {
    score,
    grade,
    canShip:
      score >= 70 &&
      findings.filter((f) => f.severity === "critical").length === 0,
    summary: {
      total: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
    },
    findings,
    aiInsights,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Convert audit results to normalized findings
 */
function convertToFindings(results: any): IntegrityFinding[] {
  const findings: IntegrityFinding[] = [];
  let idCounter = 1;

  // Auth findings
  if (results.auth?.analysis) {
    for (const endpoint of results.auth.analysis.adminExposed || []) {
      findings.push({
        id: `auth-${idCounter++}`,
        category: "auth",
        severity: "critical",
        title: "Admin Endpoint Exposed Without Auth",
        description: `${endpoint.method || "GET"} ${endpoint.path} is an admin endpoint without authentication`,
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
        description: `${endpoint.method || "GET"} ${endpoint.path} handles sensitive data without auth`,
        file: endpoint.file,
        line: endpoint.line,
      });
    }
  }

  // Secret findings
  if (results.secrets?.secrets) {
    for (const secret of results.secrets.secrets) {
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

  // Reality Check findings
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
 * Calculate integrity score
 */
function calculateScore(findings: IntegrityFinding[]): number {
  let score = 100;

  for (const finding of findings) {
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
function getGrade(score: number): string {
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
 * Generate AI insights
 */
async function generateAIInsights(
  findings: IntegrityFinding[],
  apiKey: string,
): Promise<AIInsights> {
  const summary = summarizeFindings(findings);

  const prompt = `You are a senior security engineer reviewing a production readiness audit.

FINDINGS:
${summary}

Respond with JSON:
{
  "overallAssessment": "1-2 sentence assessment",
  "topRisks": ["Top 3 risks"],
  "quickWins": ["3-5 easy fixes"],
  "architecturalConcerns": ["Systemic issues"],
  "securityPosture": "strong|moderate|weak|critical",
  "estimatedFixTime": "e.g. '2-4 hours'",
  "prioritizedActions": [{"priority": 1, "action": "...", "reason": "...", "effort": "low", "impact": "high", "findingIds": []}]
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert security auditor. Respond only with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error("AI request failed");
    }

    const data = (await response.json()) as any;
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch {
    return generateLocalInsights(findings);
  }
}

/**
 * Generate local insights without AI
 */
function generateLocalInsights(findings: IntegrityFinding[]): AIInsights {
  const critical = findings.filter((f) => f.severity === "critical");
  const high = findings.filter((f) => f.severity === "high");

  const byCategory = {
    auth: findings.filter((f) => f.category === "auth"),
    secrets: findings.filter((f) => f.category === "secrets"),
    mocks: findings.filter((f) => f.category === "mocks"),
  };

  const topRisks: string[] = [];
  const quickWins: string[] = [];

  if (byCategory.auth.filter((f) => f.severity === "critical").length > 0) {
    topRisks.push(
      "Unauthenticated admin endpoints could allow unauthorized access",
    );
  }
  if (byCategory.secrets.length > 0) {
    topRisks.push("Hardcoded secrets risk credential exposure");
  }
  if (byCategory.mocks.filter((f) => f.severity === "critical").length > 0) {
    topRisks.push("Mock code in production could bypass security controls");
  }

  if (byCategory.mocks.length > 0) {
    quickWins.push("Remove console.log and test imports");
  }
  if (byCategory.secrets.length > 0) {
    quickWins.push("Move hardcoded secrets to environment variables");
  }

  let securityPosture: "strong" | "moderate" | "weak" | "critical" = "moderate";
  if (critical.length > 3) securityPosture = "critical";
  else if (critical.length > 0) securityPosture = "weak";
  else if (high.length === 0) securityPosture = "strong";

  return {
    overallAssessment:
      critical.length > 0
        ? `Found ${critical.length} critical issues requiring immediate attention.`
        : "No critical issues found. Review high-priority items before shipping.",
    topRisks,
    quickWins,
    architecturalConcerns: [],
    securityPosture,
    estimatedFixTime:
      critical.length > 5
        ? "4-8 hours"
        : critical.length > 0
          ? "1-2 hours"
          : "< 1 hour",
    prioritizedActions: [],
  };
}

/**
 * Summarize findings for AI
 */
function summarizeFindings(findings: IntegrityFinding[]): string {
  const lines: string[] = [];
  lines.push(`Total: ${findings.length} findings`);
  lines.push(
    `Critical: ${findings.filter((f) => f.severity === "critical").length}`,
  );
  lines.push(`High: ${findings.filter((f) => f.severity === "high").length}`);
  lines.push("");

  for (const f of findings
    .filter((f) => f.severity === "critical" || f.severity === "high")
    .slice(0, 10)) {
    lines.push(
      `- [${f.severity}] ${f.title}: ${f.description.substring(0, 80)}`,
    );
  }

  return lines.join("\n");
}

/**
 * Generate AI-powered fix
 */
async function generateAIFix(
  finding: IntegrityFinding,
  apiKey: string,
): Promise<{ fix: string; code?: string }> {
  const prompt = `Generate a fix for this security issue:

Category: ${finding.category}
Severity: ${finding.severity}  
Title: ${finding.title}
Description: ${finding.description}
File: ${finding.file || "unknown"}

Respond with JSON: {"fix": "step by step instructions", "code": "example code if applicable"}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) throw new Error("AI request failed");

    const data = (await response.json()) as any;
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch {
    return generateLocalFix(finding);
  }
}

/**
 * Generate local fix without AI
 */
function generateLocalFix(finding: IntegrityFinding): {
  fix: string;
  code?: string;
} {
  const fixes: Record<string, { fix: string; code?: string }> = {
    auth: {
      fix: "1. Add authentication middleware\n2. Verify user permissions\n3. Return 401/403 for unauthorized",
      code: `router.use(requireAuth);\nif (!req.user?.isAdmin) return res.status(403).json({error: 'Forbidden'});`,
    },
    secrets: {
      fix: "1. Remove hardcoded secret\n2. Add to .env file\n3. Use process.env.VAR\n4. Rotate the credential",
      code: `const apiKey = process.env.API_KEY;\nif (!apiKey) throw new Error('API_KEY required');`,
    },
    mocks: {
      fix: "1. Remove mock imports\n2. Move test code to test directories\n3. Remove console.log statements",
    },
  };

  return (
    fixes[finding.category] || {
      fix: "Review and apply appropriate fix for this issue.",
    }
  );
}

/**
 * Generate AI explanation
 */
async function generateAIExplanation(
  finding: IntegrityFinding,
  context: string | undefined,
  apiKey: string,
): Promise<{
  explanation: string;
  attackScenario: string;
  complianceImpact: string[];
}> {
  const prompt = `Explain this security finding for a developer:

Finding: ${finding.title}
Description: ${finding.description}
${context ? `Context: ${context}` : ""}

Respond with JSON:
{
  "explanation": "Plain English explanation of why this matters",
  "attackScenario": "How an attacker could exploit this",
  "complianceImpact": ["Relevant compliance frameworks affected (GDPR, SOC2, etc)"]
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) throw new Error("AI request failed");

    const data = (await response.json()) as any;
    return JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch {
    return {
      explanation: getLocalExplanation(finding),
      attackScenario: "AI explanation requires OpenAI API key",
      complianceImpact: [],
    };
  }
}

/**
 * Get local explanation
 */
function getLocalExplanation(finding: IntegrityFinding): string {
  const explanations: Record<string, string> = {
    auth: "This endpoint lacks authentication, allowing anyone to access it without credentials.",
    secrets:
      "Hardcoded secrets in code can be exposed if the repository is leaked or accessed by unauthorized users.",
    mocks:
      "Test/mock code in production may bypass security controls or return fake data to users.",
    reality:
      "The code behavior does not match what its naming or structure suggests.",
  };

  return (
    explanations[finding.category] ||
    "This finding indicates a potential security or quality issue."
  );
}

export default productionIntegrityRoutes;
