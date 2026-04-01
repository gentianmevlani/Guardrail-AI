import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { auditQueryService, auditReporter } from "@guardrail/ai-guardrails";
import { z } from "zod";

// Auth middleware for audit routes
async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply
      .status(401)
      .send({ success: false, error: "Authentication required" });
  }
}

const QuerySchema = z.object({
  agentId: z.string().optional(),
  taskId: z.string().optional(),
  correlationId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  actionType: z.string().optional(),
  status: z.string().optional(),
  riskLevel: z.string().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
});

const ReportSchema = z.object({
  type: z.enum(["audit", "compliance", "security", "attribution"]),
  startDate: z.string(),
  endDate: z.string(),
});

export async function auditRoutes(fastify: FastifyInstance) {
  // Add auth middleware to all audit routes (sensitive data)
  fastify.addHook("preHandler", requireAuth);

  // GET /api/audit/query - Query audit trail
  fastify.get("/query", async (request: FastifyRequest) => {
    const query = QuerySchema.parse(request.query);

    const result = await auditQueryService.query({
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    return result;
  });

  // GET /api/audit/timeline/:taskId - Get task timeline
  fastify.get(
    "/timeline/:taskId",
    async (request: FastifyRequest<{ Params: { taskId: string } }>) => {
      const { taskId } = request.params;

      const timeline = await auditQueryService.getTaskTimeline(taskId);

      return timeline;
    },
  );

  // GET /api/audit/attribution - Get AI vs human stats
  fastify.get(
    "/attribution",
    async (
      request: FastifyRequest<{
        Querystring: { projectId: string; startDate: string; endDate: string };
      }>,
    ) => {
      const { projectId, startDate, endDate } = request.query;

      const attribution = await auditQueryService.getAttribution(projectId, {
        start: new Date(startDate),
        end: new Date(endDate),
      });

      return attribution;
    },
  );

  // POST /api/audit/report - Generate compliance report
  fastify.post("/report", async (request: FastifyRequest) => {
    const body = ReportSchema.parse(request.body);

    const report = await auditReporter.generateReport(body.type, {
      start: new Date(body.startDate),
      end: new Date(body.endDate),
    });

    return report;
  });

  // GET /api/audit/export/csv - Export to CSV
  fastify.get(
    "/export/csv",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = QuerySchema.parse(request.query);

      const csv = await auditReporter.exportCSV({
        ...query,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      });

      reply.header("Content-Type", "text/csv");
      reply.header(
        "Content-Disposition",
        "attachment; filename=audit-export.csv",
      );

      return csv;
    },
  );

  // GET /api/audit/export/json - Export to JSON
  fastify.get("/export/json", async (request: FastifyRequest) => {
    const query = QuerySchema.parse(request.query);

    const json = await auditReporter.exportJSON({
      ...query,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    return json;
  });
}
