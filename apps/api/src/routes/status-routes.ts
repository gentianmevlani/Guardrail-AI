/**
 * Status & Incident Routes
 */

import { FastifyInstance } from "fastify";
import { requireAdmin } from "../middleware/auth";
import {
    createIncident,
    deleteIncident,
    getActiveIncidents,
    getAllIncidents,
    getMaintenanceStatus,
    getStatus,
    resolveIncident,
    toggleMaintenance
} from "./status";

export async function statusRoutes(fastify: FastifyInstance) {
  // Public endpoints
  fastify.get("/status", {
    handler: getStatus
  });

  fastify.get("/status/incident", {
    handler: getActiveIncidents
  });

  // Admin endpoints
  fastify.get("/admin/incidents", {
    preHandler: [requireAdmin],
    handler: getAllIncidents
  });

  fastify.post("/admin/incidents", {
    preHandler: [requireAdmin],
    handler: createIncident
  });

  fastify.put("/admin/incidents/:id/resolve", {
    preHandler: [requireAdmin],
    handler: resolveIncident
  });

  fastify.delete("/admin/incidents/:id", {
    preHandler: [requireAdmin],
    handler: deleteIncident
  });

  fastify.get("/admin/maintenance", {
    preHandler: [requireAdmin],
    handler: getMaintenanceStatus
  });

  fastify.post("/admin/maintenance/toggle", {
    preHandler: [requireAdmin],
    handler: toggleMaintenance
  });
}
