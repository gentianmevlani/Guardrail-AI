/**
 * Autopilot API Routes
 *
 * Endpoints for managing guardrail Autopilot:
 * - Enable/disable autopilot
 * - Get status and activity
 * - Trigger manual scans
 * - Configure notifications
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { autopilotService } from "../services/autopilot-service";
import { pool } from "@guardrail/database";
import { requirePlan } from "../middleware/plan-gating";
import { authMiddleware, AuthenticatedRequest } from "../middleware/fastify-auth";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// Schemas
const enableAutopilotSchema = z.object({
  repositoryId: z.string().uuid(),
  autoFixEnabled: z.boolean().default(true),
  autoPrEnabled: z.boolean().default(true),
  deployBlockingEnabled: z.boolean().default(true),
  weeklyDigestEnabled: z.boolean().default(true),
  slackWebhookUrl: z.string().url().optional(),
  notificationEmail: z.string().email().optional(),
});

const updateConfigSchema = z.object({
  autoFixEnabled: z.boolean().optional(),
  autoPrEnabled: z.boolean().optional(),
  deployBlockingEnabled: z.boolean().optional(),
  weeklyDigestEnabled: z.boolean().optional(),
  slackWebhookUrl: z.string().url().nullable().optional(),
  notificationEmail: z.string().email().nullable().optional(),
});

export async function autopilotRoutes(fastify: FastifyInstance) {
  // Add auth middleware
  fastify.addHook("preHandler", async (request, reply) => {
    await authMiddleware(request as AuthenticatedRequest, reply);
  });

  /**
   * Enable autopilot for a repository
   * POST /api/autopilot/enable
   * Requires: Pro tier or higher
   */
  fastify.post(
    "/enable",
    {
      preHandler: requirePlan({ minTierLevel: 2, featureName: "Autopilot" }),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const parsed = enableAutopilotSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: "Invalid request", details: parsed.error.issues });
        }

        const { repositoryId, ...config } = parsed.data;

        // Verify user owns the repository
        const repoResult = await pool.query(
          `SELECT id FROM repositories WHERE id = $1 AND user_id = $2`,
          [repositoryId, userId],
        );

        if (repoResult.rows.length === 0) {
          return reply
            .status(404)
            .send({ error: "Repository not found or access denied" });
        }

        await autopilotService.enableAutopilot({
          repositoryId,
          userId,
          enabled: true,
          ...config,
        } as any);

        return reply.send({
          success: true,
          message: "Autopilot enabled! Your repo is now protected 24/7.",
          repositoryId,
        });
      } catch (error: unknown) {
        fastify.log.error(
          { error: toErrorMessage(error) },
          "Failed to enable autopilot",
        );
        return reply.status(500).send({ error: "Failed to enable autopilot" });
      }
    },
  );

  /**
   * Disable autopilot for a repository
   * POST /api/autopilot/disable
   */
  fastify.post(
    "/disable",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { repositoryId } = request.body as { repositoryId: string };

        // Verify user owns the repository
        const repoResult = await pool.query(
          `SELECT id FROM repositories WHERE id = $1 AND user_id = $2`,
          [repositoryId, userId],
        );

        if (repoResult.rows.length === 0) {
          return reply
            .status(404)
            .send({ error: "Repository not found or access denied" });
        }

        await autopilotService.disableAutopilot(repositoryId);

        return reply.send({
          success: true,
          message:
            "Autopilot disabled. Your repo will no longer be monitored automatically.",
          repositoryId,
        });
      } catch (error: unknown) {
        fastify.log.error(
          { error: toErrorMessage(error) },
          "Failed to disable autopilot",
        );
        return reply.status(500).send({ error: "Failed to disable autopilot" });
      }
    },
  );

  /**
   * Get autopilot status for a repository
   * GET /api/autopilot/status/:repositoryId
   */
  fastify.get(
    "/status/:repositoryId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        const { repositoryId } = request.params as { repositoryId: string };

        // Verify user owns the repository (or it's public)
        const repoResult = await pool.query(
          `SELECT id, full_name, name FROM repositories 
         WHERE id = $1 AND (user_id = $2 OR is_public = true)`,
          [repositoryId, userId],
        );

        if (repoResult.rows.length === 0) {
          return reply
            .status(404)
            .send({ error: "Repository not found or access denied" });
        }

        const status = await autopilotService.getAutopilotStatus(repositoryId);

        return reply.send({
          repository: repoResult.rows[0],
          autopilot: status,
        });
      } catch (error: unknown) {
        fastify.log.error(
          { error: toErrorMessage(error) },
          "Failed to get autopilot status",
        );
        return reply.status(500).send({ error: "Failed to get status" });
      }
    },
  );

  /**
   * Update autopilot configuration
   * PATCH /api/autopilot/config/:repositoryId
   */
  fastify.patch(
    "/config/:repositoryId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { repositoryId } = request.params as { repositoryId: string };

        const parsed = updateConfigSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: "Invalid request", details: parsed.error.issues });
        }

        // Verify user owns the repository
        const repoResult = await pool.query(
          `SELECT id FROM repositories WHERE id = $1 AND user_id = $2`,
          [repositoryId, userId],
        );

        if (repoResult.rows.length === 0) {
          return reply
            .status(404)
            .send({ error: "Repository not found or access denied" });
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(parsed.data)) {
          if (value !== undefined) {
            const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
            updates.push(`${dbKey} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
          }
        }

        if (updates.length > 0) {
          updates.push(`updated_at = NOW()`);
          values.push(repositoryId);

          await pool.query(
            `UPDATE autopilot_configs SET ${updates.join(", ")} WHERE repository_id = $${paramIndex}`,
            values,
          );
        }

        return reply.send({
          success: true,
          message: "Autopilot configuration updated",
        });
      } catch (error: unknown) {
        fastify.log.error({ error: toErrorMessage(error) }, "Failed to update config");
        return reply
          .status(500)
          .send({ error: "Failed to update configuration" });
      }
    },
  );

  /**
   * Trigger a manual scan
   * POST /api/autopilot/scan/:repositoryId
   */
  fastify.post(
    "/scan/:repositoryId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const { repositoryId } = request.params as { repositoryId: string };

        // Verify user owns the repository
        const repoResult = await pool.query(
          `SELECT id, full_name FROM repositories WHERE id = $1 AND user_id = $2`,
          [repositoryId, userId],
        );

        if (repoResult.rows.length === 0) {
          return reply
            .status(404)
            .send({ error: "Repository not found or access denied" });
        }

        // Run scan
        const result = await autopilotService.runScan(repositoryId);

        return reply.send({
          success: true,
          message: "Scan completed",
          result: {
            score: result.score,
            problemCount: result.problems.length,
            warningCount: result.warnings.length,
            timestamp: result.timestamp,
          },
        });
      } catch (error: unknown) {
        fastify.log.error({ error: toErrorMessage(error) }, "Failed to run scan");
        return reply.status(500).send({ error: "Failed to run scan" });
      }
    },
  );

  /**
   * Get activity feed for a repository
   * GET /api/autopilot/activity/:repositoryId
   */
  fastify.get(
    "/activity/:repositoryId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        const { repositoryId } = request.params as { repositoryId: string };
        const { limit = "20", offset = "0" } = request.query as {
          limit?: string;
          offset?: string;
        };

        // Verify access
        const repoResult = await pool.query(
          `SELECT id FROM repositories 
         WHERE id = $1 AND (user_id = $2 OR is_public = true)`,
          [repositoryId, userId],
        );

        if (repoResult.rows.length === 0) {
          return reply
            .status(404)
            .send({ error: "Repository not found or access denied" });
        }

        const activityResult = await pool.query(
          `SELECT * FROM autopilot_activity 
         WHERE repository_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
          [repositoryId, parseInt(limit), parseInt(offset)],
        );

        // Format activity for display
        const activity = activityResult.rows.map((row: any) => ({
          id: row.id,
          type: row.action_type,
          timestamp: row.created_at,
          details: row.details,
          plainEnglish: formatActivityPlainEnglish(
            row.action_type,
            row.details,
          ),
        }));

        return reply.send({ activity });
      } catch (error: unknown) {
        fastify.log.error({ error: toErrorMessage(error) }, "Failed to get activity");
        return reply.status(500).send({ error: "Failed to get activity" });
      }
    },
  );

  /**
   * Get weekly digest preview
   * GET /api/autopilot/digest/:repositoryId
   */
  fastify.get(
    "/digest/:repositoryId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        const { repositoryId } = request.params as { repositoryId: string };

        // Verify access
        const repoResult = await pool.query(
          `SELECT id FROM repositories 
         WHERE id = $1 AND (user_id = $2 OR is_public = true)`,
          [repositoryId, userId],
        );

        if (repoResult.rows.length === 0) {
          return reply
            .status(404)
            .send({ error: "Repository not found or access denied" });
        }

        const digest =
          await autopilotService.generateWeeklyDigest(repositoryId);
        const email = autopilotService.formatDigestEmail(digest);

        return reply.send({
          digest,
          emailPreview: {
            subject: email.subject,
            htmlPreview: email.html.substring(0, 500) + "...",
          },
        });
      } catch (error: unknown) {
        fastify.log.error(
          { error: toErrorMessage(error) },
          "Failed to generate digest",
        );
        return reply.status(500).send({ error: "Failed to generate digest" });
      }
    },
  );

  /**
   * Get all autopilot-enabled repos for current user
   * GET /api/autopilot/repos
   */
  fastify.get(
    "/repos",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request as any).user?.id;
        if (!userId) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        const result = await pool.query(
          `SELECT r.id, r.full_name, r.name, ac.enabled, ac.auto_fix_enabled, 
                ac.deploy_blocking_enabled, ac.weekly_digest_enabled,
                (SELECT score FROM runs WHERE repository_id = r.id ORDER BY created_at DESC LIMIT 1) as last_score,
                (SELECT created_at FROM runs WHERE repository_id = r.id ORDER BY created_at DESC LIMIT 1) as last_scan
         FROM repositories r
         LEFT JOIN autopilot_configs ac ON ac.repository_id = r.id
         WHERE r.user_id = $1
         ORDER BY ac.enabled DESC NULLS LAST, r.full_name`,
          [userId],
        );

        const repos = result.rows.map((row: any) => ({
          id: row.id,
          fullName: row.full_name,
          name: row.name,
          autopilot: {
            enabled: row.enabled || false,
            autoFixEnabled: row.auto_fix_enabled || false,
            deployBlockingEnabled: row.deploy_blocking_enabled || false,
            weeklyDigestEnabled: row.weekly_digest_enabled || false,
          },
          lastScore: row.last_score,
          lastScan: row.last_scan,
          healthEmoji:
            row.last_score >= 80
              ? "🟢"
              : row.last_score >= 50
                ? "🟡"
                : row.last_score
                  ? "🔴"
                  : "⚪",
        }));

        return reply.send({ repos });
      } catch (error: unknown) {
        fastify.log.error({ error: toErrorMessage(error) }, "Failed to get repos");
        return reply.status(500).send({ error: "Failed to get repositories" });
      }
    },
  );
}

/**
 * Format activity type to plain English
 */
function formatActivityPlainEnglish(actionType: string, details: any): string {
  switch (actionType) {
    case "scan_completed":
      return `Scanned your code - Score: ${details?.score || "?"}/100`;
    case "auto_fix_applied":
      return details?.plainEnglish || `Auto-fixed an issue`;
    case "pr_created":
      return `Created a PR to fix ${details?.problemCount || "some"} issue(s)`;
    case "deploy_blocked":
      return `Blocked a deploy that would have broken production`;
    case "digest_sent":
      return `Sent weekly digest email`;
    default:
      return actionType.replace(/_/g, " ");
  }
}
