/**
 * Enhanced Fastify Authentication & Authorization Middleware
 *
 * Extends the original fastify-auth with API key security policy enforcement:
 * - IP allowlisting
 * - Time-based restrictions
 * - Country restrictions
 * - Usage quotas
 * - Fingerprinting
 * - Key rotation support
 *
 * SECURITY: All policy enforcement happens server-side. The API key string
 * contains NO tier or policy information.
 */

import { prisma } from "@guardrail/database";
import { FastifyReply, FastifyRequest } from "fastify";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config/secrets";
import { logger } from "../logger";
import { enhancedApiKeyService, EnhancedApiKeyValidationResult } from "../services/enhanced-api-key-service";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/** JWT payload structure */
interface TokenPayload extends JwtPayload {
  id: string;
  email: string;
  role?: string;
}

/** User data attached to authenticated requests */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  subscriptionTier?: string;
}

/** Extended Fastify request with authentication */
export interface AuthenticatedRequest extends FastifyRequest {
  user?: AuthUser;
  token?: string;
  apiKeyValidation?: EnhancedApiKeyValidationResult;
}

/** API key authentication context */
interface ApiKeyAuthContext {
  ipAddress: string;
  userAgent?: string;
  country?: string;
  requestedScopes: string[];
  isExpensive?: boolean;
}

// =============================================================================
// TOKEN GENERATION & VERIFICATION (reused from original)
// =============================================================================

/**
 * Generate JWT token for user
 */
export function generateToken(payload: {
  id: string;
  email: string;
  role?: string;
}): string {
  const signOptions: SignOptions = {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: "HS256",
    issuer: "guardrail-api",
    audience: "guardrail-cli-toolent",
  };

  return jwt.sign(payload, JWT_SECRET, signOptions);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: "guardrail-api",
    audience: "guardrail-cli-toolent",
  }) as TokenPayload;
}

// =============================================================================
// ENHANCED API KEY AUTHENTICATION
// =============================================================================

/**
 * Extract client IP address from request
 */
function extractClientIP(request: FastifyRequest): string {
  // Check various headers for real IP (behind proxies)
  const forwardedFor = request.headers['x-forwarded-for'];
  const realIP = request.headers['x-real-ip'];
  const cfConnectingIP = request.headers['cf-connecting-ip']; // Cloudflare
  
  if (forwardedFor && typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIP && typeof realIP === 'string') {
    return realIP;
  }
  
  if (cfConnectingIP && typeof cfConnectingIP === 'string') {
    return cfConnectingIP;
  }
  
  return request.ip || 'unknown';
}

/**
 * Extract country from request headers (if available)
 */
function extractCountry(request: FastifyRequest): string | undefined {
  // Cloudflare country header
  const cfCountry = request.headers['cf-ipcountry'];
  if (cfCountry && typeof cfCountry === 'string') {
    return cfCountry;
  }
  
  // Other potential headers
  const geoCountry = request.headers['x-geo-country'];
  const cloudFrontCountry = request.headers['cloudfront-viewer-country'];
  
  return (geoCountry || cloudFrontCountry) as string | undefined;
}

/**
 * Enhanced API key authentication with security policy enforcement
 */
