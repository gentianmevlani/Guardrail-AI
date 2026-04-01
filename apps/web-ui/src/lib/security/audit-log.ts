/**
 * Security Event Logging
 *
 * Centralized security event logging for audit trails and monitoring.
 */

import { logger } from "../logger";

// =============================================================================
// Event Types
// =============================================================================

export type SecurityEventType =
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.logout'
  | 'auth.token.refresh'
  | 'auth.token.invalid'
  | 'auth.session.expired'
  | 'auth.mfa.success'
  | 'auth.mfa.failure'
  | 'access.denied'
  | 'access.unauthorized'
  | 'rate_limit.exceeded'
  | 'rate_limit.warning'
  | 'input.validation.failure'
  | 'input.xss.attempt'
  | 'input.sql_injection.attempt'
  | 'csp.violation'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'api_key.invalid'
  | 'suspicious.activity'
  | 'config.change'
  | 'data.export'
  | 'data.deletion';

export type SecurityEventSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  outcome: 'success' | 'failure' | 'blocked';
  details?: Record<string, unknown>;
  requestId?: string;
}

// =============================================================================
// Severity Mapping
// =============================================================================

const EVENT_SEVERITY: Record<SecurityEventType, SecurityEventSeverity> = {
  'auth.login.success': 'info',
  'auth.login.failure': 'warning',
  'auth.logout': 'info',
  'auth.token.refresh': 'info',
  'auth.token.invalid': 'warning',
  'auth.session.expired': 'info',
  'auth.mfa.success': 'info',
  'auth.mfa.failure': 'warning',
  'access.denied': 'warning',
  'access.unauthorized': 'warning',
  'rate_limit.exceeded': 'warning',
  'rate_limit.warning': 'info',
  'input.validation.failure': 'info',
  'input.xss.attempt': 'critical',
  'input.sql_injection.attempt': 'critical',
  'csp.violation': 'warning',
  'api_key.created': 'info',
  'api_key.revoked': 'info',
  'api_key.invalid': 'warning',
  'suspicious.activity': 'critical',
  'config.change': 'warning',
  'data.export': 'info',
  'data.deletion': 'warning',
};

// =============================================================================
// Logging Functions
// =============================================================================

/**
 * Log a security event
 */
export async function logSecurityEvent(
  type: SecurityEventType,
  context: {
    userId?: string;
    sessionId?: string;
    ip?: string;
    userAgent?: string;
    resource?: string;
    action?: string;
    outcome: 'success' | 'failure' | 'blocked';
    details?: Record<string, unknown>;
    requestId?: string;
  }
): Promise<void> {
  const event: SecurityEvent = {
    type,
    severity: EVENT_SEVERITY[type],
    timestamp: new Date().toISOString(),
    ...context,
  };

  // Console logging (structured JSON for log aggregators)
  const logLevel = event.severity === 'critical' || event.severity === 'error' 
    ? 'error' 
    : event.severity === 'warning' 
      ? 'warn' 
      : 'info';

  // eslint-disable-next-line no-console
  console[logLevel]('[SECURITY]', JSON.stringify(event));

  // In production, send to external logging service
  if (process.env.NODE_ENV === 'production') {
    await sendToExternalLogger(event);
  }
}

/**
 * Send event to external logging service
 */
async function sendToExternalLogger(event: SecurityEvent): Promise<void> {
  const loggingEndpoint = process.env.SECURITY_LOG_ENDPOINT;
  
  if (!loggingEndpoint) return;

  try {
    await fetch(loggingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SECURITY_LOG_API_KEY || ''}`,
      },
      body: JSON.stringify(event),
    });
  } catch (error) {
    // Don't throw - logging failures shouldn't break the app
    logger.error('Failed to send security event to external logger', {
      error: error instanceof Error ? error.message : String(error),
      component: 'security-audit-log'
    });
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

export function logLoginSuccess(userId: string, ip?: string, userAgent?: string): Promise<void> {
  return logSecurityEvent('auth.login.success', {
    userId,
    ip,
    userAgent,
    outcome: 'success',
  });
}

export function logLoginFailure(email: string, ip?: string, reason?: string): Promise<void> {
  return logSecurityEvent('auth.login.failure', {
    ip,
    outcome: 'failure',
    details: { email, reason },
  });
}

export function logRateLimitExceeded(
  ip: string,
  endpoint: string,
  limit: number
): Promise<void> {
  return logSecurityEvent('rate_limit.exceeded', {
    ip,
    resource: endpoint,
    outcome: 'blocked',
    details: { limit },
  });
}

export function logAccessDenied(
  userId: string | undefined,
  resource: string,
  reason: string,
  ip?: string
): Promise<void> {
  return logSecurityEvent('access.denied', {
    userId,
    ip,
    resource,
    outcome: 'blocked',
    details: { reason },
  });
}

export function logSuspiciousActivity(
  description: string,
  context: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  return logSecurityEvent('suspicious.activity', {
    ...context,
    outcome: 'blocked',
    details: {
      ...context.details,
      description,
    },
  });
}

export function logXssAttempt(input: string, ip?: string): Promise<void> {
  return logSecurityEvent('input.xss.attempt', {
    ip,
    outcome: 'blocked',
    details: { 
      inputPreview: input.slice(0, 100),
      inputLength: input.length,
    },
  });
}

export function logSqlInjectionAttempt(input: string, ip?: string): Promise<void> {
  return logSecurityEvent('input.sql_injection.attempt', {
    ip,
    outcome: 'blocked',
    details: { 
      inputPreview: input.slice(0, 100),
      inputLength: input.length,
    },
  });
}

export function logApiKeyCreated(userId: string, keyPrefix: string): Promise<void> {
  return logSecurityEvent('api_key.created', {
    userId,
    outcome: 'success',
    details: { keyPrefix },
  });
}

export function logApiKeyRevoked(userId: string, keyPrefix: string): Promise<void> {
  return logSecurityEvent('api_key.revoked', {
    userId,
    outcome: 'success',
    details: { keyPrefix },
  });
}

// =============================================================================
// Request Context Helper
// =============================================================================

export function extractRequestContext(request: Request): {
  ip: string;
  userAgent: string;
  requestId: string;
} {
  const headers = request.headers;
  
  return {
    ip: headers.get('x-real-ip') ||
        headers.get('cf-connecting-ip') ||
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        'unknown',
    userAgent: headers.get('user-agent') || 'unknown',
    requestId: headers.get('x-request-id') || 
               headers.get('x-vercel-id') ||
               crypto.randomUUID(),
  };
}
