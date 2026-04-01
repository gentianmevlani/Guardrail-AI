import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { pool } from "@guardrail/database";
import { JWT_SECRET } from "../config/secrets";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

const QuerySchema = z.object({
  limit: z.coerce.number().optional().default(20),
  offset: z.coerce.number().optional().default(0),
  unreadOnly: z.coerce.boolean().optional().default(false),
});

const MarkReadSchema = z.object({
  notificationIds: z.array(z.string()),
});

const CreateNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(["security", "compliance", "system", "billing"]),
  title: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["info", "warning", "error", "success"]),
  actionUrl: z.string().optional(),
});

async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "No token provided" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email?: string;
    };

    (request as any).user = decoded;
  } catch (error) {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

export async function notificationRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = QuerySchema.parse(request.query);
        const user = (request as any).user;
        const userId = user.userId || user.id;

        let sql = `
        SELECT id, user_id as "userId", type, title, message, severity, read, action_url as "actionUrl", created_at as "createdAt"
        FROM notifications
        WHERE user_id = $1
      `;
        const params: unknown[] = [userId];

        if (query.unreadOnly) {
          sql += ` AND read = false`;
        }

        sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(query.limit, query.offset);

        const result = await pool.query(sql, params);

        const countResult = await pool.query(
          `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE read = false) as unread FROM notifications WHERE user_id = $1`,
          [userId],
        );

        const total = parseInt(countResult.rows[0]?.total || "0", 10);
        const unreadCount = parseInt(countResult.rows[0]?.unread || "0", 10);

        return {
          success: true,
          data: {
            notifications: result.rows,
            total,
            unreadCount,
          },
        };
      } catch (error: unknown) {
        fastify.log.error({ error }, "Failed to fetch notifications");
        return reply.status(400).send({
          success: false,
          error: toErrorMessage(error) || "Failed to fetch notifications",
        });
      }
    },
  );

  fastify.post(
    "/",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = CreateNotificationSchema.parse(request.body);

        const result = await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, severity, action_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id as "userId", type, title, message, severity, read, action_url as "actionUrl", created_at as "createdAt"`,
          [
            body.userId,
            body.type,
            body.title,
            body.message,
            body.severity,
            body.actionUrl || null,
          ],
        );

        return {
          success: true,
          data: result.rows[0],
        };
      } catch (error: unknown) {
        fastify.log.error({ error }, "Failed to create notification");
        return reply.status(400).send({
          success: false,
          error: toErrorMessage(error) || "Failed to create notification",
        });
      }
    },
  );

  fastify.post(
    "/mark-read",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = MarkReadSchema.parse(request.body);
        const user = (request as any).user;
        const userId = user.userId || user.id;

        if (body.notificationIds.length === 0) {
          return {
            success: true,
            data: { markedRead: 0 },
          };
        }

        const placeholders = body.notificationIds
          .map((_, i) => `$${i + 2}`)
          .join(", ");
        const result = await pool.query(
          `UPDATE notifications SET read = true WHERE user_id = $1 AND id IN (${placeholders})`,
          [userId, ...body.notificationIds],
        );

        return {
          success: true,
          data: {
            markedRead: result.rowCount || 0,
          },
        };
      } catch (error: unknown) {
        fastify.log.error({ error }, "Failed to mark notifications as read");
        return reply.status(400).send({
          success: false,
          error: toErrorMessage(error) || "Failed to mark notifications as read",
        });
      }
    },
  );

  fastify.post(
    "/mark-all-read",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        const userId = user.userId || user.id;

        const result = await pool.query(
          `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`,
          [userId],
        );

        return {
          success: true,
          data: {
            markedRead: result.rowCount || 0,
          },
        };
      } catch (error: unknown) {
        fastify.log.error(
          { error },
          "Failed to mark all notifications as read",
        );
        return reply.status(400).send({
          success: false,
          error: toErrorMessage(error) || "Failed to mark all notifications as read",
        });
      }
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const user = (request as any).user;
        const userId = user.userId || user.id;

        const result = await pool.query(
          `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
          [id, userId],
        );

        if (result.rowCount === 0) {
          return reply.status(404).send({
            success: false,
            error: "Notification not found or not owned by user",
          });
        }

        return {
          success: true,
          data: {
            deleted: id,
          },
        };
      } catch (error: unknown) {
        fastify.log.error({ error }, "Failed to delete notification");
        return reply.status(400).send({
          success: false,
          error: toErrorMessage(error) || "Failed to delete notification",
        });
      }
    },
  );
}
