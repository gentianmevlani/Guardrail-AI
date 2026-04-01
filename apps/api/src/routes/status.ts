/**
 * Status Page & Incident Communication API Routes
 * 
 * Public status page and incident banner system
 */

import { prisma } from "@guardrail/database";
import { FastifyReply, FastifyRequest } from "fastify";
import { isMaintenanceMode } from "../config/secrets";
import { logger } from "../logger";

interface IncidentRequest extends FastifyRequest {
  body: {
    message: string;
    severity: string;
  };
}

interface UpdateIncidentRequest extends FastifyRequest {
  params: {
    id: string;
  };
  body: {
    status?: string;
    resolvedBy?: string;
  };
}

/**
 * GET /v1/status - Public status endpoint
 */
export async function getStatus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const maintenanceMode = isMaintenanceMode();
    
    // Get API health
    const apiHealth = {
      status: maintenanceMode ? 'maintenance' : 'healthy',
      timestamp: new Date().toISOString(),
      maintenance: maintenanceMode
    };
    
    // Get active incidents
    const activeIncidents = await prisma.incidentMessage.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    // Get build info (from environment or package.json)
    const buildInfo = {
      version: process.env.npm_package_version || '1.0.0',
      buildTime: process.env.BUILD_TIME || new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    return reply.send({
      status: {
        api: apiHealth,
        web: {
          status: maintenanceMode ? 'maintenance' : 'healthy',
          ...buildInfo
        },
        incidents: activeIncidents.map((incident: (typeof activeIncidents)[number]) => ({
          id: incident.id,
          message: incident.message,
          severity: incident.severity,
          createdAt: incident.createdAt
        }))
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error({ error }, "Failed to get status");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to retrieve status"
    });
  }
}

/**
 * GET /v1/status/incident - Get active incident messages (public)
 */
export async function getActiveIncidents(request: FastifyRequest, reply: FastifyReply) {
  try {
    const incidents = await prisma.incidentMessage.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        message: true,
        severity: true,
        createdAt: true
      }
    });
    
    return reply.send({
      incidents,
      count: incidents.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error({ error }, "Failed to get active incidents");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to retrieve incidents"
    });
  }
}

/**
 * GET /v1/admin/incidents - Get all incidents (admin only)
 */
export async function getAllIncidents(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { status, severity, page = 1, limit = 50 } = request.query as any;
    
    const skip = (page - 1) * limit;
    const where: any = {};
    
    if (status) where.status = status;
    if (severity) where.severity = severity;
    
    const [incidents, total] = await Promise.all([
      prisma.incidentMessage.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.incidentMessage.count({ where })
    ]);
    
    return reply.send({
      incidents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    logger.error({ error, query: request.query }, "Failed to get incidents");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to retrieve incidents"
    });
  }
}

/**
 * POST /v1/admin/incidents - Create incident message (admin only)
 */
export async function createIncident(request: IncidentRequest, reply: FastifyReply) {
  try {
    const user = (request as any).user;
    const { message, severity } = request.body;
    
    // Validate required fields
    if (!message || !severity) {
      return reply.status(400).send({
        error: "Bad request",
        message: "Message and severity are required"
      });
    }
    
    // Validate severity
    const validSeverities = ['info', 'warning', 'error', 'critical'];
    if (!validSeverities.includes(severity)) {
      return reply.status(400).send({
        error: "Bad request",
        message: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`
      });
    }
    
    // Create incident
    const incident = await prisma.incidentMessage.create({
      data: {
        message,
        severity,
        createdBy: user.id,
        status: 'active'
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    logger.info({ 
      incidentId: incident.id, 
      severity, 
      createdBy: user.id 
    }, "Incident created");
    
    return reply.status(201).send({
      incident,
      message: "Incident created successfully"
    });
    
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error), component: 'incident-creation' }, "Failed to create incident");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to create incident"
    });
  }
}

/**
 * PUT /v1/admin/incidents/:id/resolve - Resolve incident (admin only)
 */
export async function resolveIncident(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    
    // Check if incident exists and is active
    const existingIncident = await prisma.incidentMessage.findUnique({
      where: { id }
    });
    
    if (!existingIncident) {
      return reply.status(404).send({
        error: "Not found",
        message: "Incident not found"
      });
    }
    
    if (existingIncident.status === 'resolved') {
      return reply.status(400).send({
        error: "Bad request",
        message: "Incident is already resolved"
      });
    }
    
    // Resolve the incident
    const incident = await prisma.incidentMessage.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: user.id
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    logger.info({ 
      incidentId: id, 
      resolvedBy: user.id 
    }, "Incident resolved");
    
    return reply.send({
      incident,
      message: "Incident resolved successfully"
    });
    
  } catch (error) {
    logger.error({ error, params: request.params }, "Failed to resolve incident");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to resolve incident"
    });
  }
}

/**
 * DELETE /v1/admin/incidents/:id - Delete incident (admin only)
 */
export async function deleteIncident(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    
    // Check if incident exists
    const existingIncident = await prisma.incidentMessage.findUnique({
      where: { id }
    });
    
    if (!existingIncident) {
      return reply.status(404).send({
        error: "Not found",
        message: "Incident not found"
      });
    }
    
    // Delete incident
    await prisma.incidentMessage.delete({
      where: { id }
    });
    
    logger.info({ incidentId: id }, "Incident deleted");
    
    return reply.send({
      message: "Incident deleted successfully"
    });
    
  } catch (error) {
    logger.error({ error, params: request.params }, "Failed to delete incident");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to delete incident"
    });
  }
}

/**
 * GET /v1/admin/maintenance - Get maintenance mode status (admin only)
 */
export async function getMaintenanceStatus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const maintenanceMode = isMaintenanceMode();
    
    return reply.send({
      maintenance: {
        enabled: maintenanceMode,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error({ error }, "Failed to get maintenance status");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to retrieve maintenance status"
    });
  }
}

/**
 * POST /v1/admin/maintenance/toggle - Toggle maintenance mode (admin only)
 */
export async function toggleMaintenance(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = (request as any).user;
    const currentMode = isMaintenanceMode();
    const newMode = !currentMode;
    
    // Log the toggle
    logger.warn({ 
      previousMode: currentMode, 
      newMode, 
      toggledBy: user.id 
    }, "Maintenance mode toggled");
    
    // In a real implementation, you might update this in a database
    // or use a more sophisticated configuration management system
    // For now, this would require restarting the server with new env var
    
    return reply.send({
      maintenance: {
        enabled: newMode,
        timestamp: new Date().toISOString()
      },
      message: `Maintenance mode ${newMode ? 'enabled' : 'disabled'} (requires server restart with ${newMode ? 'MAINTENANCE_MODE=true' : 'MAINTENANCE_MODE=false'})`
    });
    
  } catch (error) {
    logger.error({ error }, "Failed to toggle maintenance mode");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to toggle maintenance mode"
    });
  }
}
