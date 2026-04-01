/**
 * Maintenance Mode Middleware
 * 
 * Handles maintenance mode by returning 503 for non-admin users
 */

import { FastifyReply, FastifyRequest } from "fastify";
import { isMaintenanceMode } from "../config/secrets";
import { logger } from "../logger";

/**
 * Maintenance mode middleware
 * Returns 503 for non-admin users when maintenance mode is enabled
 */
export async function maintenanceMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Check if maintenance mode is enabled
  if (!isMaintenanceMode()) {
    return; // Continue normally
  }
  
  // Check if user is admin (bypass maintenance mode)
  const user = (request as any).user;
  const isAdmin = user?.role === 'admin';
  
  // Allow admin users to bypass maintenance mode
  if (isAdmin) {
    logger.info({ 
      userId: user.id, 
      route: request.routeOptions.url 
    }, "Admin bypassed maintenance mode");
    return;
  }
  
  // Check if this is a health/status endpoint (allow these)
  const publicRoutes = [
    '/v1/status',
    '/v1/status/incident',
    '/health',
    '/healthz',
    '/ready',
    '/live'
  ];
  
  const isPublicRoute = publicRoutes.some(route => 
    request.routeOptions.url?.startsWith(route)
  );
  
  if (isPublicRoute) {
    return; // Allow public status routes
  }
  
  // Return 503 Maintenance Mode response
  logger.info({ 
    route: request.routeOptions.url,
    ip: request.ip,
    userAgent: request.headers['user-agent']
  }, "Maintenance mode blocking request");
  
  return reply.status(503).send({
    error: "Service Unavailable",
    message: "We're currently undergoing maintenance. Please try again later.",
    maintenance: true,
    timestamp: new Date().toISOString(),
    retryAfter: 300 // Suggest retry after 5 minutes
  });
}
