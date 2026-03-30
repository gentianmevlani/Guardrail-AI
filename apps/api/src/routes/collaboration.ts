/**
 * Collaboration Routes
 *
 * REST API endpoints for WebSocket collaboration features
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { enhancedWebSocketService } from "../services/websocket-service";

// Import middleware
import {
  authMiddleware,
  requireRole,
  standardRateLimit,
} from "../middleware/fastify-auth";
import { validateInput, commonSchemas } from "../middleware/validation";
import { asyncHandler, createError } from "../middleware/error-handler";
import { AuthenticatedRequest } from "../middleware/fastify-auth";

// Schemas
const CreateRoomSchema = z.object({
  roomId: z.string(),
  name: z.string(),
  projectId: z.string().optional(),
  settings: z
    .object({
      autoAnalysis: z.boolean().optional(),
      notifyOnJoin: z.boolean().optional(),
      allowAnonymous: z.boolean().optional(),
    })
    .optional(),
});

const JoinRoomSchema = z.object({
  roomId: z.string(),
  userName: z.string(),
  avatar: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

const SendNotificationSchema = z.object({
  type: z.enum(["info", "warning", "error", "success"]),
  title: z.string(),
  message: z.string(),
  userId: z.string().optional(),
  roomId: z.string().optional(),
});

export async function collaborationRoutes(fastify: FastifyInstance) {
  // Add authentication pre-handler for all routes
  fastify.addHook("preHandler", authMiddleware);

  // GET /api/collaboration/rooms - Get active rooms
  fastify.get(
    "/rooms",
    {
      preHandler: [standardRateLimit],
      schema: {
        querystring: { $ref: "pagination" },
      },
    },
    asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const rooms = enhancedWebSocketService.getActiveRooms();
      const stats = enhancedWebSocketService.getStats();

      return {
        rooms,
        stats,
        count: rooms.length,
      };
    }),
  );

  // GET /api/collaboration/rooms/:roomId - Get room details
  fastify.get(
    "/rooms/:roomId",
    {
      preHandler: [standardRateLimit],
      schema: {
        params: { $ref: "uuidParam" },
      },
    },
    asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const { roomId } = request.params as { roomId: string };

      const room = enhancedWebSocketService.getRoomInfo(roomId);
      if (!room) {
        throw createError.notFound("Room not found");
      }

      return room;
    }),
  );

  // POST /api/collaboration/rooms - Create a new room
  fastify.post(
    "/rooms",
    {
      preHandler: [requireRole(["admin", "moderator"]), standardRateLimit],
      schema: {
        body: { $ref: "createRoom" },
      },
    },
    asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const body = request.body as any;

      const room = enhancedWebSocketService.createRoom(
        body.roomId,
        body.name,
        body.settings,
      );

      return reply.status(201).send({
        success: true,
        room,
        message: "Room created successfully",
      });
    }),
  );

  // DELETE /api/collaboration/rooms/:roomId - Delete a room
  fastify.delete(
    "/rooms/:roomId",
    {
      preHandler: [requireRole(["admin"]), standardRateLimit],
      schema: {
        params: { $ref: "uuidParam" },
      },
    },
    asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const { roomId } = request.params as { roomId: string };

      const deleted = enhancedWebSocketService.deleteRoom(roomId);
      if (!deleted) {
        throw createError.notFound("Room not found");
      }

      return {
        success: true,
        message: "Room deleted successfully",
      };
    }),
  );

  // POST /api/collaboration/join - Join a room (returns auth token)
  fastify.post(
    "/join",
    {
      preHandler: [standardRateLimit],
      schema: {
        body: { $ref: "joinRoom" },
      },
    },
    asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const body = request.body as any;
      const user = request.user!;

      // Generate temporary token for WebSocket authentication
      const wsToken = Buffer.from(
        JSON.stringify({
          userId: user.id,
          roomId: body.roomId,
          exp: Date.now() + 3600000, // 1 hour expiry
        }),
      ).toString("base64");

      return {
        success: true,
        wsToken,
        wsUrl: `${process.env.WS_URL}/ws?token=${wsToken}`,
        roomId: body.roomId,
        message: "Use this token to authenticate WebSocket connection",
      };
    }),
  );

  // POST /api/collaboration/notify - Send notification
  fastify.post(
    "/notify",
    {
      preHandler: [requireRole(["admin", "moderator"]), standardRateLimit],
      schema: {
        body: { $ref: "sendNotification" },
      },
    },
    asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const body = request.body as any;

      // Send notification via WebSocket service
      enhancedWebSocketService.sendGlobalNotification({
        type: body.type,
        title: body.title,
        message: body.message,
        roomId: body.roomId,
        userId: body.userId,
      });

      return {
        success: true,
        message: "Notification sent successfully",
      };
    }),
  );

  // GET /api/collaboration/stats - Get collaboration statistics
  fastify.get(
    "/stats",
    {
      preHandler: [requireRole(["admin", "moderator"]), standardRateLimit],
    },
    asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const stats = enhancedWebSocketService.getStats();

      return {
        ...stats,
        timestamp: new Date().toISOString(),
      };
    }),
  );

  // POST /api/collaboration/broadcast - Broadcast message to room
  fastify.post(
    "/broadcast",
    {
      preHandler: [requireRole(["admin", "moderator"]), standardRateLimit],
      // Schema validation handled by handler
    },
    asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const body = request.body as any;

      enhancedWebSocketService.broadcast({
        type: body.type,
        data: body.data,
        roomId: body.roomId,
      });

      return {
        success: true,
        message: "Message broadcasted successfully",
      };
    }),
  );

  // GET /api/collaboration/activity/:roomId - Get room activity feed
  fastify.get(
    "/activity/:roomId",
    {
      preHandler: [standardRateLimit],
      schema: {
        params: { $ref: "uuidParam" },
      },
    },
    asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
      const { roomId } = request.params as { roomId: string };
      const query = request.query as any;

      const room = enhancedWebSocketService.getRoomInfo(roomId);
      if (!room) {
        throw createError.notFound("Room not found");
      }

      // Activities would be stored separately in production
      const activities: unknown[] = [];

      return {
        activities,
        total: activities.length,
        limit: query.limit,
        offset: query.offset,
      };
    }),
  );
}
