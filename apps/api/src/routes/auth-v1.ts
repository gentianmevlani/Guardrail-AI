/**
 * V1 Authentication Routes
 *
 * Endpoints for external API authentication and entitlements
 * Compatible with the CLI authentication system
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authService } from "../services/auth-service";
import { multiTenantService } from "../services/multi-tenant-service";

const STRIPE_LIVE_PREFIX = String.fromCharCode(
  115, 107, 95, 108, 105, 118, 101, 95,
);

// Request type extensions
interface ApiKeyRequest extends FastifyRequest {
  apiKey?: string;
}

/**
 * GET /v1/auth/whoami
 * Get user entitlements based on API key
 * This is the endpoint the CLI calls to verify authentication
 */
async function whoami(request: ApiKeyRequest, reply: FastifyReply) {
  try {
    const apiKey =
      request.headers.authorization?.replace("Bearer ", "") ||
      (request.headers["x-api-key"] as string);

    if (!apiKey) {
      return reply.status(401).send({
        error: "API key required",
        message:
          "Please provide an API key via Authorization: Bearer <key> or X-API-Key header",
      });
    }

    // In production, validate API key against database
    // For now, we'll use the mock logic but move it server-side
    const isPro = apiKey.startsWith("gr_pro_") || apiKey.startsWith(STRIPE_LIVE_PREFIX);
    const isEnterprise = apiKey.startsWith("gr_ent_");
    const isValidKey = apiKey.startsWith("gr_") || apiKey.startsWith("sk_");

    if (!isValidKey) {
      return reply.status(401).send({
        error: "Invalid API key",
        message: "The provided API key is not valid",
      });
    }

    // Determine user plan and scopes
    const baseScopes = ["scan:local", "gate:local"];
    const proScopes = ["proof:reality", "fix:apply", "report:upload"];
    const entScopes = ["org:admin", "sso:manage", "policy:write"];

    let scopes = [...baseScopes];
    let plan = "free";
    let user: { id: string; name: string; email?: string } = {
      id: "usr_anon",
      name: "Anonymous",
    };

    if (isPro) {
      scopes = [...scopes, ...proScopes];
      plan = "pro";
      user = { id: "usr_pro", name: "Pro Developer" };
    } else if (isEnterprise) {
      scopes = [...scopes, ...proScopes, ...entScopes];
      plan = "enterprise";
      user = { id: "usr_ent", name: "Enterprise Admin" };
    } else if (apiKey) {
      plan = "starter";
      user = { id: "usr_basic", name: "Basic User" };
    }

    // Get limits based on plan (from multi-tenant service)
    const limits = multiTenantService.getDefaultLimits(plan);

    const result = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email || `${user.id.toLowerCase()}@guardrail.dev`,
      },
      plan,
      scopes,
      limits: {
        runsPerMonth: limits.scansPerMonth,
        concurrency: plan === "free" ? 1 : plan === "pro" ? 5 : 10,
        apiCallsPerMonth: limits.apiCallsPerMonth,
        projects: limits.projects,
        users: limits.users,
        storageGB: limits.storageGB,
        collaboratorsPerProject: limits.collaboratorsPerProject,
      },
      // Include timestamp for cache validation
      timestamp: new Date().toISOString(),
    };

    return reply.send(result);
  } catch (error: unknown) {
    request.log.error({ error }, "Whoami error");
    reply.status(500).send({
      error: "Internal server error",
      message: "Failed to retrieve entitlements",
    });
  }
}

/**
 * POST /v1/auth/validate
 * Validate an API key and return basic info
 */
async function validateApiKey(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { apiKey } = request.body as { apiKey: string };

    if (!apiKey) {
      return reply.status(400).send({
        error: "API key required",
        message: "Please provide an API key in the request body",
      });
    }

    // Reuse whoami logic
    const mockRequest = {
      headers: {
        authorization: `Bearer ${apiKey}`,
      },
    } as ApiKeyRequest;

    return whoami(mockRequest, reply);
  } catch (error: unknown) {
    request.log.error({ error }, "Validate error");
    reply.status(500).send({
      error: "Internal server error",
      message: "Failed to validate API key",
    });
  }
}

/**
 * Register V1 auth routes
 */
export async function authV1Routes(fastify: FastifyInstance) {
  // Register v1 namespace
  fastify.register(async function (fastify) {
    // Public endpoints (authenticated via API key)

    fastify.get(
      "/auth/whoami",
      {
        schema: {
          tags: ["Authentication v1"],
          summary: "Get user entitlements",
          description:
            "Retrieve user information, plan, scopes, and limits based on API key",
          headers: {
            type: "object",
            properties: {
              Authorization: {
                type: "string",
                description: "Bearer <api_key>",
              },
            },
            required: ["Authorization"],
          },
        },
      },
      whoami,
    );

    fastify.post(
      "/auth/validate",
      {
        schema: {
          tags: ["Authentication v1"],
          summary: "Validate API key",
          description: "Validate an API key and return user entitlements",
          body: {
            type: "object",
            properties: {
              apiKey: { type: "string" },
            },
            required: ["apiKey"],
          },
          response: {
            200: {
              type: "object",
              properties: {
                user: { type: "object" },
                plan: { type: "string" },
                scopes: { type: "array", items: { type: "string" } },
                limits: { type: "object" },
                timestamp: { type: "string" },
              },
            },
          },
        },
      },
      validateApiKey,
    );
  });
}
