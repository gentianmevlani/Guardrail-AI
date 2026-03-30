import { FastifyReply, FastifyRequest } from "fastify";
import { authMiddleware } from "./fastify-auth";

// Authentication middleware
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  await authMiddleware(request as any, reply);
}

// Admin authorization middleware
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await authMiddleware(request as any, reply);
  
  // Check if user has admin role
  const user = (request as any).user;
  if (!user || user.role !== 'admin') {
    return reply.status(403).send({
      error: "Admin access required",
      code: "ADMIN_REQUIRED"
    });
  }
}
