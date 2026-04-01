/**
 * Server-Sent Events (SSE) Routes for Real-time Dashboard Streaming
 *
 * Provides real-time updates to the frontend dashboard without requiring
 * WebSocket connections. SSE is simpler and works over standard HTTP.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@guardrail/database";
import { toErrorMessage } from "../utils/toErrorMessage";

interface StreamClient {
  id: string;
  userId?: string;
  reply: FastifyReply;
  channels: Set<string>;
  lastPing: number;
}

const clients = new Map<string, StreamClient>();

// Cleanup interval for stale connections
setInterval(() => {
  const now = Date.now();
  for (const [id, client] of clients) {
    if (now - client.lastPing > 60000) {
      clients.delete(id);
    }
  }
}, 30000);

/**
 * Broadcast message to all connected clients on a specific channel
 */
export function broadcastToChannel(channel: string, event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of clients.values()) {
    if (client.channels.has(channel) || client.channels.has("*")) {
      try {
        client.reply.raw.write(message);
      } catch {
        clients.delete(client.id);
      }
    }
  }
}

/**
 * Broadcast message to a specific user
 */
export function broadcastToUser(userId: string, event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of clients.values()) {
    if (client.userId === userId) {
      try {
        client.reply.raw.write(message);
      } catch {
        clients.delete(client.id);
      }
    }
  }
}

/**
 * Broadcast message to all connected clients
 */
export function broadcastGlobal(event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  for (const client of clients.values()) {
    try {
      client.reply.raw.write(message);
    } catch {
      clients.delete(client.id);
    }
  }
}

export async function streamingRoutes(fastify: FastifyInstance) {
  /**
   * SSE endpoint for dashboard updates
   */
  fastify.get(
    "/dashboard",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { channels?: string };
      const channels = query.channels?.split(",") || ["dashboard"];

      // Set SSE headers
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no",
      });

      const clientId = `sse-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const client: StreamClient = {
        id: clientId,
        userId: (request as any).user?.id,
        reply,
        channels: new Set(channels),
        lastPing: Date.now(),
      };

      clients.set(clientId, client);

      // Send initial connection message
      reply.raw.write(
        `event: connected\ndata: ${JSON.stringify({ clientId, channels })}\n\n`,
      );

      // Send initial dashboard data
      try {
        const summaryData = await getDashboardSummary(fastify);
        reply.raw.write(
          `event: dashboard-summary\ndata: ${JSON.stringify(summaryData)}\n\n`,
        );
      } catch (error: unknown) {
        fastify.log.error(
          { error: toErrorMessage(error) },
          "Failed to send initial dashboard data",
        );
      }

      // Keep-alive ping every 15 seconds
      const pingInterval = setInterval(() => {
        try {
          client.lastPing = Date.now();
          reply.raw.write(
            `event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`,
          );
        } catch {
          clearInterval(pingInterval);
          clients.delete(clientId);
        }
      }, 15000);

      // Handle client disconnect
      request.raw.on("close", () => {
        clearInterval(pingInterval);
        clients.delete(clientId);
        fastify.log.info(`SSE client disconnected: ${clientId}`);
      });

      // Don't close the response - keep it open for SSE
      return reply;
    },
  );

  /**
   * SSE endpoint for activity feed
   */
  fastify.get(
    "/activity",
    async (request: FastifyRequest, reply: FastifyReply) => {
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no",
      });

      const clientId = `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const client: StreamClient = {
        id: clientId,
        userId: (request as any).user?.id,
        reply,
        channels: new Set(["activity"]),
        lastPing: Date.now(),
      };

      clients.set(clientId, client);

      // Send initial activity data
      try {
        const activityData = await getRecentActivity(10);
        reply.raw.write(
          `event: activity-initial\ndata: ${JSON.stringify(activityData)}\n\n`,
        );
      } catch (error: unknown) {
        fastify.log.error(
          { error: toErrorMessage(error) },
          "Failed to send initial activity data",
        );
      }

      // Keep-alive ping
      const pingInterval = setInterval(() => {
        try {
          client.lastPing = Date.now();
          reply.raw.write(
            `event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`,
          );
        } catch {
          clearInterval(pingInterval);
          clients.delete(clientId);
        }
      }, 15000);

      request.raw.on("close", () => {
        clearInterval(pingInterval);
        clients.delete(clientId);
      });

      return reply;
    },
  );

  /**
   * SSE endpoint for scan progress
   */
  fastify.get(
    "/scan/:scanId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { scanId } = request.params as { scanId: string };

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "X-Accel-Buffering": "no",
      });

      const clientId = `scan-${scanId}-${Date.now()}`;
      const client: StreamClient = {
        id: clientId,
        userId: (request as any).user?.id,
        reply,
        channels: new Set([`scan-${scanId}`]),
        lastPing: Date.now(),
      };

      clients.set(clientId, client);

      reply.raw.write(
        `event: connected\ndata: ${JSON.stringify({ scanId, status: "listening" })}\n\n`,
      );

      const pingInterval = setInterval(() => {
        try {
          client.lastPing = Date.now();
          reply.raw.write(
            `event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`,
          );
        } catch {
          clearInterval(pingInterval);
          clients.delete(clientId);
        }
      }, 15000);

      request.raw.on("close", () => {
        clearInterval(pingInterval);
        clients.delete(clientId);
      });

      return reply;
    },
  );

  /**
   * Get connected SSE clients count (for monitoring)
   */
  fastify.get(
    "/clients",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const clientList = Array.from(clients.values()).map((c) => ({
        id: c.id,
        channels: Array.from(c.channels),
        connectedAt: c.lastPing,
      }));

      return reply.send({
        success: true,
        data: {
          count: clients.size,
          clients: clientList,
        },
      });
    },
  );
}

