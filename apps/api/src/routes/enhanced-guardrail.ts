/**
 * Enhanced guardrail API Routes
 *
 * Provides REST API endpoints for:
 * - Enhanced ship decisions
 * - Prompt firewall
 * - Context validation
 * - Long-term tracking
 */

import { createRequire } from "node:module";
import * as path from "node:path";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authMiddleware } from "../middleware/fastify-auth";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";
import {
  contextValidateSchema,
  enhancedShipCheckSchema,
  longTermTrackingReportSchema,
  promptFirewallApplyFixSchema,
  promptFirewallProcessSchema,
  unifiedCheckSchema,
  unifiedReportSchema,
} from "../openapi/ai-guardrails-openapi";

const requireFromHere = createRequire(__filename);

interface ShipDecisionRequest {
  projectPath?: string;
  includeReality?: boolean;
  includeSecurity?: boolean;
  includePerformance?: boolean;
  checkDrift?: boolean;
}

interface PromptFirewallRequest {
  prompt: string;
  projectPath?: string;
  autoBreakdown?: boolean;
  autoVerify?: boolean;
  autoFix?: boolean;
  includeVersionControl?: boolean;
  generatePlan?: boolean;
}

interface ContextValidationRequest {
  projectPath?: string;
  file?: string;
  purpose?: string;
  checkDrift?: boolean;
}

/** Runtime load keeps repo-root context engine out of the TS program graph (avoids rootDir conflicts). */
function loadEnhancedContextEngine(): {
  getValidatedContext: (
    projectPath: string,
    opts: { file?: string; purpose?: string; checkDrift?: boolean },
  ) => Promise<{ validation: unknown; drift: unknown }>;
} {
  const resolved = path.resolve(
    __dirname,
    "../../../../src/lib/context/enhanced-context-engine",
  );
  const mod = requireFromHere(resolved) as {
    enhancedContextEngine: {
      getValidatedContext: (
        projectPath: string,
        opts: { file?: string; purpose?: string; checkDrift?: boolean },
      ) => Promise<{ validation: unknown; drift: unknown }>;
    };
  };
  return mod.enhancedContextEngine;
}

export async function enhancedGuardrailRoutes(fastify: FastifyInstance) {
  // Enhanced Ship Decision endpoint
  fastify.post(
    "/enhanced-ship/check",
    {
      schema: enhancedShipCheckSchema,
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { enhancedShipDecisionEngine } = await import(
          "../../../../packages/core/dist/ship/enhanced-ship-decision"
        );

        const body = request.body as ShipDecisionRequest;
        const projectPath = body.projectPath || process.cwd();
        const decision = await enhancedShipDecisionEngine.decide(projectPath, {
          includeReality: body.includeReality !== false,
          includeSecurity: body.includeSecurity !== false,
          includePerformance: body.includePerformance !== false,
          checkDrift: body.checkDrift !== false,
        });

        return reply.send({
          success: true,
          decision,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? toErrorMessage(error) : "Failed to run enhanced ship decision";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  // Prompt Firewall endpoint
  fastify.post(
    "/prompt-firewall/process",
    {
      schema: promptFirewallProcessSchema,
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { createPromptFirewall } = await import("@guardrail/ai-guardrails");

        const body = request.body as PromptFirewallRequest;
        if (!body.prompt) {
          return reply.status(400).send({
            success: false,
            error: "Prompt is required",
          });
        }

        const projectPath = body.projectPath || process.cwd();
        const firewall = createPromptFirewall(projectPath);

        const result = await firewall.process(body.prompt, {
          autoBreakdown: body.autoBreakdown !== false,
          autoVerify: body.autoVerify !== false,
          autoFix: body.autoFix === true,
          includeVersionControl: body.includeVersionControl !== false,
          generatePlan: body.generatePlan !== false,
        });

        return reply.send({
          success: true,
          result,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? toErrorMessage(error) : "Failed to process prompt through firewall";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  // Apply immediate fix endpoint
  fastify.post(
    "/prompt-firewall/apply-fix",
    {
      schema: promptFirewallApplyFixSchema,
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { createPromptFirewall } = await import("@guardrail/ai-guardrails");

        const body = request.body as { fix: unknown; projectPath?: string };
        const projectPath = body.projectPath || process.cwd();
        const firewall = createPromptFirewall(projectPath);

        const result = await firewall.applyFix(body.fix as Parameters<typeof firewall.applyFix>[0]);

        return reply.send({
          success: result.success,
          message: result.message,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? toErrorMessage(error) : "Failed to apply fix";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  // Context Validation endpoint
  fastify.post(
    "/context/validate",
    {
      schema: contextValidateSchema,
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const enhancedContextEngine = loadEnhancedContextEngine();

        const body = request.body as ContextValidationRequest;
        const projectPath = body.projectPath || process.cwd();
        const result = await enhancedContextEngine.getValidatedContext(projectPath, {
          file: body.file,
          purpose: body.purpose,
          checkDrift: body.checkDrift !== false,
        });

        return reply.send({
          success: true,
          validation: result.validation,
          drift: result.drift,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? toErrorMessage(error) : "Failed to validate context";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  // Long-term Tracking Report endpoint
  fastify.get(
    "/long-term-tracking/report",
    {
      schema: longTermTrackingReportSchema,
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { createLongTermTracking } = await import(
          "../../../../packages/core/dist/improvements/long-term-tracking"
        );

        const query = request.query as { projectPath?: string };
        const projectPath = query.projectPath || process.cwd();
        const tracking = createLongTermTracking(projectPath);

        const report = await tracking.generateReport();

        return reply.send({
          success: true,
          report,
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? toErrorMessage(error) : "Failed to generate long-term tracking report";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  // Unified guardrail Check endpoint
  fastify.post(
    "/unified/check",
    {
      schema: unifiedCheckSchema,
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { createUnifiedGuardrail } = await import(
          "../../../../packages/core/dist/unified-guardrail"
        );

        const body = request.body as {
          prompt?: string;
          projectPath?: string;
          checkShip?: boolean;
          checkContext?: boolean;
          checkLongTerm?: boolean;
        };
        const projectPath = body.projectPath || process.cwd();
        const guardrail = createUnifiedGuardrail({ projectPath });

        const result = await guardrail.runComprehensiveCheck(body.prompt, {
          checkShip: body.checkShip !== false,
          checkContext: body.checkContext !== false,
          checkLongTerm: body.checkLongTerm !== false,
        });

        return reply.send({
          success: true,
          result,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? toErrorMessage(error) : "Failed to run unified guardrail check";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );

  // Generate comprehensive report endpoint
  fastify.post(
    "/unified/report",
    {
      schema: unifiedReportSchema,
      preHandler: [authMiddleware],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { createUnifiedGuardrail } = await import(
          "../../../../packages/core/dist/unified-guardrail"
        );

        const body = request.body as { prompt?: string; projectPath?: string };
        const projectPath = body.projectPath || process.cwd();
        const guardrail = createUnifiedGuardrail({ projectPath });

        const report = await guardrail.generateReport(body.prompt);

        return reply.send({
          success: true,
          report,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? toErrorMessage(error) : "Failed to generate report";
        return reply.status(500).send({
          success: false,
          error: message,
        });
      }
    },
  );
}
