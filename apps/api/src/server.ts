/**
 * guardrail API Server
 * Build: 2026-01-05-13h54m
 */
import helmet from "@fastify/helmet";
// @fastify/rate-limit removed - using unified tier-aware rate limiter instead
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { getEnv, isDevelopment } from "@guardrail/core";
import "dotenv/config";
import Fastify, {
  type FastifyBaseLogger,
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { logger } from "./logger";
import { initRateLimiter } from "./middleware/redis-rate-limiter";

// Import middleware
import { errorHandler } from "./middleware/error-handler";
import { registerExplicitCORS } from "./middleware/explicit-cors";
import { maintenanceMiddleware } from "./middleware/maintenance";
import { registerPerformanceMiddleware } from "./middleware/performance.js";
import { createSizeLimitMiddleware } from "./middleware/request-size-limits";
import { registerRequestTimeout } from "./middleware/request-timeout";
import { sanitizeInput } from "./middleware/sanitizeInput";
import { addRequestId } from "./middleware/telemetry";
import { handleGracefulShutdown } from "./utils/gracefulShutdown";
import { registerSchemas } from "./utils/registerSchemas";
import { toErrorMessage, getErrorStack } from "./utils/toErrorMessage";

// Performance middleware
import { apiVersioningPlugin } from "./middleware/api-versioning";
import { securityHardeningPlugin } from "./middleware/security-hardening";

// Import versioning system
import { registerLegacyRoutes, registerV1Routes } from "./routes/v1/index";

// Import routes (for legacy compatibility)
// AI Guardrails routes
// Security routes
// Compliance routes

// Import database from consolidated Prisma package
import { prisma } from "@guardrail/database";

// Import availability service
import {
  getHealthStatus,
  getLivenessStatus,
  getReadinessStatus,
  updateDegradedMode,
} from "./services/availability-service";

// Import plugins
import sessionPlugin from "./plugins/session";
import { websocketPlugin } from "./plugins/websocket";

// Validate environment variables (fail fast with readable errors)
const env = getEnv();
const { PORT, HOST, CORS_ORIGIN } = env;

/**
 * Build Fastify server
 */
export async function buildServer() {
  logger.info("Building guardrail API server...");

  const fastify = Fastify({
    logger: false, // We use our own logger
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "reqId",
    // Body size limits (can be overridden per route)
    bodyLimit: 1 * 1024 * 1024, // 1MB default
  });

  // Register schemas before routes load
  registerSchemas(fastify);

  // Register plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: isDevelopment() ? {
      // Relaxed CSP for development to allow Next.js React Refresh
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: [
          "'self'",
          "'unsafe-eval'", // Required for Next.js React Refresh in development
          "'unsafe-inline'", // Required for Next.js in development
          "https://www.googletagmanager.com",
          "https://connect.facebook.net",
          "https://js.stripe.com",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "http://localhost:3000",
          "http://localhost:5000",
          "http://localhost:5001",
        ],
        fontSrc: ["'self'", "data:"],
      },
    } : {
      // Strict CSP for production
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: [
          "'self'",
          "https://www.googletagmanager.com",
          "https://connect.facebook.net",
          "https://js.stripe.com",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
      },
    },
    hsts: isDevelopment() ? false : {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  // Fastify v5 requires explicit CORS registration with allowlist
  await registerExplicitCORS(fastify);

  // Register session plugin
  await fastify.register(sessionPlugin);

  // Swagger documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: "guardrail API",
        description: "AI-powered code security and guardrail platform",
        version: "1.0.0",
        contact: {
          name: "guardrail Support",
          url: "https://guardrail.dev",
          email: "support@guardrail.dev",
        },
        license: {
          name: "MIT",
          url: "https://opensource.org/licenses/MIT",
        },
      },
      servers: [
        {
          url: isDevelopment() ? `http://${HOST}:${PORT}` : `https://${HOST}`,
          description: isDevelopment()
            ? "Development server"
            : "Production server",
        },
      ],
      tags: [
        {
          name: "Authentication",
          description: "User authentication and authorization",
        },
        { name: "Projects", description: "Project management operations" },
        { name: "Security", description: "Security scanning and analysis" },
        {
          name: "Compliance",
          description: "Compliance checking and reporting",
        },
        { name: "AI Guardrails", description: "AI-powered code analysis" },
        { name: "Billing", description: "Subscription and billing management" },
        { name: "Profile", description: "User profile management" },
        { name: "Guardrails", description: "guardrail configurations" },
        { name: "Dashboard", description: "Dashboard data and metrics" },
        { name: "Health", description: "Health and status endpoints" },
      ],
      components: {
        securitySchemes: {
          Bearer: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "JWT token for authentication",
          },
        },
      },
      security: [{ Bearer: [] }],
    },
  });

  // Register Swagger UI
  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: false,
    uiHooks: {
      onRequest: (request, reply, done) => done(),
      preHandler: (request, reply, done) => done(),
    },
  });

  // Initialize unified tier-aware rate limiter (Redis-backed with in-memory fallback)
  // NOTE: No global rate limit is applied. Rate limits are per-route based on:
  // - Auth endpoints: IP-based (5 req/min)
  // - API endpoints: tier-based (free: 60/min, enterprise: 5000/min)
  // - Public endpoints: IP-based (30 req/min)
  await initRateLimiter({ redisUrl: process.env.REDIS_URL });

  // Add request context hook for sanitization
  // Add request ID middleware first (before other hooks)
  fastify.addHook("onRequest", addRequestId);

  fastify.addHook("preHandler", sanitizeInput);

  // Add telemetry middleware for observability
  const { telemetryMiddleware } = await import("./middleware/telemetry");
  fastify.addHook("preHandler", telemetryMiddleware());

  // Register size limit middleware for request body validation
  const sizeLimitMiddleware = createSizeLimitMiddleware({
    maxBodySize: 10 * 1024 * 1024, // 10MB global limit
    maxFileSize: 25 * 1024 * 1024, // 25MB per file
    maxFileCount: 10,
    maxTotalMultipartSize: 100 * 1024 * 1024, // 100MB multipart
  });
  fastify.addHook("preHandler", sizeLimitMiddleware);

  // Register performance middleware (compression, caching, pagination safety)
  await registerPerformanceMiddleware(fastify);

  // Register security hardening (JSON depth, SQL injection, content-type validation)
  await fastify.register(securityHardeningPlugin, {
    maxJsonDepth: 20,
    blockSqlInjection: true,
    logBlocked: true,
  });

  // Register API versioning
  await fastify.register(apiVersioningPlugin);

  // Register request timeout middleware
  await registerRequestTimeout(fastify, {
    defaultTimeoutMs: 30000, // 30 seconds for normal requests
    longRunningTimeoutMs: 120000, // 2 minutes for scans/analysis
  });

  // Register WebSocket plugin
  await fastify.register(websocketPlugin, {
    path: "/ws",
  });

  // Health check - comprehensive status
  fastify.get("/health", async () => {
    const health = await getHealthStatus();
    updateDegradedMode(health);
    return health;
  });

  // Liveness probe - for Kubernetes/container orchestration
  // Returns quickly, just checks if process is alive
  fastify.get("/health/live", async () => {
    return getLivenessStatus();
  });

  // Readiness probe - checks if service can accept traffic
  fastify.get("/health/ready", async (request, reply) => {
    const readiness = await getReadinessStatus();
    if (!readiness.ready) {
      reply.status(503);
    }
    return readiness;
  });

  // Detailed health for monitoring dashboards
  fastify.get("/health/detailed", async () => {
    const health = await getHealthStatus();
    updateDegradedMode(health);
    return {
      ...health,
      environment: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
      platform: process.platform,
    };
  });

  // OpenAPI JSON specification
  fastify.get("/api/openapi.json", async () => {
    return fastify.swagger();
  });

  // Add logging hooks
  fastify.addHook("onRequest", async (request: FastifyRequest, _reply: FastifyReply) => {
    const requestId = request.id;
    const requestLogger = logger.child({ requestId });

    request.log = requestLogger as FastifyBaseLogger;
    requestLogger.info(
      {
        method: request.method,
        url: request.url,
        userAgent: request.headers["user-agent"],
        ip: request.ip,
        query: request.query,
      },
      "Incoming request",
    );
  });

  fastify.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const responseTime = reply.elapsedTime;
    request.log.info(
      {
        statusCode: reply.statusCode,
        responseTime: Math.round(responseTime),
        contentLength: reply.getHeader("content-length"),
      },
      "Request completed",
    );
  });

  fastify.addHook("onError", async (request: FastifyRequest, reply: FastifyReply, error: FastifyError) => {
    request.log.error(
      {
        error: toErrorMessage(error),
        stack: getErrorStack(error),
        statusCode: reply?.statusCode,
      },
      "Request error",
    );
  });

  // Register maintenance mode middleware (applies to all routes)
  fastify.addHook("preHandler", maintenanceMiddleware);

  // Register API routes with versioning
  // New v1 endpoints (recommended)
  await fastify.register(registerV1Routes, { prefix: "/api/v1" });
  
  // Legacy endpoints for backward compatibility (with deprecation warnings)
  await fastify.register(registerLegacyRoutes);

  // Direct checkout endpoint (alternative to /api/billing/checkout)
  fastify.post("/api/checkout", async (request, reply) => {
    const { plan, priceId } = request.body as {
      plan?: string;
      priceId?: string;
    };
    const frontendUrl = process.env.FRONTEND_URL || "https://guardrail.dev";
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    // If no Stripe key, return helpful error (not mock success)
    if (!stripeSecretKey) {
      return reply.status(503).send({
        success: false,
        error: "Payment processing not configured",
        code: "STRIPE_NOT_CONFIGURED",
        message: "Please contact support to enable payments",
      });
    }

    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" });

      // Map plan to price ID
      const priceIds: Record<string, string | undefined> = {
        starter: process.env.STRIPE_PRICE_ID_STARTER,
        pro: process.env.STRIPE_PRICE_ID_PRO,
        compliance: process.env.STRIPE_PRICE_ID_COMPLIANCE,
        enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE,
      };

      const selectedPriceId = priceId || (plan ? priceIds[plan] : null);
      if (!selectedPriceId) {
        return reply.status(400).send({
          success: false,
          error: "Invalid plan or missing price configuration",
          code: "INVALID_PLAN",
        });
      }

      // Get user from request (if authenticated)
      const user = (request as any).user;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: selectedPriceId, quantity: 1 }],
        success_url: `${frontendUrl}/dashboard?checkout=success`,
        cancel_url: `${frontendUrl}/pricing?checkout=cancelled`,
        ...(user?.email && { customer_email: user.email }),
        metadata: {
          ...(user?.id && { userId: user.id }),
          ...(plan && { plan }),
        },
      });

      return reply.send({
        success: true,
        url: session.url,
        sessionId: session.id,
      });
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, "Stripe checkout error");
      return reply.status(500).send({
        success: false,
        error: "Failed to create checkout session",
        code: "CHECKOUT_FAILED",
      });
    }
  });

  // Error handler
  fastify.setErrorHandler(errorHandler);

  // Add security headers
  fastify.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-XSS-Protection", "1; mode=block");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.removeHeader("X-Powered-By");
    return payload;
  });

  // Ensure system user exists for anonymous GitHub scans (database is ready at this point)
  await ensureSystemUser();

  // Initialize cleanup jobs
  const { cleanupJobsService } = await import('./services/cleanup-jobs');
  cleanupJobsService.initialize();
  logger.info('Cleanup jobs service initialized');

  // Initialize cache service
  const { cacheService } = await import('./services/cache-service');
  await cacheService.initialize();
  logger.info('Cache service initialized');

  return fastify;
}

/**
 * Ensure system user exists for anonymous scans
 */
async function ensureSystemUser() {
  try {
    await prisma.user.upsert({
      where: { id: "system" },
      create: {
        id: "system",
        email: "system@guardrail.internal",
        name: "System",
        provider: "internal",
        providerId: "system",
        emailVerified: new Date(),
      },
      update: {},
    });
    logger.info("System user ensured for anonymous scans");
  } catch (error: unknown) {
    logger.warn(
      { error: toErrorMessage(error) },
      "Failed to ensure system user exists (may already exist)",
    );
  }
}
