/**
 * Feature Flags API Routes
 * 
 * Server-driven feature flags for gradual rollouts
 */

import { prisma } from "@guardrail/database";
import { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../logger";

interface FeatureFlagRequest extends FastifyRequest {
  body: {
    key: string;
    enabled?: boolean;
    rolloutPercent?: number;
    allowedUserIds?: string[];
    description?: string;
    metadata?: unknown;
  };
}

interface UpdateFlagRequest extends FastifyRequest {
  params: {
    key: string;
  };
  body: {
    enabled?: boolean;
    rolloutPercent?: number;
    allowedUserIds?: string[];
    description?: string;
    metadata?: unknown;
  };
}

/**
 * Evaluate if a flag should be enabled for the current user
 */
function shouldEnableFlag(flag: any, userId?: string): boolean {
  if (!flag.enabled) return false;
  
  // If user is specifically in allow list, always enable
  if (userId && flag.allowedUserIds.includes(userId)) {
    return true;
  }
  
  // If rollout is 100%, enable for everyone
  if (flag.rolloutPercent >= 100) {
    return true;
  }
  
  // If rollout is 0%, disable for everyone (except allow list above)
  if (flag.rolloutPercent <= 0) {
    return false;
  }
  
  // For percentage rollout, use consistent hash based on user ID or flag key
  const hashInput = userId || flag.key;
  const hash = simpleHash(hashInput);
  const bucket = hash % 100;
  
  return bucket < flag.rolloutPercent;
}

/**
 * Simple string hash function for consistent bucket assignment
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * GET /v1/flags - Get evaluated flags for current user
 */
export async function getFlags(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = (request as any).user;
    const userId = user?.id;
    
    // Get all flags from database
    const flags = await prisma.featureFlag.findMany({
      orderBy: { key: 'asc' }
    });
    
    // Evaluate each flag for the current user
    const evaluatedFlags = flags.reduce(
      (acc: Record<string, boolean>, flag: { key: string }) => {
        acc[flag.key] = shouldEnableFlag(flag, userId);
        return acc;
      },
      {} as Record<string, boolean>,
    );
    
    return reply.send({
      flags: evaluatedFlags,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error({ error }, "Failed to get feature flags");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to retrieve feature flags"
    });
  }
}

/**
 * GET /v1/admin/flags - Get all flags (admin only)
 */
export async function getAllFlags(request: FastifyRequest, reply: FastifyReply) {
  try {
    const flags = await prisma.featureFlag.findMany({
      orderBy: { key: 'asc' }
    });
    
    return reply.send({
      flags: flags,
      count: flags.length
    });
    
  } catch (error) {
    logger.error({ error }, "Failed to get all feature flags");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to retrieve feature flags"
    });
  }
}

/**
 * POST /v1/admin/flags - Create new feature flag (admin only)
 */
export async function createFlag(request: FeatureFlagRequest, reply: FastifyReply) {
  try {
    const { key, enabled = false, rolloutPercent = 0, allowedUserIds = [], description, metadata } = request.body;
    
    // Validate input
    if (!key || typeof key !== 'string') {
      return reply.status(400).send({
        error: "Bad request",
        message: "Flag key is required and must be a string"
      });
    }
    
    if (rolloutPercent < 0 || rolloutPercent > 100) {
      return reply.status(400).send({
        error: "Bad request", 
        message: "Rollout percentage must be between 0 and 100"
      });
    }
    
    // Check if flag already exists
    const existingFlag = await prisma.featureFlag.findUnique({
      where: { key }
    });
    
    if (existingFlag) {
      return reply.status(409).send({
        error: "Conflict",
        message: `Feature flag "${key}" already exists`
      });
    }
    
    // Create the flag
    const flag = await prisma.featureFlag.create({
      data: {
        key,
        enabled,
        rolloutPercent,
        allowedUserIds,
        description,
        metadata
      }
    });
    
    logger.info({ key, enabled, rolloutPercent }, "Created feature flag");
    
    return reply.status(201).send({
      flag,
      message: `Feature flag "${key}" created successfully`
    });
    
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error), flagKey: request.body.key, component: 'feature-flag-creation' }, "Failed to create feature flag");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to create feature flag"
    });
  }
}

/**
 * PUT /v1/admin/flags/:key - Update feature flag (admin only)
 */
export async function updateFlag(request: UpdateFlagRequest, reply: FastifyReply) {
  try {
    const { key } = request.params;
    const updates = request.body;
    
    // Validate rollout percentage if provided
    if (updates.rolloutPercent !== undefined && (updates.rolloutPercent < 0 || updates.rolloutPercent > 100)) {
      return reply.status(400).send({
        error: "Bad request",
        message: "Rollout percentage must be between 0 and 100"
      });
    }
    
    // Check if flag exists
    const existingFlag = await prisma.featureFlag.findUnique({
      where: { key }
    });
    
    if (!existingFlag) {
      return reply.status(404).send({
        error: "Not found",
        message: `Feature flag "${key}" not found`
      });
    }
    
    // Update the flag
    const flag = await prisma.featureFlag.update({
      where: { key },
      data: {
        ...updates,
        updatedAt: new Date()
      }
    });
    
    logger.info({ key, updates }, "Updated feature flag");
    
    return reply.send({
      flag,
      message: `Feature flag "${key}" updated successfully`
    });
    
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error), flagKey: request.params.key, component: 'feature-flag-update' }, "Failed to update feature flag");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to update feature flag"
    });
  }
}

/**
 * DELETE /v1/admin/flags/:key - Delete feature flag (admin only)
 */
export async function deleteFlag(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { key } = request.params as { key: string };
    
    // Check if flag exists
    const existingFlag = await prisma.featureFlag.findUnique({
      where: { key }
    });
    
    if (!existingFlag) {
      return reply.status(404).send({
        error: "Not found",
        message: `Feature flag "${key}" not found`
      });
    }
    
    // Delete the flag
    await prisma.featureFlag.delete({
      where: { key }
    });
    
    logger.info({ key }, "Deleted feature flag");
    
    return reply.send({
      message: `Feature flag "${key}" deleted successfully`
    });
    
  } catch (error) {
    logger.error({ error, params: request.params }, "Failed to delete feature flag");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to delete feature flag"
    });
  }
}

/**
 * POST /v1/admin/flags/:key/toggle - Quick toggle flag (admin only)
 */
export async function toggleFlag(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { key } = request.params as { key: string };
    
    // Check if flag exists
    const existingFlag = await prisma.featureFlag.findUnique({
      where: { key }
    });
    
    if (!existingFlag) {
      return reply.status(404).send({
        error: "Not found",
        message: `Feature flag "${key}" not found`
      });
    }
    
    // Toggle the flag
    const flag = await prisma.featureFlag.update({
      where: { key },
      data: {
        enabled: !existingFlag.enabled,
        updatedAt: new Date()
      }
    });
    
    logger.info({ key, enabled: flag.enabled }, "Toggled feature flag");
    
    return reply.send({
      flag,
      message: `Feature flag "${key}" ${flag.enabled ? 'enabled' : 'disabled'}`
    });
    
  } catch (error) {
    logger.error({ error, params: request.params }, "Failed to toggle feature flag");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to toggle feature flag"
    });
  }
}
