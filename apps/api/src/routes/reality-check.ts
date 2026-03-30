import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requirePlan } from "../middleware/plan-gating";
import { authMiddleware, AuthenticatedRequest } from "../middleware/fastify-auth";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// Inline Reality Check implementation for API
// This is a simplified version - the full service is in src/lib/reality-check-service.ts

interface RealityCheckResult {
  file: string;
  timestamp: string;
  overallScore: number;
  findings: RealityFinding[];
  summary: {
    critical: number;
    warnings: number;
    suggestions: number;
  };
}

interface RealityFinding {
  type: "critical" | "warning" | "suggestion";
  category: string;
  line?: number;
  code: string;
  intent: string;
  reality: string;
  explanation: string;
  confidence: number;
}

class RealityCheckAPI {
  async check(
    code: string,
    file: string = "unknown",
  ): Promise<RealityCheckResult> {
    const findings: RealityFinding[] = [];

    // Check for silent catch blocks
    if (this.hasSilentCatch(code)) {
      findings.push({
        type: "critical",
        category: "silent-failure",
        code: "catch block",
        intent: "Error handling suggests failures are being managed",
        reality: "Errors are caught but silently ignored",
        explanation:
          "Silent catches hide bugs. Log, rethrow, or handle meaningfully.",
        confidence: 0.95,
      });
    }

    // Check for validation functions that don't return boolean
    const validationFns =
      code.match(
        /function\s+(validate|check|verify|is|has|can)\w*\s*\([^)]*\)/gi,
      ) || [];
    for (const fn of validationFns) {
      const fnName = fn.match(/function\s+(\w+)/)?.[1] || "unknown";
      if (!this.returnsBoolean(code, fnName)) {
        findings.push({
          type: "critical",
          category: "naming-mismatch",
          code: fn,
          intent: `Function "${fnName}" implies validation returning true/false`,
          reality: "This function does not return a boolean",
          explanation: "Callers expect boolean validation results.",
          confidence: 0.85,
        });
      }
    }

    // Check for async functions without await
    const asyncFns = code.match(/async\s+function\s+\w+/g) || [];
    for (const fn of asyncFns) {
      const fnName = fn.match(/async\s+function\s+(\w+)/)?.[1] || "";
      if (fnName && !this.hasAwaitInFunction(code, fnName)) {
        findings.push({
          type: "warning",
          category: "async-timing-illusion",
          code: fn,
          intent: "Marked async implies asynchronous operations",
          reality: "This async function never awaits anything",
          explanation: "Unnecessary async adds overhead and confusion.",
          confidence: 0.9,
        });
      }
    }

    // Check for == instead of ===
    const looseEquality = code.match(/[^=!]={2}[^=]/g) || [];
    if (looseEquality.length > 0 && looseEquality[0]) {
      findings.push({
        type: "warning",
        category: "type-coercion-trap",
        code: looseEquality[0] as string,
        intent: "Equality comparison",
        reality: "Using == allows type coercion with surprising results",
        explanation: "Use === for predictable comparisons.",
        confidence: 0.9,
      });
    }

    // Check for process.env without fallback
    const envAccess =
      code.match(/process\.env\.(\w+)(?!\s*\|\||\s*\?\?)/g) || [];
    for (const env of envAccess) {
      findings.push({
        type: "warning",
        category: "dependency-assumption",
        code: env,
        intent: "Assumes environment variable always exists",
        reality: "No fallback if env var is missing",
        explanation: 'Use process.env.VAR ?? "default" or validate at startup.',
        confidence: 0.85,
      });
    }

    // Check for JSON.parse without try-catch
    if (
      /JSON\.parse\s*\(/.test(code) &&
      !this.isWrappedInTryCatch(code, "JSON.parse")
    ) {
      findings.push({
        type: "warning",
        category: "error-handling-illusion",
        code: "JSON.parse(...)",
        intent: "Assumes input is always valid JSON",
        reality: "Invalid JSON will throw and crash if uncaught",
        explanation: "Wrap JSON.parse in try-catch.",
        confidence: 0.9,
      });
    }

    // Check for "should never happen" comments
    if (/should\s*n[o']?t\s*(ever\s*)?happen/i.test(code)) {
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
      });
    }

    const score = this.calculateScore(findings);

