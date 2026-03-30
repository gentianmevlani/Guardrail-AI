/**
 * Feedback API Routes
 * 
 * User feedback system with diagnostics capture
 */

import { prisma } from "@guardrail/database";
import { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../logger";

interface FeedbackRequest extends FastifyRequest {
  body: {
    category: string;
    severity: string;
    message: string;
    email?: string;
    route?: string;
    includeDiagnostics?: boolean;
    diagnostics?: unknown;
  };
}

interface UpdateFeedbackRequest extends FastifyRequest {
  params: {
    id: string;
  };
  body: {
    status?: string;
    assignedTo?: string;
    adminResponse?: string;
  };
}

/**
 * POST /v1/feedback - Submit feedback (auth optional)
 */
export async function submitFeedback(request: FeedbackRequest, reply: FastifyReply) {
  try {
    const user = (request as any).user;
    const userId = user?.id;
    const { category, severity, message, email, route, includeDiagnostics = false, diagnostics } = request.body;
    
    // Validate required fields
    if (!category || !severity || !message) {
      return reply.status(400).send({
        error: "Bad request",
        message: "Category, severity, and message are required"
      });
    }
    
    // Validate category
    const validCategories = ['bug', 'feature', 'ui', 'performance', 'other'];
    if (!validCategories.includes(category)) {
      return reply.status(400).send({
        error: "Bad request",
        message: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }
    
    // Validate severity
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      return reply.status(400).send({
        error: "Bad request",
        message: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`
      });
    }
    
    // Prepare diagnostics data if requested
    let diagnosticsData = null;
    if (includeDiagnostics) {
      const diagExtra =
        diagnostics != null &&
        typeof diagnostics === "object" &&
        !Array.isArray(diagnostics)
          ? (diagnostics as Record<string, unknown>)
          : {};
      diagnosticsData = {
        userAgent: request.headers['user-agent'],
        timestamp: new Date().toISOString(),
        route: route || (request as any).route?.url,
        ip: request.ip,
        ...diagExtra,
      };
    }
    
    // Create feedback entry
    const feedback = await prisma.feedback.create({
      data: {
        userId,
        category,
        severity,
        message,
        email: email || (user?.email),
        route: route || (request as any).route?.url,
        includeDiagnostics,
        diagnostics: diagnosticsData
      }
    });
    
    logger.info({ 
      feedbackId: feedback.id, 
      category, 
      severity, 
      userId: userId || 'anonymous' 
    }, "Feedback submitted");
    
    return reply.status(201).send({
      feedback: {
        id: feedback.id,
        category: feedback.category,
        severity: feedback.severity,
        status: feedback.status,
        createdAt: feedback.createdAt
      },
      message: "Feedback submitted successfully"
    });
    
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error), component: 'feedback-submission' }, "Failed to submit feedback");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to submit feedback"
    });
  }
}

/**
 * GET /v1/admin/feedback - Get all feedback (admin only)
 */
export async function getAllFeedback(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { status, category, severity, page = 1, limit = 50 } = request.query as any;
    
    const skip = (page - 1) * limit;
    const where: any = {};
    
    if (status) where.status = status;
    if (category) where.category = category;
    if (severity) where.severity = severity;
    
    const [feedback, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          user: {
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
      prisma.feedback.count({ where })
    ]);
    
    return reply.send({
      feedback,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    logger.error({ error, query: request.query }, "Failed to get feedback");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to retrieve feedback"
    });
  }
}

/**
 * GET /v1/admin/feedback/:id - Get specific feedback (admin only)
 */
export async function getFeedback(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    
    const feedback = await prisma.feedback.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    if (!feedback) {
      return reply.status(404).send({
        error: "Not found",
        message: "Feedback not found"
      });
    }
    
    return reply.send({ feedback });
    
  } catch (error) {
    logger.error({ error, params: request.params }, "Failed to get feedback");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to retrieve feedback"
    });
  }
}

/**
 * PUT /v1/admin/feedback/:id - Update feedback (admin only)
 */
export async function updateFeedback(request: UpdateFeedbackRequest, reply: FastifyReply) {
  try {
    const { id } = request.params;
    const { status, assignedTo, adminResponse } = request.body;
    const user = (request as any).user;
    
    // Check if feedback exists
    const existingFeedback = await prisma.feedback.findUnique({
      where: { id }
    });
    
    if (!existingFeedback) {
      return reply.status(404).send({
        error: "Not found",
        message: "Feedback not found"
      });
    }
    
    // Validate status if provided
    if (status) {
      const validStatuses = ['new', 'in_progress', 'resolved', 'closed'];
      if (!validStatuses.includes(status)) {
        return reply.status(400).send({
          error: "Bad request",
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
    }
    
    // Prepare update data
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (status) {
      updateData.status = status;
      if (status === 'resolved') {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = user.id;
      }
    }
    
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (adminResponse) updateData.adminResponse = adminResponse;
    
    // Update feedback
    const feedback = await prisma.feedback.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    logger.info({ 
      feedbackId: id, 
      status, 
      assignedTo, 
      updatedBy: user.id 
    }, "Feedback updated");
    
    return reply.send({
      feedback,
      message: "Feedback updated successfully"
    });
    
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error), feedbackId: request.params.id, component: 'feedback-update' }, "Failed to update feedback");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to update feedback"
    });
  }
}

/**
 * DELETE /v1/admin/feedback/:id - Delete feedback (admin only)
 */
export async function deleteFeedback(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    
    // Check if feedback exists
    const existingFeedback = await prisma.feedback.findUnique({
      where: { id }
    });
    
    if (!existingFeedback) {
      return reply.status(404).send({
        error: "Not found",
        message: "Feedback not found"
      });
    }
    
    // Delete feedback
    await prisma.feedback.delete({
      where: { id }
    });
    
    logger.info({ feedbackId: id }, "Feedback deleted");
    
    return reply.send({
      message: "Feedback deleted successfully"
    });
    
  } catch (error) {
    logger.error({ error, params: request.params }, "Failed to delete feedback");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to delete feedback"
    });
  }
}

/**
 * GET /v1/admin/feedback/stats - Get feedback statistics (admin only)
 */
export async function getFeedbackStats(request: FastifyRequest, reply: FastifyReply) {
  try {
    const [
      totalFeedback,
      statusBreakdown,
      categoryBreakdown,
      severityBreakdown,
      recentFeedback
    ] = await Promise.all([
      prisma.feedback.count(),
      prisma.feedback.groupBy({
        by: ['status'],
        _count: true
      }),
      prisma.feedback.groupBy({
        by: ['category'],
        _count: true
      }),
      prisma.feedback.groupBy({
        by: ['severity'],
        _count: true
      }),
      prisma.feedback.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      })
    ]);
    
    return reply.send({
      stats: {
        total: totalFeedback,
        recent: recentFeedback,
        byStatus: statusBreakdown.reduce(
          (acc: Record<string, number>, item: { status: string; _count: number }) => {
            acc[item.status] = item._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
        byCategory: categoryBreakdown.reduce(
          (acc: Record<string, number>, item: { category: string; _count: number }) => {
            acc[item.category] = item._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
        bySeverity: severityBreakdown.reduce(
          (acc: Record<string, number>, item: { severity: string; _count: number }) => {
            acc[item.severity] = item._count;
            return acc;
          },
          {} as Record<string, number>,
        ),
      }
    });
    
  } catch (error) {
    logger.error({ error }, "Failed to get feedback stats");
    return reply.status(500).send({
      error: "Internal server error",
      message: "Failed to retrieve feedback statistics"
    });
  }
}
