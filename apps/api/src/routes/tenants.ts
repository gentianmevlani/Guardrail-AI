/**
 * Multi-Tenant API Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { multiTenantService } from "../services/multi-tenant-service";
import { auditLogger } from "../services/audit-logger";
import { z } from "zod";
import { tenantMiddleware } from "../middleware/tenant";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

const PAID_PLANS = new Set(["starter", "pro", "compliance"]);

const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().min(1).max(255),
  plan: z.enum(["free", "starter", "pro", "compliance"]),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  domain: z.string().min(1).max(255).optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  plan: z.enum(["free", "starter", "pro", "compliance"]).optional(),
  settings: z
    .object({
      allowCustomDomains: z.boolean().optional(),
      allowSSO: z.boolean().optional(),
      allowAPIAccess: z.boolean().optional(),
      retentionDays: z.number().min(1).max(3650).optional(),
      securityLevel: z.enum(["basic", "standard", "high"]).optional(),
      notifications: z
        .object({
          email: z.boolean().optional(),
          slack: z.boolean().optional(),
          webhook: z.boolean().optional(),
        })
        .optional(),
      features: z
        .object({
          aiSuggestions: z.boolean().optional(),
          advancedScanning: z.boolean().optional(),
          realTimeCollaboration: z.boolean().optional(),
          customReports: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
});

const addUserToTenantSchema = z.object({
  userId: z.string(),
  role: z.enum(["owner", "admin", "member", "viewer"]),
});

async function createTenant(request: FastifyRequest, reply: FastifyReply) {
  try {
    const validated = createTenantSchema.parse(request.body);
    const userId = (request as any).userId || "anonymous";

    if (PAID_PLANS.has(validated.plan)) {
      reply.status(403).send({
        success: false,
        error:
          "Paid plans cannot be assigned through this API. Use Stripe checkout after the tenant exists.",
        code: "PLAN_REQUIRES_BILLING",
      });
      return;
    }

    const tenant = await multiTenantService.createTenant({
      name: validated.name,
      domain: validated.domain,
      plan: validated.plan,
      ownerId: userId,
    });

    // Log to audit
    await auditLogger.log({
      userId,
      action: "tenant_created",
      resource: tenant.id,
      resourceType: "tenant",
      outcome: "success",
      risk: "medium",
      category: "system",
      details: {
        tenantName: tenant.name,
        plan: tenant.plan,
      },
    });

    reply.code(201).send({
      success: true,
      data: tenant,
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to create tenant");
    reply.status(400).send({
      success: false,
      error: toErrorMessage(error) || "Failed to create tenant",
    });
  }
}

async function getTenant(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { tenantId } = request.params as { tenantId: string };
    const tenant = await multiTenantService.getTenant(tenantId);

    if (!tenant) {
      reply.status(404).send({
        success: false,
        error: "Tenant not found",
      });
      return;
    }

    reply.send({
      success: true,
      data: tenant,
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to get tenant");
    reply.status(500).send({
      success: false,
      error: "Failed to get tenant",
    });
  }
}

async function updateTenant(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { tenantId } = request.params as { tenantId: string };
    const updates = updateTenantSchema.parse(request.body);
    const userId = (request as any).userId || "anonymous";

    if (updates.plan && PAID_PLANS.has(updates.plan)) {
      reply.status(403).send({
        success: false,
        error:
          "Paid plans cannot be set through this API. Complete checkout in the app or use the billing portal.",
        code: "PLAN_REQUIRES_BILLING",
      });
      return;
    }

    const tenant = await multiTenantService.updateTenant(
      tenantId,
      updates as any,
    );

    if (!tenant) {
      reply.status(404).send({
        success: false,
        error: "Tenant not found",
      });
      return;
    }

    // Log to audit
    await auditLogger.log({
      userId,
      action: "tenant_updated",
      resource: tenantId,
      resourceType: "tenant",
      outcome: "success",
      risk: "medium",
      category: "system",
      details: updates,
    });

    reply.send({
      success: true,
      data: tenant,
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to update tenant");
    reply.status(400).send({
      success: false,
      error: toErrorMessage(error) || "Failed to update tenant",
    });
  }
}

async function deleteTenant(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { tenantId } = request.params as { tenantId: string };
    const userId = (request as any).userId || "anonymous";

    const success = await multiTenantService.deleteTenant(tenantId);

    if (!success) {
      reply.status(404).send({
        success: false,
        error: "Tenant not found",
      });
      return;
    }

    // Log to audit
    await auditLogger.log({
      userId,
      action: "tenant_deleted",
      resource: tenantId,
      resourceType: "tenant",
      outcome: "success",
      risk: "high",
      category: "system",
    });

    reply.send({
      success: true,
      message: "Tenant deleted successfully",
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to delete tenant");
    reply.status(500).send({
      success: false,
      error: "Failed to delete tenant",
    });
  }
}

async function getUserTenants(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId || "anonymous";
    const tenants = await multiTenantService.getUserTenants(userId);

    reply.send({
      success: true,
      data: tenants,
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to get user tenants");
    reply.status(500).send({
      success: false,
      error: "Failed to get user tenants",
    });
  }
}

async function addUserToTenant(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { tenantId } = request.params as { tenantId: string };
    const { userId, role } = addUserToTenantSchema.parse(request.body);
    const currentUserId = (request as any).userId || "anonymous";

    const success = await multiTenantService.addUserToTenant(
      userId,
      tenantId,
      role,
    );

    if (!success) {
      reply.status(404).send({
        success: false,
        error: "Tenant not found or user limit exceeded",
      });
      return;
    }

    // Log to audit
    await auditLogger.log({
      userId: currentUserId,
      action: "user_added_to_tenant",
      resource: tenantId,
      resourceType: "tenant",
      outcome: "success",
      risk: "medium",
      category: "system",
      details: { targetUserId: userId, role },
    });

    reply.send({
      success: true,
      message: "User added to tenant successfully",
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to add user to tenant");
    reply.status(400).send({
      success: false,
      error: toErrorMessage(error) || "Failed to add user to tenant",
    });
  }
}

async function removeUserFromTenant(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { tenantId, userId } = request.params as {
      tenantId: string;
      userId: string;
    };
    const currentUserId = (request as any).userId || "anonymous";

    const success = await multiTenantService.removeUserFromTenant(
      userId,
      tenantId,
    );

    if (!success) {
      reply.status(404).send({
        success: false,
        error: "Tenant or user not found",
      });
      return;
    }

    // Log to audit
    await auditLogger.log({
      userId: currentUserId,
      action: "user_removed_from_tenant",
      resource: tenantId,
      resourceType: "tenant",
      outcome: "success",
      risk: "medium",
      category: "system",
      details: { targetUserId: userId },
    });

    reply.send({
      success: true,
      message: "User removed from tenant successfully",
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to remove user from tenant");
    reply.status(500).send({
      success: false,
      error: "Failed to remove user from tenant",
    });
  }
}

async function getTenantUsage(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { tenantId } = request.params as { tenantId: string };
    const usage = await multiTenantService.getTenantUsage(tenantId);

    if (!usage) {
      reply.status(404).send({
        success: false,
        error: "Tenant not found",
      });
      return;
    }

    reply.send({
      success: true,
      data: usage,
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to get tenant usage");
    reply.status(500).send({
      success: false,
      error: "Failed to get tenant usage",
    });
  }
}

async function checkTenantLimit(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { tenantId } = request.params as { tenantId: string };
    const { action } = request.query as { action: string };

    const check = await multiTenantService.checkTenantLimit(
      tenantId,
      action as any,
    );

    reply.send({
      success: true,
      data: check,
    });
  } catch (error: unknown) {
    request.log.error({ error }, "Failed to check tenant limit");
    reply.status(500).send({
      success: false,
      error: "Failed to check tenant limit",
    });
  }
}

export async function tenantRoutes(fastify: FastifyInstance) {
  // Schemas are registered centrally in registerSchemas.ts

  // Apply tenant middleware to all routes
  fastify.addHook("preHandler", tenantMiddleware({ required: false }));

  // Tenant CRUD routes
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Tenants"],
        summary: "Create a new tenant",
        body: { $ref: "createTenant" },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
            },
          },
        },
      },
    },
    createTenant,
  );

  fastify.get(
    "/my",
    {
      schema: {
        tags: ["Tenants"],
        summary: "Get current user's tenants",
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
    },
    getUserTenants,
  );

  fastify.get(
    "/:tenantId",
    {
      schema: {
        tags: ["Tenants"],
        summary: "Get tenant by ID",
        params: {
          type: "object",
          properties: {
            tenantId: { type: "string" },
          },
          required: ["tenantId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
            },
          },
        },
      },
    },
    getTenant,
  );

  fastify.put(
    "/:tenantId",
    {
      schema: {
        tags: ["Tenants"],
        summary: "Update tenant",
        params: {
          type: "object",
          properties: {
            tenantId: { type: "string" },
          },
          required: ["tenantId"],
        },
        body: { $ref: "updateTenant" },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
            },
          },
        },
      },
    },
    updateTenant,
  );

  fastify.delete(
    "/:tenantId",
    {
      schema: {
        tags: ["Tenants"],
        summary: "Delete tenant",
        params: {
          type: "object",
          properties: {
            tenantId: { type: "string" },
          },
          required: ["tenantId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    deleteTenant,
  );

  // Tenant user management
  fastify.post(
    "/:tenantId/users",
    {
      schema: {
        tags: ["Tenants"],
        summary: "Add user to tenant",
        params: {
          type: "object",
          properties: {
            tenantId: { type: "string" },
          },
          required: ["tenantId"],
        },
        body: {
          type: "object",
          properties: {
            userId: { type: "string" },
            role: {
              type: "string",
              enum: ["owner", "admin", "member", "viewer"],
            },
          },
          required: ["userId", "role"],
        },
      },
    },
    addUserToTenant,
  );

  fastify.delete(
    "/:tenantId/users/:userId",
    {
      schema: {
        tags: ["Tenants"],
        summary: "Remove user from tenant",
        params: {
          type: "object",
          properties: {
            tenantId: { type: "string" },
            userId: { type: "string" },
          },
          required: ["tenantId", "userId"],
        },
      },
    },
    removeUserFromTenant,
  );

  // Tenant usage and limits
  fastify.get(
    "/:tenantId/usage",
    {
      schema: {
        tags: ["Tenants"],
        summary: "Get tenant usage statistics",
        params: {
          type: "object",
          properties: {
            tenantId: { type: "string" },
          },
          required: ["tenantId"],
        },
      },
    },
    getTenantUsage,
  );

  fastify.get(
    "/:tenantId/limits/check",
    {
      schema: {
        tags: ["Tenants"],
        summary: "Check if tenant can perform action",
        params: {
          type: "object",
          properties: {
            tenantId: { type: "string" },
          },
          required: ["tenantId"],
        },
        querystring: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["create_project", "run_scan", "api_call", "add_user"],
            },
          },
        },
      },
    },
    checkTenantLimit,
  );
}
