/**
 * Feedback Routes
 */

import { FastifyInstance } from "fastify";
import { requireAdmin, requireAuth } from "../middleware/auth";
import {
    deleteFeedback,
    getAllFeedback,
    getFeedback,
    getFeedbackStats,
    submitFeedback,
    updateFeedback
} from "./feedback";

export async function feedbackRoutes(fastify: FastifyInstance) {
  // Public endpoint for submitting feedback (auth optional)
  fastify.post("/feedback", {
    handler: submitFeedback
  });

  // Admin endpoints
  fastify.get("/admin/feedback", {
    preHandler: [requireAuth, requireAdmin],
    handler: getAllFeedback
  });

  fastify.get("/admin/feedback/stats", {
    preHandler: [requireAuth, requireAdmin],
    handler: getFeedbackStats
  });

  fastify.get("/admin/feedback/:id", {
    preHandler: [requireAuth, requireAdmin],
    handler: getFeedback
  });

  fastify.put("/admin/feedback/:id", {
    preHandler: [requireAuth, requireAdmin],
    handler: updateFeedback
  });

  fastify.delete("/admin/feedback/:id", {
    preHandler: [requireAuth, requireAdmin],
    handler: deleteFeedback
  });
}
