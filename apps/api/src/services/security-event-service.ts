/**
 * Security Event Service
 * 
 * Centralized security event logging and audit trail
 * Captures authentication, authorization, and security-relevant actions
 */

import { FastifyRequest } from 'fastify';
import { prisma } from '@guardrail/database';
import { logger } from '../logger';
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

export interface SecurityEventPayload {
  eventType: SecurityEventType;
  payload: Record<string, unknown>;
  requestContext?: RequestContext;
  userId?: string;
  orgId?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface RequestContext {
  requestId: string;
  ip: string;
  userAgent?: string;
  route?: string;
  method?: string;
  url?: string;
  apiKeyPrefix?: string;
}

export type SecurityEventType = 
  // Authentication events
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'jwt_invalid'
  | 'jwt_expired'
  | 'password_reset_request'
  | 'password_reset_success'
  | 'password_reset_failure'
  
  // API Key events
  | 'api_key_validated'
  | 'api_key_invalid'
  | 'api_key_policy_violation'
  | 'api_key_rate_limit_exceeded'
  | 'api_key_ip_restricted'
  | 'api_key_time_restricted'
  
  // Authorization events
  | 'role_granted'
  | 'role_revoked'
  | 'permission_granted'
  | 'permission_revoked'
  | 'access_denied'
  | 'privilege_escalation_attempt'
  
  // Billing events
  | 'billing_webhook_received'
  | 'billing_webhook_verified'
  | 'billing_webhook_verification_failed'
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'payment_success'
  | 'payment_failure'
  
  // Rate limiting events
  | 'rate_limit_exceeded'
  | 'rate_limit_fallback_active'
  | 'ddos_detected'
  | 'suspicious_activity'
  
  // Data events
  | 'data_export'
  | 'data_import'
  | 'sensitive_data_accessed'
  | 'pii_accessed'
  | 'audit_log_accessed'
  
  // System events
  | 'admin_action'
  | 'system_config_change'
  | 'security_policy_violation'
  | 'malicious_request_blocked'
  | 'upload_blocked'
  | 'resource_exhaustion_detected';

/**
 * Redact sensitive information from event payload
 */
function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...payload };
  
  // List of sensitive field patterns to redact
  const sensitivePatterns = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /authorization/i,
    /cookie/i,
    /session/i,
    /credit.*card/i,
    /ssn/i,
    /social.*security/i,
    /bank.*account/i,
    /api.*key/i,
    /jwt/i,
    /bearer/i,
  ];
  
  // List of fields to completely remove (not just redact)
  const removeFields = [
    'rawBody',
    'rawHeaders',
    'rawQuery',
    'fullRequest',
    'responseBody',
  ];
  
  function redactValue(value: any): any {
    if (typeof value === 'string') {
      // Check if the string looks like a sensitive value
      if (value.length > 20 && 
          (value.includes('Bearer ') || 
           value.startsWith('sk_') || 
           value.startsWith('ghp_') ||
           /^[A-Za-z0-9+/]{40,}={0,2}$/.test(value))) {
        return value.substring(0, 8) + '...';
      }
      return value;
    }
    
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map(redactValue);
      }
      
      const redactedObj: any = {};
      for (const [key, val] of Object.entries(value)) {
        // Check if key matches sensitive patterns
        const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
        const shouldRemove = removeFields.includes(key);
        
        if (shouldRemove) {
          continue; // Skip this field entirely
        } else if (isSensitive) {
          redactedObj[key] = typeof val === 'string' ? '*****' : 'REDACTED';
        } else {
          redactedObj[key] = redactValue(val);
        }
      }
      return redactedObj;
    }
    
    return value;
  }
  
  return redactValue(redacted);
}

/**
 * Extract request context from Fastify request
 */
function extractRequestContext(request: FastifyRequest): RequestContext {
  const headers = request.headers as any;
  
  // Extract API key prefix if present
  let apiKeyPrefix: string | undefined;
  const authHeader = headers.authorization;
  if (authHeader?.startsWith('Bearer ') && authHeader.length > 20) {
    // Extract first 8 characters as prefix
    apiKeyPrefix = authHeader.substring(7, 15) + '...';
  }
  
  return {
    requestId: (request as any).requestId || 'unknown',
    ip: request.ip || headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown',
    userAgent: headers['user-agent'],
    route: request.routeOptions?.url || request.url,
    method: request.method,
    url: request.url,
    apiKeyPrefix,
  };
}

