/**
 * OpenAPI / @fastify/swagger schema snippets for AI Guardrails routes.
 * Routes are registered under prefixes `/api/validation` and `/api/enhanced-guardrail`.
 */

export const AI_GUARDRAILS_TAG = "AI Guardrails";

export const validationPostValidateSchema = {
  tags: [AI_GUARDRAILS_TAG],
  summary: "Validate AI output",
  description:
    "Multi-stage pipeline: syntax, imports, hallucination detection, intent alignment, quality, and security (see @guardrail/ai-guardrails).",
  body: {
    type: "object",
    required: ["output"],
    properties: {
      agentId: { type: "string" },
      taskId: { type: "string" },
      output: {
        type: "object",
        required: ["code", "language", "outputType"],
        properties: {
          code: { type: "string", description: "Generated source" },
          language: { type: "string" },
          outputType: {
            type: "string",
            enum: ["code", "config", "documentation"],
          },
          metadata: { type: "object", additionalProperties: true },
        },
      },
      context: {
        type: "object",
        properties: {
          projectPath: { type: "string" },
          existingFiles: { type: "array", items: { type: "string" } },
          dependencies: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          framework: { type: "string" },
        },
      },
      request: { type: "string", description: "Original user request for intent checks" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        result: {
          type: "object",
          additionalProperties: true,
          description: "DetailedValidationResult from @guardrail/core",
        },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  },
};

export const validationGetByIdSchema = {
  tags: [AI_GUARDRAILS_TAG],
  summary: "Get stored validation by id",
  description: "Looks up OutputValidation in the database (when persisted).",
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
  response: {
    200: { type: "object", additionalProperties: true },
    404: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
  },
};

export const enhancedShipCheckSchema = {
  tags: [AI_GUARDRAILS_TAG],
  summary: "Enhanced ship decision",
  description: "Ship / review / no-ship using enhanced ship engine (reality, security, performance).",
  body: {
    type: "object",
    properties: {
      projectPath: { type: "string" },
      includeReality: { type: "boolean", default: true },
      includeSecurity: { type: "boolean", default: true },
      includePerformance: { type: "boolean", default: true },
      checkDrift: { type: "boolean", default: true },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        decision: { type: "object", additionalProperties: true },
      },
    },
  },
};

export const promptFirewallProcessSchema = {
  tags: [AI_GUARDRAILS_TAG],
  summary: "Run prompt through advanced firewall",
  description: "Task breakdown, verification, optional VC context — @guardrail/ai-guardrails.",
  body: {
    type: "object",
    required: ["prompt"],
    properties: {
      prompt: { type: "string" },
      projectPath: { type: "string" },
      autoBreakdown: { type: "boolean" },
      autoVerify: { type: "boolean" },
      autoFix: { type: "boolean" },
      includeVersionControl: { type: "boolean" },
      generatePlan: { type: "boolean" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        result: { type: "object", additionalProperties: true },
      },
    },
  },
};

export const promptFirewallApplyFixSchema = {
  tags: [AI_GUARDRAILS_TAG],
  summary: "Apply an immediate fix from the firewall",
  body: {
    type: "object",
    properties: {
      fix: { type: "object", additionalProperties: true },
      projectPath: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
      },
    },
  },
};

export const contextValidateSchema = {
  tags: [AI_GUARDRAILS_TAG],
  summary: "Validate project context (Truth Pack / drift)",
  body: {
    type: "object",
    properties: {
      projectPath: { type: "string" },
      file: { type: "string" },
      purpose: { type: "string" },
      checkDrift: { type: "boolean" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        validation: { type: "object", additionalProperties: true },
        drift: { type: "object", additionalProperties: true },
      },
    },
  },
};

export const longTermTrackingReportSchema = {
  tags: [AI_GUARDRAILS_TAG],
  summary: "Long-term improvement report",
  querystring: {
    type: "object",
    properties: {
      projectPath: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        report: { type: "object", additionalProperties: true },
      },
    },
  },
};

export const unifiedCheckSchema = {
  tags: [AI_GUARDRAILS_TAG],
  summary: "Unified guardrail check",
  description:
    "Ship decision + prompt firewall (if prompt) + context + long-term tracking via @guardrail/core UnifiedGuardrail.",
  body: {
    type: "object",
    properties: {
      prompt: { type: "string" },
      projectPath: { type: "string" },
      checkShip: { type: "boolean" },
      checkContext: { type: "boolean" },
      checkLongTerm: { type: "boolean" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        result: { type: "object", additionalProperties: true },
      },
    },
  },
};

export const unifiedReportSchema = {
  tags: [AI_GUARDRAILS_TAG],
  summary: "Unified guardrail text report",
  body: {
    type: "object",
    properties: {
      prompt: { type: "string" },
      projectPath: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        report: { type: "string" },
      },
    },
  },
};