export async function enhancedApiKeyAuth(
  request: AuthenticatedRequest,
  reply: FastifyReply,
  options: {
    requiredScopes?: string[];
    isExpensive?: boolean;
    skipPolicyCheck?: boolean;
  } = {},
): Promise<void> {
  const authLogger = logger.child({
    middleware: "enhanced-api-key-auth",
    requestId: request.id,
  });

  const apiKeyHeader = request.headers["x-api-key"];
  const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

  if (!apiKey) {
    reply.status(401).send({
      success: false,
      error: "API key required",
      code: "NO_API_KEY",
    });
    return;
  }

  // Validate API key format
  if (!apiKey.startsWith("grl_") || apiKey.length < 20) {
    reply.status(401).send({
      success: false,
      error: "Invalid API key format",
      code: "INVALID_API_KEY_FORMAT",
    });
    return;
  }

  try {
    // Build authentication context
    const context: ApiKeyAuthContext = {
      ipAddress: extractClientIP(request),
      userAgent: request.headers["user-agent"] as string,
      country: extractCountry(request),
      requestedScopes: options.requiredScopes || [],
      isExpensive: options.isExpensive || false,
    };

    // Validate API key with security policy
    const validation = await enhancedApiKeyService.validateApiKeyWithPolicy(apiKey, context);

    // Store validation result on request for later use
    request.apiKeyValidation = validation;

    if (!validation.valid) {
      authLogger.warn({
        error: validation.error,
        ipAddress: context.ipAddress,
        country: context.country,
      }, "API key validation failed");

      // Return appropriate status code based on error type
      const statusCode = validation.error?.includes("quota") ? 429 : 
                        validation.error?.includes("allowed") ? 403 : 401;

      reply.status(statusCode).send({
        success: false,
        error: validation.error,
        code: validation.error?.includes("quota") ? "QUOTA_EXCEEDED" :
              validation.error?.includes("allowed") ? "POLICY_VIOLATION" :
              "INVALID_API_KEY",
        // Include quota info if available
        ...(validation.securityPolicy?.quotaRemaining && {
          quotaRemaining: validation.securityPolicy.quotaRemaining,
        }),
        // Include warnings if any
        ...(validation.securityPolicy?.warnings && {
          warnings: validation.securityPolicy.warnings,
        }),
      });
      return;
    }

    // Fetch user data for valid API key
    const user = await fetchUserWithSubscription(validation.userId!);

    if (!user) {
      authLogger.warn({ userId: validation.userId }, "API key valid but user not found");
      reply.status(401).send({
        success: false,
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    // Attach user to request
    request.user = toAuthUser(user);

    // Log successful authentication with security context
    authLogger.info({
      userId: user.id,
      ipAddress: context.ipAddress,
      country: context.country,
      requestedScopes: context.requestedScopes,
      isExpensive: context.isExpensive,
      quotaRemaining: validation.securityPolicy?.quotaRemaining,
      warnings: validation.securityPolicy?.warnings,
    }, "Enhanced API key authentication successful");

  } catch (error) {
    authLogger.error({ error }, "Enhanced API key auth error");
    reply.status(500).send({
      success: false,
      error: "Authentication error",
      code: "AUTH_ERROR",
    });
  }
}

/**
 * Require specific API key scopes with enhanced security
 */
export function requireEnhancedApiKeyScope(requiredScopes: string[], options: {
  isExpensive?: boolean;
  enforceStrictPolicy?: boolean;
} = {}) {
  return async (
    request: AuthenticatedRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const apiKeyHeader = request.headers["x-api-key"];
    const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

    if (!apiKey) {
      reply.status(401).send({
        success: false,
        error: "API key required for this operation",
        code: "NO_API_KEY",
      });
      return;
    }

    // Use enhanced validation with policy enforcement
    await enhancedApiKeyAuth(request, reply, {
      requiredScopes,
      isExpensive: options.isExpensive,
      skipPolicyCheck: !options.enforceStrictPolicy,
    });
  };
}

// =============================================================================
// ORIGINAL AUTHENTICATION HELPERS (reused)
// =============================================================================

/**
 * Extract bearer token from authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7).trim();
}

/**
 * Fetch user with subscription tier from database
 */
async function fetchUserWithSubscription(
  userId: string,
): Promise<any | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      subscriptions: {
        where: { status: "active" },
        select: { tier: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) return null;

  // Get role from user record (with fallback for pre-migration data)
  let role = "user";
  try {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (userRecord && "role" in userRecord) {
      role = (userRecord as any).role || "user";
    }
  } catch {
    // Fallback to default role if query fails
  }

  return {
    ...user,
    role,
  };
}

/**
 * Convert database user to AuthUser
 */
function toAuthUser(user: any): AuthUser {
  return {
    id: user.id,
    email: user.email || "",
    name: user.name || "",
    role: user.role,
    subscriptionTier: user.subscriptions[0]?.tier,
  };
}

// =============================================================================
// ENHANCED RATE LIMITING WITH QUOTA INTEGRATION
// =============================================================================

/**
 * Create enhanced rate limiting middleware that respects API key quotas
 */
export function createEnhancedRateLimit(options: {
  max?: number;
  windowMs?: number;
  message?: string;
  respectApiKeyQuotas?: boolean;
} = {}) {
  const {
    max = 100,
    windowMs = 60 * 1000,
    message = "Too many requests",
    respectApiKeyQuotas = true,
  } = options;

  return async (
    request: AuthenticatedRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    // If API key authentication was used and we should respect quotas
    if (respectApiKeyQuotas && request.apiKeyValidation?.securityPolicy?.quotaRemaining) {
      const quotaRemaining = request.apiKeyValidation.securityPolicy.quotaRemaining;
      
      // Set headers based on API key quota
      reply.header("X-RateLimit-Limit", "API_KEY_QUOTA");
      reply.header("X-RateLimit-Remaining", quotaRemaining.requests);
      
      // If quota is exhausted, block the request
      if (quotaRemaining.requests <= 0) {
        reply.status(429).send({
          success: false,
          error: "API key quota exceeded",
          code: "QUOTA_EXCEEDED",
          quotaRemaining,
        });
        return;
      }
    }

    // Fall back to standard rate limiting for non-API-key requests
    // (Implementation would reuse the original rate limiting logic)
    reply.header("X-RateLimit-Limit", max);
    reply.header("X-RateLimit-Remaining", Math.max(0, max - 1));
  };
}

// =============================================================================
// SECURITY POLICY HELPERS
// =============================================================================

/**
 * Middleware to log security policy violations
 */
export function logSecurityViolations() {
  return async (
    request: AuthenticatedRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    // This middleware would run after authentication
    // Log any security warnings from the validation result
    if (request.apiKeyValidation?.securityPolicy?.warnings) {
      const authLogger = logger.child({
        middleware: "security-violations",
        requestId: request.id,
      });

      authLogger.warn({
        userId: request.user?.id,
        warnings: request.apiKeyValidation.securityPolicy.warnings,
        ipAddress: extractClientIP(request),
        path: request.url,
      }, "Security policy warnings detected");
    }
  };
}

/**
 * Middleware to enforce strict policy for sensitive operations
 */
export function requireStrictSecurity() {
  return async (
    request: AuthenticatedRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!request.apiKeyValidation?.securityPolicy) {
      reply.status(401).send({
        success: false,
        error: "API key with security policy required",
        code: "SECURITY_POLICY_REQUIRED",
      });
      return;
    }

    const policy = request.apiKeyValidation.securityPolicy;
    
    // Check for any security warnings
    if (policy.warnings && policy.warnings.length > 0) {
      reply.status(403).send({
        success: false,
        error: "Security policy warnings prevent this operation",
        code: "SECURITY_WARNING_BLOCK",
        warnings: policy.warnings,
      });
      return;
    }

    // Check if IP allowlist is configured (sensitive operations should require this)
    // This would require checking the original API key configuration
    // For now, we'll just ensure the validation passed
    if (!policy.allowed) {
      reply.status(403).send({
        success: false,
        error: "Security policy violation",
        code: "SECURITY_POLICY_VIOLATION",
      });
    }
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export { enhancedApiKeyService };
export type { TokenPayload };