/**
 * Helper to get dashboard summary data
 */
async function getDashboardSummary(fastify: FastifyInstance) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  let projectCount = 0;
  let alertsCount = 0;
  let criticalCount = 0;
  let highCount = 0;
  let totalScans = 0;

  try {
    projectCount = await prisma.project.count();
  } catch (error: unknown) {
    fastify.log.warn(
      { error: toErrorMessage(error) },
      "Failed to count projects for streaming stats",
    );
  }

  try {
    alertsCount = await prisma.alert.count();
    criticalCount = await prisma.alert.count({
      where: { severity: "critical" },
    });
    highCount = await prisma.alert.count({ where: { severity: "high" } });
  } catch (error: unknown) {
    fastify.log.warn(
      { error: toErrorMessage(error) },
      "Failed to count alerts for streaming stats",
    );
  }

  try {
    totalScans = await prisma.repositoryAnalysis.count();
  } catch (error: unknown) {
    fastify.log.warn(
      { error: toErrorMessage(error) },
      "Failed to count scans for streaming stats",
    );
  }

  const riskScore =
    alertsCount > 0
      ? Math.max(0, 100 - (criticalCount * 25 + highCount * 15))
      : 100;

  return {
    security: {
      riskScore,
      totalFindings: alertsCount,
      criticalCount,
      highCount,
    },
    activity: {
      totalScans,
      activeProjects: projectCount,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper to get recent activity
 */
async function getRecentActivity(limit: number) {
  try {
    const logs = await prisma.auditEvent.findMany({
      take: limit,
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        type: true,
        category: true,
        projectId: true,
        userId: true,
        timestamp: true,
        severity: true,
      },
    });

    return logs.map((log: (typeof logs)[number]) => ({
      id: log.id,
      type: log.type,
      action: log.category,
      resource: log.projectId || log.type || "unknown",
      actor: log.userId || "system",
      timestamp: log.timestamp.toISOString(),
      severity: log.severity,
    }));
  } catch {
    return [];
  }
}

// Export broadcast functions for use by other services
export { clients };
