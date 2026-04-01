/**
 * WebSocket Plugin for Fastify
 *
 * Integrates WebSocket server with Fastify for real-time features
 */

import { FastifyInstance } from "fastify";
import { WebSocketServer } from "ws";
import { enhancedWebSocketService } from "../services/websocket-service";
import { realtimeEventsService } from "../services/realtime-events";
import { verifyToken } from "../middleware/fastify-auth";
import { logger } from "../logger";

interface WebSocketPluginOptions {
  path?: string;
}

/**
 * WebSocket plugin for Fastify
 */
export async function websocketPlugin(
  fastify: FastifyInstance,
  options: WebSocketPluginOptions = {},
) {
  const wsPath = options.path || "/ws";

  // Create WebSocket server attached to Fastify's HTTP server
  const wss = new WebSocketServer({
    noServer: true, // We'll handle upgrade manually
  });

  // Initialize enhanced websocket service with Fastify's server
  enhancedWebSocketService.initialize(fastify.server);

  // WebSocket connection handler
  wss.on("connection", async (ws: any, request: any) => {
    fastify.log.info("WebSocket client connected");

    // Handle authentication token from query params or Authorization header
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    const token =
      url.searchParams.get("token") ||
      request.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      fastify.log.warn("WebSocket connection without token");
      ws.close(1008, "Authentication required");
      return;
    }

    // Verify token using JWT verification
    try {
      const decoded = verifyToken(token);
      const userId = decoded.id;
      const userEmail = decoded.email;

      // Fetch user's tenant/organization from database for multi-tenant isolation
      let tenantId: string | undefined;
      try {
        const { prisma } = await import("@guardrail/database");
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true, tenantId: true },
        });
        tenantId = user?.organizationId || user?.tenantId || undefined;
      } catch (dbError) {
        fastify.log.warn({ userId, error: dbError }, "Failed to fetch tenant ID, continuing without tenant scoping");
      }

      // Associate user and tenant with WebSocket
      (ws as any).userId = userId;
      (ws as any).userEmail = userEmail;
      (ws as any).tenantId = tenantId;

      // Register connection with realtime events service (includes tenant scoping)
      realtimeEventsService.registerConnection(ws, userId, tenantId);

      fastify.log.info(
        { userId, email: userEmail, tenantId: tenantId || 'none' },
        "WebSocket authenticated and registered with tenant scoping",
      );
    } catch (error: unknown) {
      fastify.log.error({ error }, "WebSocket authentication failed");
      ws.close(1008, "Authentication failed");
      return;
    }

    // Handle incoming messages
    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleWebSocketMessage(ws, message, fastify);
      } catch (error: unknown) {
        const errMsg =
          error instanceof Error ? error.message : String(error);
        fastify.log.error(
          { error: errMsg },
          "Invalid WebSocket message",
        );
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid message format",
          }),
        );
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      fastify.log.info("WebSocket client disconnected");
      // The enhanced service will handle disconnection automatically
    });

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "connected",
        message: "Connected to guardrail WebSocket",
        timestamp: new Date().toISOString(),
      }),
    );
  });

  // Mount WebSocket server to Fastify
  fastify.server.on("upgrade", (request: any, socket: any, head: any) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    if (url.pathname === wsPath) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  // Decorate Fastify instance with WebSocket utilities
  fastify.decorate("websocket", {
    broadcast: (type: string, data: any, room?: string) => {
      enhancedWebSocketService.broadcast({ type, data, room });
    },
    sendToUser: (userId: string, type: string, data: any) => {
      // Send to user's room (simplified implementation)
      enhancedWebSocketService.broadcast({ type, data, room: userId });
    },
    getConnectedUsers: () => {
      // Return array of users from all active rooms
      const rooms = enhancedWebSocketService.getActiveRooms();
      const users = rooms.flatMap((room) => room.users);
      return [...new Set(users)];
    },
    sendGlobalNotification: (
      type: "info" | "warning" | "error" | "success",
      title: string,
      message: string,
    ) => {
      enhancedWebSocketService.sendGlobalNotification({ type, title, message });
    },
  });

  fastify.log.info(`WebSocket server initialized at path: ${wsPath}`);
}

/**
 * Handle incoming WebSocket messages
 */
function handleWebSocketMessage(
  ws: any,
  message: any,
  fastify: FastifyInstance,
) {
  const { type } = message;
  const userId = (ws as any).userId;

  if (!userId) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Not authenticated",
      }),
    );
    return;
  }

  switch (type) {
    case "subscribe":
      // Subscribe to a run/scan for realtime updates
      if (message.runId) {
        const subscribed = realtimeEventsService.subscribe(
          ws,
          message.runId,
          userId,
        );
        if (!subscribed) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Failed to subscribe to run",
              runId: message.runId,
            }),
          );
        }
      }
      break;

    case "unsubscribe":
      // Unsubscribe from a run/scan
      if (message.runId) {
        realtimeEventsService.unsubscribe(ws, message.runId);
        ws.send(
          JSON.stringify({
            type: "unsubscribed",
            runId: message.runId,
            timestamp: new Date().toISOString(),
          }),
        );
      }
      break;

    case "join-room":
      if (message.room) {
        // Send join message to enhanced service
        ws.send(
          JSON.stringify({
            type: "joined-room",
            room: message.room,
          }),
        );
      }
      break;

    case "leave-room":
      if (message.room) {
        ws.send(
          JSON.stringify({
            type: "left-room",
            room: message.room,
          }),
        );
      }
      break;

    case "cursor-position":
      // Forward to enhanced WebSocket service
      if (ws.userId && message.room) {
        enhancedWebSocketService.handleMessage(ws, {
          type: "cursor",
          roomId: message.room,
          userId: ws.userId,
          payload: message,
        });
      }
      break;

    case "code-edit":
      // Forward to enhanced WebSocket service
      if (ws.userId && message.room) {
        enhancedWebSocketService.handleMessage(ws, {
          type: "edit",
          roomId: message.room,
          userId: ws.userId,
          payload: message,
        });
      }
      break;

    case "typing":
      // Forward to enhanced WebSocket service
      if (ws.userId && message.room) {
        enhancedWebSocketService.handleMessage(ws, {
          type: message.isTyping !== false ? "typing_start" : "typing_stop",
          roomId: message.room,
          userId: ws.userId,
          payload: message,
        });
      }
      break;

    case "activity":
      // Forward to enhanced WebSocket service
      if (ws.userId && message.room) {
        enhancedWebSocketService.handleMessage(ws, {
          type: "comment",
          roomId: message.room,
          userId: ws.userId,
          payload: message,
        });
      }
      break;

    default:
      fastify.log.warn(`Unknown WebSocket message type: ${type}`);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Unknown message type",
        }),
      );
  }
}

// Export types for TypeScript
export type { WebSocketPluginOptions };