    return {
      file,
      timestamp: new Date().toISOString(),
      overallScore: score,
      findings: findings.sort((a, b) => {
        const priority = { critical: 0, warning: 1, suggestion: 2 };
        return priority[a.type] - priority[b.type];
      }),
      summary: {
        critical: findings.filter((f) => f.type === "critical").length,
        warnings: findings.filter((f) => f.type === "warning").length,
        suggestions: findings.filter((f) => f.type === "suggestion").length,
      },
    };
  }

  private hasSilentCatch(code: string): boolean {
    const catchMatch = code.match(/catch\s*\([^)]*\)\s*\{([^}]*)\}/);
    if (!catchMatch) return false;
    const catchBody = catchMatch[1].trim();
    return (
      catchBody === "" ||
      /^\s*\/\//.test(catchBody) ||
      /^\s*console\.(log|warn)\s*\(/.test(catchBody)
    );
  }

  private returnsBoolean(code: string, fnName: string): boolean {
    const fnMatch = code.match(
      new RegExp(`function\\s+${fnName}[^{]*\\{([\\s\\S]*?)\\n\\}`),
    );
    if (!fnMatch) return false;
    const body = fnMatch[1];
    return (
      /return\s+(true|false)\s*;/.test(body) ||
      /return\s+[^;]+\s*(===|!==|==|!=|<|>)/.test(body)
    );
  }

  private hasAwaitInFunction(code: string, fnName: string): boolean {
    const fnMatch = code.match(
      new RegExp(`async\\s+function\\s+${fnName}[^{]*\\{([\\s\\S]*?)\\n\\}`),
    );
    if (!fnMatch) return true; // Can't find function, assume it's fine
    return /await\s+/.test(fnMatch[1]);
  }

  private isWrappedInTryCatch(code: string, pattern: string): boolean {
    const index = code.indexOf(pattern);
    if (index === -1) return false;
    const before = code.substring(Math.max(0, index - 200), index);
    return /try\s*\{[^}]*$/.test(before);
  }

  private calculateScore(findings: RealityFinding[]): number {
    let score = 100;
    for (const finding of findings) {
      const penalty =
        finding.confidence *
        (finding.type === "critical" ? 15 : finding.type === "warning" ? 8 : 3);
      score -= penalty;
    }
    return Math.max(0, Math.round(score));
  }
}

const realityCheck = new RealityCheckAPI();

interface RealityCheckBody {
  code: string;
  file?: string;
}

interface RealityCheckFileParams {
  projectId: string;
  filePath: string;
}

/**
 * Reality Check Routes
 * "Explain My Code Like I'm Lying to Myself" - Self-deception detector
 */
