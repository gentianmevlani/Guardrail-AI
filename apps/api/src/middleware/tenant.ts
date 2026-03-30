/**
 * Multi-Tenant Middleware
 * 
 * Extracts and validates tenant context from incoming requests
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { multiTenantService } from '../services/multi-tenant-service';
import { logger } from '../logger';

interface TenantMiddlewareOptions {
  required?: boolean;
  checkPermission?: string;
  checkLimit?: string;
}

/**
 * Middleware to extract tenant context from request
 */
export function tenantMiddleware(options: TenantMiddlewareOptions = {}) {
  const {
    required = true,
    checkPermission,
    checkLimit
  } = options;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Extract tenant info from request
      const tenantId = request.headers['x-tenant-id'] as string;
      const domain = request.headers.host || 'localhost';
      const userId = (request as any).userId || 'anonymous';

      // Get tenant context
      const context = await multiTenantService.getTenantContext(
        userId,
        tenantId,
        domain
      );

      if (!context) {
        if (required) {
          reply.status(403).send({
            success: false,
            error: 'Tenant access denied',
            code: 'TENANT_ACCESS_DENIED'
          });
          return;
        }
        
        // Set empty context for non-required routes
        (request as any).tenantContext = null;
        return;
      }

      // Check permission if required
      if (checkPermission && !context.permissions.includes(checkPermission)) {
        reply.status(403).send({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: checkPermission
        });
        return;
      }

      // Check limit if required
      if (checkLimit) {
        const limitCheck = await multiTenantService.checkTenantLimit(
          context.tenant.id,
          checkLimit as any
        );
        
        if (!limitCheck.allowed) {
          reply.status(429).send({
            success: false,
            error: limitCheck.reason || 'Limit exceeded',
            code: 'LIMIT_EXCEEDED'
          });
          return;
        }
      }

      // Set tenant context on request
      (request as any).tenantContext = context;
      
      // Add tenant ID to logs
      request.log = request.log.child({ 
        tenantId: context.tenant.id,
        tenantName: context.tenant.name
      });

    } catch (error: unknown) {
      logger.error({ error }, 'Tenant middleware error');
      
      if (required) {
        reply.status(500).send({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR'
        });
      }
    }
  };
}

/**
 * Middleware to increment tenant usage
 */
export function usageMiddleware(metric: 'projects' | 'scans' | 'api_calls') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const context = (request as any).tenantContext;
    
    if (context) {
      await multiTenantService.incrementUsage(context.tenant.id, metric);
    }
  };
}

/**
 * Helper to get tenant from request
 */
export function getTenantFromRequest(request: FastifyRequest) {
  return (request as any).tenantContext?.tenant || null;
}

/**
 * Helper to check if user has permission
 */
export function hasPermission(request: FastifyRequest, permission: string): boolean {
  const context = (request as any).tenantContext;
  return context ? context.permissions.includes(permission) : false;
}

/**
 * Helper to get tenant ID from request
 */
export function getTenantId(request: FastifyRequest): string | null {
  const context = (request as any).tenantContext;
  return context ? context.tenant.id : null;
}
