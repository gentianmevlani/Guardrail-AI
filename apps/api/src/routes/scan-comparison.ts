// @ts-nocheck — Finding diff helpers use loosely typed scan payloads.
/**
 * Scan Comparison Routes
 * 
 * Allows users to compare scan results across time, branches, or different scans
 * to track improvements and identify regressions.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@guardrail/database";
import { authMiddleware } from "../middleware/fastify-auth";
import { logger } from "../logger";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * Compare two scans
 * GET /api/v1/scans/:scanId1/compare/:scanId2
 */
export async function scanComparisonRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/:scanId1/compare/:scanId2",
    {
      preHandler: [authMiddleware],
      schema: {
        params: {
          type: "object",
          required: ["scanId1", "scanId2"],
          properties: {
            scanId1: { type: "string", format: "uuid" },
            scanId2: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({
          success: false,
          error: "Authentication required",
        });
      }

      const { scanId1, scanId2 } = request.params as {
        scanId1: string;
        scanId2: string;
      };

      try {
        // Verify user owns both scans
        const [scan1, scan2] = await Promise.all([
          prisma.scan.findFirst({
            where: {
              id: scanId1,
              userId: user.id,
            },
            include: {
              findings: true,
            },
          }),
          prisma.scan.findFirst({
            where: {
              id: scanId2,
              userId: user.id,
            },
            include: {
              findings: true,
            },
          }),
        ]);

        if (!scan1 || !scan2) {
          return reply.status(404).send({
            success: false,
            error: "One or both scans not found",
          });
        }

        // Compare findings
        const findings1 = scan1.findings;
        const findings2 = scan2.findings;

        // Group findings by deduplication key or file+line+type
        const groupFinding = (f: any) =>
          `${f.file}:${f.line}:${f.type}:${f.message}`;

        const findings1Map = new Map<string, typeof findings1[0]>();
        const findings2Map = new Map<string, typeof findings2[0]>();

        findings1.forEach((f) => {
          const key = groupFinding(f);
          if (!findings1Map.has(key)) {
            findings1Map.set(key, f);
          }
        });

        findings2.forEach((f) => {
          const key = groupFinding(f);
          if (!findings2Map.has(key)) {
            findings2Map.set(key, f);
          }
        });

        // Categorize findings
        const newFindings = findings2.filter(
          (f) => !findings1Map.has(groupFinding(f))
        );
        const fixedFindings = findings1.filter(
          (f) => !findings2Map.has(groupFinding(f))
        );
        const unchangedFindings = findings1.filter((f) =>
          findings2Map.has(groupFinding(f))
        );

        // Calculate metrics
        const metrics = {
          scan1: {
            total: findings1.length,
            critical: findings1.filter((f) => f.severity === "critical").length,
            high: findings1.filter((f) => f.severity === "high").length,
            score: scan1.score || 0,
          },
          scan2: {
            total: findings2.length,
            critical: findings2.filter((f) => f.severity === "critical").length,
            high: findings2.filter((f) => f.severity === "high").length,
            score: scan2.score || 0,
          },
          diff: {
            new: newFindings.length,
            fixed: fixedFindings.length,
            unchanged: unchangedFindings.length,
            scoreDelta: (scan2.score || 0) - (scan1.score || 0),
            totalDelta: findings2.length - findings1.length,
          },
        };

        // Generate trend data
        const trend = {
          improving: metrics.diff.scoreDelta > 0 && metrics.diff.fixed > metrics.diff.new,
          regressing: metrics.diff.scoreDelta < 0 || metrics.diff.new > metrics.diff.fixed,
          stable: metrics.diff.scoreDelta === 0 && metrics.diff.new === 0 && metrics.diff.fixed === 0,
        };

        return reply.send({
          success: true,
          data: {
            scan1: {
              id: scan1.id,
              createdAt: scan1.createdAt,
              score: scan1.score,
              verdict: scan1.verdict,
              metrics: metrics.scan1,
            },
            scan2: {
              id: scan2.id,
              createdAt: scan2.createdAt,
              score: scan2.score,
              verdict: scan2.verdict,
              metrics: metrics.scan2,
            },
            comparison: {
              metrics,
              trend,
              findings: {
                new: newFindings.map((f) => ({
                  id: f.id,
                  type: f.type,
                  severity: f.severity,
                  file: f.file,
                  line: f.line,
                  message: f.message,
                })),
                fixed: fixedFindings.map((f) => ({
                  id: f.id,
                  type: f.type,
                  severity: f.severity,
                  file: f.file,
                  line: f.line,
                  message: f.message,
                })),
                unchanged: unchangedFindings.length,
              },
            },
          },
        });
      } catch (error: unknown) {
        logger.error(
          {
            error: toErrorMessage(error),
            userId: user.id,
            scanId1,
            scanId2,
          },
          "Failed to compare scans",
        );
        return reply.status(500).send({
          success: false,
          error: "Failed to compare scans",
        });
      }
    },
  );
}