export async function realityCheckRoutes(fastify: FastifyInstance) {
  // Add auth middleware
  fastify.addHook("preHandler", async (request, reply) => {
    await authMiddleware(request as AuthenticatedRequest, reply);
  });

  /**
   * POST /api/reality-check
   * Analyze code for self-deception - where code doesn't do what you think it does
   * Requires: Starter tier or higher
   */
  fastify.post<{ Body: RealityCheckBody }>(
    "/",
    {
      preHandler: requirePlan({ minTierLevel: 1, featureName: "Reality Check" }),
      schema: {
        description:
          "Reality Check - Detects where your code doesn't do what you think it does",
        tags: ["Reality Check"],
        body: {
          type: "object",
          required: ["code"],
          properties: {
            code: {
              type: "string",
              description: "Code content to analyze",
            },
            file: {
              type: "string",
              description: "Optional file name for context",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  file: { type: "string" },
                  timestamp: { type: "string" },
                  overallScore: { type: "number" },
                  summary: {
                    type: "object",
                    properties: {
                      critical: { type: "number" },
                      warnings: { type: "number" },
                      suggestions: { type: "number" },
                    },
                  },
                  findings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        category: { type: "string" },
                        line: { type: "number" },
                        code: { type: "string" },
                        intent: { type: "string" },
                        reality: { type: "string" },
                        explanation: { type: "string" },
                        confidence: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: RealityCheckBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { code, file } = request.body;

        if (!code || code.trim().length === 0) {
          return reply.status(400).send({
            success: false,
            error: "Code content is required",
          });
        }

        const result = await realityCheck.check(code, file || "inline-code");

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error: unknown) {
        request.log.error({ error: toErrorMessage(error) }, "Reality check failed");
        return reply.status(500).send({
          success: false,
          error: "Reality check failed",
          message: toErrorMessage(error),
        });
      }
    },
  );

  /**
   * POST /api/reality-check/deep
   * Deep Reality Check - Cross-file analysis, call graph tracing, async lifecycle analysis
   * Requires: Pro tier or higher
   */
  fastify.post<{
    Body: RealityCheckBody & {
      includeCallGraph?: boolean;
      includeAsyncAnalysis?: boolean;
    };
  }>(
    "/deep",
    {
      preHandler: requirePlan({ minTierLevel: 2, featureName: "Deep Reality Check" }),
      schema: {
        description:
          "Deep Reality Check (Pro) - Enhanced analysis with call graph and async lifecycle tracking",
        tags: ["Reality Check"],
        body: {
          type: "object",
          required: ["code"],
          properties: {
            code: {
              type: "string",
              description: "Code content to analyze",
            },
            file: {
              type: "string",
              description: "File name for context",
            },
            includeCallGraph: {
              type: "boolean",
              description: "Include call graph analysis",
              default: true,
            },
            includeAsyncAnalysis: {
              type: "boolean",
              description: "Include async/await lifecycle analysis",
              default: true,
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: RealityCheckBody & {
          includeCallGraph?: boolean;
          includeAsyncAnalysis?: boolean;
        };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const {
          code,
          file,
          includeCallGraph = true,
          includeAsyncAnalysis = true,
        } = request.body;

        if (!code || code.trim().length === 0) {
          return reply.status(400).send({
            success: false,
            error: "Code content is required",
          });
        }

        // Run basic reality check
        const basicResult = await realityCheck.check(
          code,
          file || "inline-code",
        );

        // Deep analysis additions
        const deepResult: any = {
          ...basicResult,
          deep: {
            callGraph: null,
            asyncAnalysis: null,
          },
        };

        if (includeCallGraph) {
          const imports =
            code.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];
          const calls = code.match(/\b(\w+)\s*\(/g) || [];
          deepResult.deep.callGraph = {
            imports: imports.length,
            functionCalls: [...new Set(calls)].length,
            dependencies: imports
              .map((i: string) => {
                const match = i.match(/from\s+['"]([^'"]+)['"]/);
                return match ? match[1] : null;
              })
              .filter(Boolean),
          };
        }

        if (includeAsyncAnalysis) {
          const asyncFns = (code.match(/async\s+function|\basync\s*\(/g) || [])
            .length;
          const awaits = (code.match(/\bawait\s+/g) || []).length;
          const promises = (
            code.match(/new\s+Promise|\.then\(|\.catch\(/g) || []
          ).length;

          deepResult.deep.asyncAnalysis = {
            asyncFunctions: asyncFns,
            awaitExpressions: awaits,
            promisePatterns: promises,
            warnings: [],
          };

          if (asyncFns > 0 && awaits === 0) {
            deepResult.deep.asyncAnalysis.warnings.push(
              "Found async functions with no awaits - these may not need to be async",
            );
          }

          if (promises > 0 && asyncFns === 0) {
            deepResult.deep.asyncAnalysis.warnings.push(
              "Using Promise patterns without async/await - consider modernizing",
            );
          }
        }

        return reply.send({
          success: true,
          data: deepResult,
        });
      } catch (error: unknown) {
        request.log.error(
          { error: toErrorMessage(error) },
          "Deep reality check failed",
        );
        return reply.status(500).send({
          success: false,
          error: "Deep reality check failed",
          message: toErrorMessage(error),
        });
      }
    },
  );

  /**
   * GET /api/reality-check/categories
   * Get list of all detection categories
   */
  fastify.get(
    "/categories",
    {
      schema: {
        description: "Get list of all reality check detection categories",
        tags: ["Reality Check"],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              categories: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    description: { type: "string" },
                    severity: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const categories = [
        {
          id: "naming-mismatch",
          name: "Naming Mismatch",
          description:
            "Function/variable name implies behavior that doesn't match implementation",
          severity: "critical",
        },
        {
          id: "error-handling-illusion",
          name: "Error Handling Illusion",
          description:
            "Code looks safe but doesn't actually handle errors properly",
          severity: "critical",
        },
        {
          id: "scope-assumption",
          name: "Scope Assumption",
          description:
            "Assumes code runs once but actually runs multiple times, or vice versa",
          severity: "warning",
        },
        {
          id: "stale-comment",
          name: "Stale Comment",
          description: "Comment no longer matches the code it describes",
          severity: "suggestion",
        },
        {
          id: "silent-failure",
          name: "Silent Failure",
          description: "Errors are caught but silently ignored",
          severity: "critical",
        },
        {
          id: "type-coercion-trap",
          name: "Type Coercion Trap",
          description:
            "Implicit type conversions that cause unexpected behavior",
          severity: "warning",
        },
        {
          id: "async-timing-illusion",
          name: "Async Timing Illusion",
          description:
            "Assumes synchronous execution but code is async, or vice versa",
          severity: "warning",
        },
        {
          id: "boundary-blindness",
          name: "Boundary Blindness",
          description:
            "Doesn't handle edge cases like empty arrays, null values",
          severity: "suggestion",
        },
        {
          id: "mutation-surprise",
          name: "Mutation Surprise",
          description: "Modifies data unexpectedly",
          severity: "warning",
        },
        {
          id: "return-path-gap",
          name: "Return Path Gap",
          description: "Missing return paths or inconsistent return types",
          severity: "warning",
        },
        {
          id: "condition-inversion",
          name: "Condition Inversion",
          description: "Logic is opposite of what the name suggests",
          severity: "critical",
        },
        {
          id: "dependency-assumption",
          name: "Dependency Assumption",
          description:
            "Assumes something about external data that may not be true",
          severity: "warning",
        },
      ];

      return reply.send({
        success: true,
        categories,
      });
    },
  );
}