/**
 * Security Event Service Class
 */
export class SecurityEventService {
  private static instance: SecurityEventService;
  
  private constructor() {}
  
  public static getInstance(): SecurityEventService {
    if (!SecurityEventService.instance) {
      SecurityEventService.instance = new SecurityEventService();
    }
    return SecurityEventService.instance;
  }
  
  /**
   * Emit a security event
   */
  public async emit(event: SecurityEventPayload): Promise<void> {
    try {
      // Redact sensitive information
      const redactedPayload = redactPayload(event.payload);
      
      // Create event record
      const securityEvent = {
        eventType: event.eventType,
        payload: redactedPayload,
        userId: event.userId || event.requestContext?.requestId, // Fallback to request ID
        orgId: event.orgId,
        severity: event.severity || this.getDefaultSeverity(event.eventType),
        requestId: event.requestContext?.requestId,
        ip: event.requestContext?.ip,
        userAgent: event.requestContext?.userAgent,
        route: event.requestContext?.route,
        method: event.requestContext?.method,
        apiKeyPrefix: event.requestContext?.apiKeyPrefix,
        timestamp: new Date(),
      };
      
      // Store in database
      await this.storeEvent(securityEvent);
      
      // Log to structured logger
      logger.info(
        {
          eventType: event.eventType,
          requestId: event.requestContext?.requestId,
          userId: event.userId,
          ip: event.requestContext?.ip,
          severity: securityEvent.severity,
          payload: redactedPayload,
        },
        `Security event: ${event.eventType}`
      );
      
    } catch (error: unknown) {
      // Never let security logging fail the main request
      logger.error({ error: toErrorMessage(error) }, 'Failed to emit security event');
    }
  }
  
  /**
   * Emit event from Fastify request
   */
  public async emitFromRequest(
    request: FastifyRequest,
    eventType: SecurityEventType,
    payload: Record<string, unknown> = {},
    options: { severity?: 'low' | 'medium' | 'high' | 'critical'; userId?: string; orgId?: string } = {}
  ): Promise<void> {
    const requestContext = extractRequestContext(request);
    const userId = options.userId || (request.user as any)?.id;
    const orgId = options.orgId || (request.user as any)?.orgId;
    
    await this.emit({
      eventType,
      payload,
      requestContext,
      userId,
      orgId,
      severity: options.severity,
    });
  }
  
  /**
   * Query security events
   */
  public async queryEvents(filters: {
    from?: Date;
    to?: Date;
    eventType?: SecurityEventType;
    userId?: string;
    orgId?: string;
    ip?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      const where: any = {};
      
      if (filters.from || filters.to) {
        where.timestamp = {};
        if (filters.from) where.timestamp.gte = filters.from;
        if (filters.to) where.timestamp.lte = filters.to;
      }
      
      if (filters.eventType) where.eventType = filters.eventType;
      if (filters.userId) where.userId = filters.userId;
      if (filters.orgId) where.orgId = filters.orgId;
      if (filters.ip) where.ip = filters.ip;
      if (filters.severity) where.severity = filters.severity;
      
      const events = await prisma.securityEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0,
        select: {
          id: true,
          eventType: true,
          payload: true,
          userId: true,
          orgId: true,
          severity: true,
          requestId: true,
          ip: true,
          userAgent: true,
          route: true,
          method: true,
          apiKeyPrefix: true,
          timestamp: true,
        },
      });
      
