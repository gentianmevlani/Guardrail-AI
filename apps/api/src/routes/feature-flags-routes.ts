/**
 * Feature Flags Routes
 */

import { FastifyInstance } from "fastify";
import { requireAdmin, requireAuth } from "../middleware/auth";
import {
    createFlag,
    deleteFlag,
    getAllFlags,
    getFlags,
    toggleFlag,
    updateFlag
} from "./feature-flags";

export async function featureFlagRoutes(fastify: FastifyInstance) {
  // Public endpoint for getting evaluated flags (requires auth)
  fastify.get("/flags", {
    preHandler: [requireAuth],
    handler: getFlags
  });

  // Admin endpoints
  fastify.get("/admin/flags", {
    preHandler: [requireAuth, requireAdmin],
    handler: getAllFlags
  });

  fastify.post("/admin/flags", {
    preHandler: [requireAuth, requireAdmin],
    handler: createFlag
  });

  fastify.put("/admin/flags/:key", {
    preHandler: [requireAuth, requireAdmin],
    handler: updateFlag
  });

  fastify.delete("/admin/flags/:key", {
    preHandler: [requireAuth, requireAdmin],
    handler: deleteFlag
  });

  fastify.post("/admin/flags/:key/toggle", {
    preHandler: [requireAuth, requireAdmin],
    handler: toggleFlag
  });
}
