/**
 * Findings Routes
 * 
 * Handles bulk operations on findings (acknowledge, suppress, export)
 * Enhanced with caching, deduplication, and improved export formats
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@guardrail/database";
import { authMiddleware } from "../middleware/fastify-auth";
import { logger } from "../logger";
import { cacheService } from "../services/cache-service";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

interface BulkActionRequest {
  action: "acknowledge" | "suppress" | "fixed" | "accepted_risk" | "export";
  findingIds: string[];
  reason?: string;
}

export async function findingsRoutes(fastify: FastifyInstance) {
  /**
   * Bulk actions on findings
   * POST /api/v1/findings/bulk
   */
  fastify.post<{ Body: BulkActionRequest }>(
    "/bulk",
    {
      preHandler: [authMiddleware],
      schema: {
        body: {
          type: "object",
          required: ["action", "findingIds"],
          properties: {
            action: {
              type: "string",
              enum: ["acknowledge", "suppress", "export"],
            },
            findingIds: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: BulkActionRequest }>, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const { action, findingIds } = request.body;

      if (!action || !findingIds || findingIds.length === 0) {
        return reply.status(400).send({
          error: "Action and findingIds are required",
          code: "INVALID_REQUEST",
        });
      }

      // Limit bulk operations to prevent abuse
      if (findingIds.length > 1000) {
        return reply.status(400).send({
          error: "Maximum 1000 findings per bulk operation",
          code: "BULK_LIMIT_EXCEEDED",
        });
      }

      try {
        // Verify user owns these findings
        const findings = await prisma.finding.findMany({
          where: {
            id: { in: findingIds },
            scan: {
              userId: user.id,
            },
          },
          include: {
            scan: {
              select: {
                id: true,
                userId: true,
                repositoryId: true,
              },
            },
          },
        });

        if (findings.length === 0) {
          return reply.status(404).send({
            error: "No findings found or access denied",
            code: "NOT_FOUND",
          });
        }

        if (findings.length !== findingIds.length) {
          // Some findings not found or not owned by user
          const foundIds = findings.map((f: { id: string }) => f.id);
          const notFoundIds = findingIds.filter((id) => !foundIds.includes(id));
          
          logger.warn({
            userId: user.id,
            action,
            notFoundIds,
            totalRequested: findingIds.length,
            totalFound: findings.length,
          }, "Some findings not found in bulk operation");
        }

        switch (action) {
          case "acknowledge":
          case "fixed":
          case "suppress":
          case "accepted_risk":
            const statusMap: Record<string, string> = {
              acknowledge: "acknowledged",
              fixed: "fixed",
              suppress: "suppressed",
              accepted_risk: "accepted_risk",
            };

            await prisma.finding.updateMany({
              where: {
                id: { in: findings.map((f: { id: string }) => f.id) },
              },
              data: {
                status: statusMap[action] || action,
              },
            });

            // Invalidate cache
            await cacheService.invalidate(`findings:user:${user.id}:*`);
            await cacheService.invalidate(`findings:scan:${findings[0]?.scanId}:*`);
            break;

          case "export":
            // Export handled by dedicated endpoint
            return reply.status(400).send({
              error: "Use GET /api/v1/findings/export for export functionality",
              code: "USE_EXPORT_ENDPOINT",
            });
        }

        logger.info({
          userId: user.id,
          action,
          count: findings.length,
        }, "Bulk action performed on findings");

        return reply.send({
          success: true,
          count: findings.length,
          action,
          message: `Successfully ${action === "acknowledge" ? "acknowledged" : action === "suppress" ? "suppressed" : "exported"} ${findings.length} finding(s)`,
        });
      } catch (error: unknown) {
        logger.error(
          {
            error: toErrorMessage(error),
            stack: getErrorStack(error),
            userId: user.id,
            action,
          },
          "Bulk action failed"
        );
        return reply.status(500).send({
          error: "Failed to perform bulk action",
          code: "INTERNAL_ERROR",
        });
      }
    }
  );

  /**
   * Get findings for a scan
   * GET /api/v1/findings?scanId=xxx
   */
  fastify.get(
    "/",
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const { scanId, status, severity, type } = request.query as {
        scanId?: string;
        status?: string;
        severity?: string;
        type?: string;
      };

      if (!scanId) {
        return reply.status(400).send({
          error: "scanId is required",
          code: "INVALID_REQUEST",
        });
      }

      try {
        // Verify user owns the scan
        const scan = await prisma.scan.findFirst({
          where: {
            id: scanId,
            userId: user.id,
          },
        });

        if (!scan) {
          return reply.status(404).send({
            error: "Scan not found or access denied",
            code: "NOT_FOUND",
          });
        }

        // Build where clause
        const where: any = {
          scanId,
        };

        if (status) {
          where.status = status;
        }

        if (severity) {
          where.severity = severity;
        }

        if (type) {
          where.type = type;
        }

        // Try cache first
        const cacheKey = `findings:scan:${scanId}:${JSON.stringify(where)}`;
        const cached = await cacheService.get<any>(cacheKey);
        if (cached) {
          return reply.send({
            success: true,
            data: cached.data,
            count: cached.count,
            cached: true,
          });
        }

        const findings = await prisma.finding.findMany({
          where,
          orderBy: [
            { severity: "asc" }, // critical, high, medium, low
            { line: "asc" },
          ],
        });

        // Cache for 5 minutes
        await cacheService.set(cacheKey, { data: findings, count: findings.length }, 300);

        return reply.send({
          success: true,
          data: findings,
          count: findings.length,
        });
      } catch (error: unknown) {
        logger.error(
          {
            error: toErrorMessage(error),
            userId: user.id,
            scanId,
          },
          "Failed to fetch findings"
        );
        return reply.status(500).send({
          error: "Failed to fetch findings",
          code: "INTERNAL_ERROR",
        });
      }
    }
  );

  /**
   * Export findings as CSV or JSON
   * GET /api/v1/findings/export?format=csv&scanId=xxx&severity=critical
   */
  fastify.get(
    "/export",
    {
      preHandler: [authMiddleware],
      // Query validated in handler; avoid raw Zod in route schema (Fastify 5 JSON Schema compiler)
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      if (!user) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      const query = request.query as {
        format?: "csv" | "json";
        scanId?: string;
        severity?: string;
        status?: string;
        limit?: string;
      };

      const format = query.format || "json";
      const limit = parseInt(query.limit || "10000", 10);

      try {
        // Build where clause
        const where: any = {
          scan: { userId: user.id },
        };

        if (query.scanId) {
          where.scanId = query.scanId;
        }

        if (query.severity && query.severity !== "all") {
          where.severity = query.severity;
        }

        if (query.status && query.status !== "all") {
          where.status = query.status;
        }

        const findings = await prisma.finding.findMany({
          where,
          include: {
            scan: {
              select: {
                id: true,
                projectPath: true,
                branch: true,
                createdAt: true,
              },
            },
          },
          orderBy: [
            { severity: "asc" },
            { file: "asc" },
            { line: "asc" },
          ],
          take: limit,
        });

        if (format === "csv") {
          // Convert to CSV
          const headers = [
            "ID",
            "Type",
            "Severity",
            "Category",
            "File",
            "Line",
            "Column",
            "Title",
            "Message",
            "Status",
            "Confidence",
            "Scan ID",
            "Project Path",
            "Branch",
            "Created At",
          ];

          const rows = findings.map((f: (typeof findings)[number]) => [
            f.id,
            f.type,
            f.severity,
            f.category,
            f.file,
            f.line.toString(),
            (f.column || "").toString(),
            f.title,
            f.message.replace(/"/g, '""'), // Escape quotes
            f.status,
            f.confidence.toString(),
            f.scanId,
            f.scan.projectPath || "",
            f.scan.branch || "",
            f.createdAt.toISOString(),
          ]);

          const csv = [
            headers.join(","),
            ...rows.map((row: (string | number)[]) =>
              row.map((cell: string | number) => `"${cell}"`).join(","),
            ),
          ].join("\n");

          reply.header("Content-Type", "text/csv");
          reply.header(
            "Content-Disposition",
            `attachment; filename="findings-${Date.now()}.csv"`,
          );
          return reply.send(csv);
        } else {
          // JSON format
          return reply.send({
            success: true,
            data: findings.map((f: (typeof findings)[number]) => ({
              id: f.id,
              type: f.type,
              severity: f.severity,
              category: f.category,
              file: f.file,
              line: f.line,
              column: f.column,
              endLine: f.endLine,
              endColumn: f.endColumn,
              title: f.title,
              message: f.message,
              codeSnippet: f.codeSnippet,
              suggestion: f.suggestion,
              confidence: f.confidence,
              status: f.status,
              scanId: f.scanId,
              scan: {
                id: f.scan.id,
                projectPath: f.scan.projectPath,
                branch: f.scan.branch,
                createdAt: f.scan.createdAt,
              },
              createdAt: f.createdAt,
            })),
            count: findings.length,
            exportedAt: new Date().toISOString(),
            format: "json",
          });
        }
      } catch (error: unknown) {
        logger.error(
          {
            error: toErrorMessage(error),
            userId: user.id,
            format,
          },
          "Failed to export findings",
        );
        return reply.status(500).send({
          error: "Failed to export findings",
          code: "INTERNAL_ERROR",
        });
      }
    },
  );
}
