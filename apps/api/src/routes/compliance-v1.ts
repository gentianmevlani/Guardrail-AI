/**
 * Compliance Routes
 * 
 * API endpoints for GDPR, consent management, and legal acceptance.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
    acceptLegalDocument,
    checkAgeConfirmation,
    confirmAge,
    createDeletionJob,
    createExportJob,
    getConsentPreferences,
    getDeletionJobStatus,
    getExportJobStatus,
    getLegalAcceptanceStatus,
    hashIp,
    updateConsentPreferences,
} from "../services/compliance-service";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateConsentSchema = z.object({
  necessary: z.boolean().default(true),
  analytics: z.boolean().default(false),
  marketing: z.boolean().default(false),
  functional: z.boolean().default(false),
});

const acceptLegalSchema = z.object({
  docType: z.enum(['terms', 'privacy']),
  version: z.string().min(1),
  locale: z.string().optional(),
});

const confirmAgeSchema = z.object({
  age: z.number().min(13).max(120),
});

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    reply.status(401).send({
      success: false,
      error: "Authentication required",
    });
    return false;
  }
  return true;
}

// ============================================================================
// ROUTES
// ============================================================================

export async function complianceRoutes(fastify: FastifyInstance) {
  // ========================================================================
  // CONSENT MANAGEMENT
  // ========================================================================

  /**
   * GET /v1/consent
   * Get user's consent preferences
   */
  fastify.get("/consent", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const reqLogger = request.log;
    const user = request.user as any;

    try {
      const preferences = await getConsentPreferences(user.id);

      reqLogger.info({ userId: user.id }, "Retrieved consent preferences");

      reply.send({
        success: true,
        data: preferences || {
          necessary: true,
          analytics: false,
          marketing: false,
          functional: false,
        },
      });
    } catch (error) {
      const err = error as Error;
      reqLogger.error({ error: err.message, userId: user.id }, "Failed to get consent preferences");
      
      reply.status(500).send({
        success: false,
        error: "Failed to retrieve consent preferences",
      });
    }
  });

  /**
   * POST /v1/consent
   * Update user's consent preferences
   */
  fastify.post("/consent", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const reqLogger = request.log;
    const user = request.user as any;

    try {
      const validated = updateConsentSchema.parse(request.body);
      const ip = request.ip;
      
      const preferences = await updateConsentPreferences(user.id, validated, ip);

      reqLogger.info({ userId: user.id, preferences }, "Updated consent preferences");

      reply.send({
        success: true,
        data: preferences,
      });
    } catch (error) {
      const err = error as Error;
      reqLogger.error({ error: err.message, userId: user.id }, "Failed to update consent preferences");
      
      reply.status(500).send({
        success: false,
        error: "Failed to update consent preferences",
      });
    }
  });

  // ========================================================================
  // LEGAL ACCEPTANCE
  // ========================================================================

  /**
   * GET /v1/legal/status
   * Get legal acceptance status
   */
  fastify.get("/legal/status", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const reqLogger = request.log;
    const user = request.user as any;

    try {
      const status = await getLegalAcceptanceStatus(user.id);

      reqLogger.info({ userId: user.id }, "Retrieved legal acceptance status");

      reply.send({
        success: true,
        data: status,
      });
    } catch (error) {
      const err = error as Error;
      reqLogger.error({ error: err.message, userId: user.id }, "Failed to get legal acceptance status");
      
      reply.status(500).send({
        success: false,
        error: "Failed to retrieve legal acceptance status",
      });
    }
  });

  /**
   * POST /v1/legal/accept
   * Accept legal document
   */
  fastify.post("/legal/accept", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const reqLogger = request.log;
    const user = request.user as any;

    try {
      const validated = acceptLegalSchema.parse(request.body);
      const ip = request.ip;
      const userAgent = request.headers["user-agent"];
      
      const acceptance = await acceptLegalDocument(user.id, {
        docType: validated.docType,
        version: validated.version,
        userAgent,
        ipHash: ip ? hashIp(ip) : undefined,
        locale: validated.locale,
      }, ip);

      reqLogger.info({ 
        userId: user.id, 
        docType: validated.docType, 
        version: validated.version 
      }, "Accepted legal document");

      reply.send({
        success: true,
        data: acceptance,
      });
    } catch (error) {
      const err = error as Error;
      reqLogger.error({ error: err.message, userId: user.id }, "Failed to accept legal document");
      
      reply.status(500).send({
        success: false,
        error: "Failed to accept legal document",
      });
    }
  });

  // ========================================================================
  // GDPR EXPORT
  // ========================================================================

  /**
   * POST /v1/gdpr/export
   * Create GDPR export job
   */
  fastify.post("/gdpr/export", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const reqLogger = request.log;
    const user = request.user as any;

    try {
      const jobId = await createExportJob(user.id);

      reqLogger.info({ userId: user.id, jobId }, "Created GDPR export job");

      reply.send({
        success: true,
        data: { jobId },
      });
    } catch (error) {
      const err = error as Error;
      reqLogger.error({ error: err.message, userId: user.id }, "Failed to create export job");
      
      if (err.message === "Export job already in progress") {
        reply.status(409).send({
          success: false,
          error: "Export job already in progress",
        });
        return;
      }
      
      reply.status(500).send({
        success: false,
        error: "Failed to create export job",
      });
    }
  });

  /**
   * GET /v1/gdpr/export/:jobId
   * Get export job status
   */
  fastify.get("/gdpr/export/:jobId", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const reqLogger = request.log;
    const user = request.user as any;
    const { jobId } = request.params as { jobId: string };

    try {
      const status = await getExportJobStatus(user.id, jobId);

      reqLogger.info({ userId: user.id, jobId, status: status.status }, "Retrieved export job status");

      reply.send({
        success: true,
        data: status,
      });
    } catch (error) {
      const err = error as Error;
      reqLogger.error({ error: err.message, userId: user.id, jobId }, "Failed to get export job status");
      
      if (err.message === "Job not found") {
        reply.status(404).send({
          success: false,
          error: "Export job not found",
        });
        return;
      }
      
      reply.status(500).send({
        success: false,
        error: "Failed to retrieve export job status",
      });
    }
  });

  /**
   * GET /v1/gdpr/export/:jobId/download
   * Download export file
   */
  fastify.get("/gdpr/export/:jobId/download", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const reqLogger = request.log;
    const user = request.user as any;
    const { jobId } = request.params as { jobId: string };

    try {
      const status = await getExportJobStatus(user.id, jobId);

      if (status.status !== "completed") {
        reply.status(400).send({
          success: false,
          error: "Export not ready for download",
        });
        return;
      }

      // In production, serve the actual file from S3/CloudStorage
      // For now, return the JSON data directly
      reply.header("Content-Type", "application/json");
      reply.header("Content-Disposition", `attachment; filename="gdpr-export-${user.id}.json"`);
      
      // This would be the actual file content in production
      reply.send({
        success: true,
        message: "Download endpoint - implement file serving in production",
        downloadUrl: status.downloadUrl,
      });
    } catch (error) {
      const err = error as Error;
      reqLogger.error({ error: err.message, userId: user.id, jobId }, "Failed to download export");
      
      reply.status(500).send({
        success: false,
        error: "Failed to download export",
      });
    }
  });

  // ========================================================================
  // GDPR DELETION
  // ========================================================================

  /**
   * POST /v1/gdpr/delete
   * Create GDPR deletion job
   */
  fastify.post("/gdpr/delete", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const reqLogger = request.log;
    const user = request.user as any;

    try {
      const jobId = await createDeletionJob(user.id);

      reqLogger.warn({ userId: user.id, jobId }, "Created GDPR deletion job");

      reply.send({
        success: true,
        data: { jobId },
      });
    } catch (error) {
      const err = error as Error;
      reqLogger.error({ error: err.message, userId: user.id }, "Failed to create deletion job");
      
      if (err.message === "Deletion job already in progress") {
        reply.status(409).send({
          success: false,
          error: "Deletion job already in progress",
        });
        return;
      }
      
      reply.status(500).send({
        success: false,
        error: "Failed to create deletion job",
      });
    }
  });

  /**
   * GET /v1/gdpr/delete/:jobId
   * Get deletion job status
   */
  fastify.get("/gdpr/delete/:jobId", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const reqLogger = request.log;
    const user = request.user as any;
    const { jobId } = request.params as { jobId: string };

    try {
      const status = await getDeletionJobStatus(user.id, jobId);

      reqLogger.info({ userId: user.id, jobId, status: status.status }, "Retrieved deletion job status");

      reply.send({
        success: true,
        data: status,
      });
    } catch (error) {
      const err = error as Error;
      reqLogger.error({ error: err.message, userId: user.id, jobId }, "Failed to get deletion job status");
      
      if (err.message === "Job not found") {
        reply.status(404).send({
          success: false,
          error: "Deletion job not found",
        });
        return;
      }
      
      reply.status(500).send({
        success: false,
        error: "Failed to retrieve deletion job status",
      });
    }
  });

  // ========================================================================
  // AGE VERIFICATION
  // ========================================================================

  /**
   * POST /v1/age/confirm
   * Confirm user age
   */
  fastify.post("/age/confirm", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const reqLogger = request.log;
    const user = request.user as any;

    try {
      const validated = confirmAgeSchema.parse(request.body);
      
      await confirmAge(user.id, validated.age);

      reqLogger.info({ userId: user.id, age: validated.age }, "Confirmed user age");

      reply.send({
        success: true,
        message: "Age confirmed successfully",
      });
    } catch (error) {
      const err = error as Error;
      reqLogger.error({ error: err.message, userId: user.id }, "Failed to confirm age");
      
      if (err.message.includes("Age verification failed")) {
        reply.status(400).send({
          success: false,
          error: err.message,
        });
        return;
      }
      
      reply.status(500).send({
        success: false,
        error: "Failed to confirm age",
      });
    }
  });

  /**
   * GET /v1/age/status
   * Check age confirmation status
   */
  fastify.get("/age/status", {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const reqLogger = request.log;
    const user = request.user as any;

    try {
      const isConfirmed = await checkAgeConfirmation(user.id);

      reqLogger.info({ userId: user.id, isConfirmed }, "Checked age confirmation status");

      reply.send({
        success: true,
        data: { isAgeConfirmed: isConfirmed },
      });
    } catch (error) {
      const err = error as Error;
      reqLogger.error({ error: err.message, userId: user.id }, "Failed to check age confirmation status");
      
      reply.status(500).send({
        success: false,
        error: "Failed to check age confirmation status",
      });
    }
  });
}
