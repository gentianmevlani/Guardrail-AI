// @ts-nocheck — Admin export paths use dynamic event payloads.
/**
 * Admin Security Events Route
 * 
 * Provides admin-only access to security event audit trail
 * Requires admin role and proper authentication
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { logger } from '../../logger';
import { securityEventService, SecurityEventType } from '../../services/security-event-service';
import { toErrorMessage, getErrorStack } from "../../utils/toErrorMessage";

// Query parameters schema
const SecurityEventsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  eventType: z.enum([
    'login_success', 'login_failure', 'logout', 'jwt_invalid', 'jwt_expired',
    'password_reset_request', 'password_reset_success', 'password_reset_failure',
    'api_key_validated', 'api_key_invalid', 'api_key_policy_violation',
    'api_key_rate_limit_exceeded', 'api_key_ip_restricted', 'api_key_time_restricted',
    'role_granted', 'role_revoked', 'permission_granted', 'permission_revoked',
    'access_denied', 'privilege_escalation_attempt',
    'billing_webhook_received', 'billing_webhook_verified', 'billing_webhook_verification_failed',
    'subscription_created', 'subscription_updated', 'subscription_cancelled',
    'payment_success', 'payment_failure',
    'rate_limit_exceeded', 'rate_limit_fallback_active', 'ddos_detected', 'suspicious_activity',
    'data_export', 'data_import', 'sensitive_data_accessed', 'pii_accessed', 'audit_log_accessed',
    'admin_action', 'system_config_change', 'security_policy_violation',
    'malicious_request_blocked', 'upload_blocked', 'resource_exhaustion_detected'
  ]).optional(),
  userId: z.string().optional(),
  orgId: z.string().optional(),
  ip: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(1000)).optional(),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional(),
});

// Admin authorization middleware
async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  // Check if user is authenticated
  if (!request.user) {
    return reply.status(401).send({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Check if user has admin role
  const userRole = (request.user as any)?.role || 'member';
  if (!['admin', 'owner'].includes(userRole)) {
    // Log unauthorized access attempt
    await securityEventService.emitFromRequest(
      request,
      'access_denied',
      { 
        attemptedResource: '/api/admin/security-events',
        userRole,
        requiredRole: 'admin'
      },
      { severity: 'medium' }
    );
    
    return reply.status(403).send({
      success: false,
      error: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }
  
  // Log admin access
  await securityEventService.emitFromRequest(
    request,
    'admin_action',
    { 
      action: 'access_security_events',
      query: request.query
    },
    { severity: 'low' }
  );
}

export async function securityEventsRoutes(fastify: FastifyInstance) {
  // Add admin middleware to all routes
  fastify.addHook('preHandler', requireAdmin);
  
  // GET /api/admin/security-events - Query security events
  fastify.get('/security-events', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate query parameters
      const query = SecurityEventsQuerySchema.parse(request.query);
      
      // Convert date strings to Date objects
      const filters: any = {
        limit: query.limit || 100,
        offset: query.offset || 0,
      };
      
      if (query.from) {
        filters.from = new Date(query.from);
      }
      
      if (query.to) {
        filters.to = new Date(query.to);
      }
      
      if (query.eventType) {
        filters.eventType = query.eventType as SecurityEventType;
      }
      
      if (query.userId) {
        filters.userId = query.userId;
      }
      
      if (query.orgId) {
        filters.orgId = query.orgId;
      }
      
      if (query.ip) {
        filters.ip = query.ip;
      }
      
      if (query.severity) {
        filters.severity = query.severity;
      }
      
      // Query events
      const events = await securityEventService.queryEvents(filters);
      
      // Get total count for pagination
      const totalEvents = await securityEventService.queryEvents({
        ...filters,
        limit: undefined,
        offset: undefined
      });
      
      return {
        success: true,
        data: {
          events,
          pagination: {
            total: totalEvents.length,
            limit: filters.limit,
            offset: filters.offset,
            hasMore: filters.offset + filters.limit < totalEvents.length
          },
          filters
        }
      };
      
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, 'Failed to query security events');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
          code: 'INVALID_QUERY'
        });
      }
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to query security events',
        code: 'QUERY_FAILED'
      });
    }
  });
  
  // GET /api/admin/security-events/stats - Get event statistics
  fastify.get('/security-events/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate query parameters (subset of events query)
      const query = SecurityEventsQuerySchema.pick({
        from: true,
        to: true,
        orgId: true
      }).parse(request.query);
      
      // Convert date strings to Date objects
      const filters: any = {};
      
      if (query.from) {
        filters.from = new Date(query.from);
      }
      
      if (query.to) {
        filters.to = new Date(query.to);
      }
      
      if (query.orgId) {
        filters.orgId = query.orgId;
      }
      
      // Get statistics
      const stats = await securityEventService.getEventStats(filters);
      
      // Get recent events for summary
      const recentEvents = await securityEventService.queryEvents({
        limit: 10,
        ...filters
      });
      
      return {
        success: true,
        data: {
          stats,
          recentEvents,
          summary: {
            totalEvents: Object.values(stats).reduce((sum: number, count: any) => sum + count, 0),
            criticalEvents: Object.entries(stats)
              .filter(([key]) => key.endsWith('_critical'))
              .reduce((sum: number, [, count]) => sum + (count as number), 0),
            highEvents: Object.entries(stats)
              .filter(([key]) => key.endsWith('_high'))
              .reduce((sum: number, [, count]) => sum + (count as number), 0),
            timeRange: {
              from: filters.from || 'all time',
              to: filters.to || 'now'
            }
          },
          filters
        }
      };
      
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, 'Failed to get security event statistics');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
          code: 'INVALID_QUERY'
        });
      }
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to get security event statistics',
        code: 'STATS_FAILED'
      });
    }
  });
  
  // GET /api/admin/security-events/export - Export security events
  fastify.get('/security-events/export', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate query parameters
      const query = SecurityEventsQuerySchema.parse(request.query);
      
      // Set higher limit for export (max 10,000)
      const filters: any = {
        limit: Math.min(query.limit || 10000, 10000),
        offset: query.offset || 0,
      };
      
      if (query.from) {
        filters.from = new Date(query.from);
      }
      
      if (query.to) {
        filters.to = new Date(query.to);
      }
      
      if (query.eventType) {
        filters.eventType = query.eventType as SecurityEventType;
      }
      
      if (query.userId) {
        filters.userId = query.userId;
      }
      
      if (query.orgId) {
        filters.orgId = query.orgId;
      }
      
      if (query.ip) {
        filters.ip = query.ip;
      }
      
      if (query.severity) {
        filters.severity = query.severity;
      }
      
      // Query events
      const events = await securityEventService.queryEvents(filters);
      
      // Log export action
      await securityEventService.emitFromRequest(
        request,
        'data_export',
        { 
          recordType: 'security_events',
          recordCount: events.length,
          filters
        },
        { severity: 'medium' }
      );
      
      // Set CSV download headers
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="security-events-${new Date().toISOString().split('T')[0]}.csv"`);
      
      // Convert to CSV
      const csvHeaders = [
        'ID', 'Event Type', 'Severity', 'User ID', 'Org ID', 
        'Request ID', 'IP Address', 'User Agent', 'Route', 'Method',
        'API Key Prefix', 'Timestamp'
      ];
      
      const csvRows = events.map(event => [
        event.id,
        event.eventType,
        event.severity,
        event.userId || '',
        event.orgId || '',
        event.requestId || '',
        event.ip || '',
        event.userAgent || '',
        event.route || '',
        event.method || '',
        event.apiKeyPrefix || '',
        event.timestamp
      ]);
      
      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      
      return reply.send(csvContent);
      
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, 'Failed to export security events');
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
          code: 'INVALID_QUERY'
        });
      }
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to export security events',
        code: 'EXPORT_FAILED'
      });
    }
  });
}