      return events;
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), stack: getErrorStack(error) }, 'Failed to query security events');
      throw new Error('Failed to query security events');
    }
  }
  
  /**
   * Get event statistics
   */
  public async getEventStats(filters: {
    from?: Date;
    to?: Date;
    orgId?: string;
  }): Promise<Record<string, unknown>> {
    try {
      const where: any = {};
      
      if (filters.from || filters.to) {
        where.timestamp = {};
        if (filters.from) where.timestamp.gte = filters.from;
        if (filters.to) where.timestamp.lte = filters.to;
      }
      
      if (filters.orgId) where.orgId = filters.orgId;
      
      const stats = await prisma.securityEvent.groupBy({
        by: ['eventType', 'severity'],
        where,
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
      });
      
      return stats.reduce((acc, stat) => {
        const key = `${stat.eventType}_${stat.severity}`;
        acc[key] = stat._count.id;
        return acc;
      }, {} as Record<string, unknown>);
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), stack: getErrorStack(error) }, 'Failed to get event statistics');
      throw new Error('Failed to get event statistics');
    }
  }
  
  /**
   * Store event in database
   */
  private async storeEvent(event: any): Promise<void> {
    try {
      // Generate ID if not present
      const eventId = event.id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store in Prisma database
      await prisma.securityEvent.create({
        data: {
          id: eventId,
          eventType: event.eventType,
          payload: event.payload || {},
          userId: event.userId || null,
          orgId: event.orgId || null,
          severity: event.severity || 'medium',
          requestId: event.requestId || null,
          ip: event.ip || null,
          userAgent: event.userAgent || null,
          route: event.route || null,
          method: event.method || null,
          apiKeyPrefix: event.apiKeyPrefix || null,
          timestamp: event.timestamp || new Date(),
        },
      });

      logger.debug({ 
        eventId,
        eventType: event.eventType,
        userId: event.userId,
        timestamp: event.timestamp
      }, 'Security event stored in database');
    } catch (error: unknown) {
      logger.error(
        {
          eventType: event.eventType,
          userId: event.userId,
          error: toErrorMessage(error),
          stack: getErrorStack(error),
        },
        '[SECURITY EVENT STORAGE FAILED] Failed to store security event',
      );
    }
  }
  
  /**
   * Get default severity for event type
   */
  private getDefaultSeverity(eventType: SecurityEventType): 'low' | 'medium' | 'high' | 'critical' {
    const severityMap: Record<SecurityEventType, 'low' | 'medium' | 'high' | 'critical'> = {
      // Authentication
      'login_success': 'low',
      'login_failure': 'medium',
      'logout': 'low',
      'jwt_invalid': 'high',
      'jwt_expired': 'medium',
      'password_reset_request': 'medium',
      'password_reset_success': 'low',
      'password_reset_failure': 'medium',
      
      // API Keys
      'api_key_validated': 'low',
      'api_key_invalid': 'high',
      'api_key_policy_violation': 'high',
      'api_key_rate_limit_exceeded': 'medium',
      'api_key_ip_restricted': 'medium',
      'api_key_time_restricted': 'medium',
      
      // Authorization
      'role_granted': 'medium',
      'role_revoked': 'medium',
      'permission_granted': 'medium',
      'permission_revoked': 'medium',
      'access_denied': 'medium',
      'privilege_escalation_attempt': 'critical',
      
      // Billing
      'billing_webhook_received': 'low',
      'billing_webhook_verified': 'low',
      'billing_webhook_verification_failed': 'high',
      'subscription_created': 'low',
      'subscription_updated': 'low',
      'subscription_cancelled': 'medium',
      'payment_success': 'low',
      'payment_failure': 'medium',
      
      // Rate limiting
      'rate_limit_exceeded': 'medium',
      'rate_limit_fallback_active': 'medium',
      'ddos_detected': 'high',
      'suspicious_activity': 'high',
      
      // Data
      'data_export': 'medium',
      'data_import': 'medium',
      'sensitive_data_accessed': 'high',
      'pii_accessed': 'high',
      'audit_log_accessed': 'medium',
      
      // System
      'admin_action': 'medium',
      'system_config_change': 'high',
      'security_policy_violation': 'high',
      'malicious_request_blocked': 'high',
      'upload_blocked': 'medium',
      'resource_exhaustion_detected': 'high',
    };
    
    return severityMap[eventType] || 'medium';
  }
}

// Export singleton instance
export const securityEventService = SecurityEventService.getInstance();
