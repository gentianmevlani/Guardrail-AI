/**
 * Prometheus Metrics Endpoint
 * 
 * Exposes application metrics in Prometheus format for monitoring
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { metrics } from "@guardrail/core";

export async function metricsRoutes(fastify: FastifyInstance) {
  /**
   * GET /metrics - Prometheus metrics endpoint
   * 
   * Returns metrics in Prometheus text format
   * This endpoint should NOT require authentication to allow Prometheus scraping
   */
  fastify.get(
    "/",
    {
      schema: {
        description: "Prometheus metrics endpoint",
        tags: ["Health"],
        response: {
          200: {
            type: "string",
            description: "Prometheus formatted metrics",
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Update system metrics before returning
      metrics.updateSystemMetrics();
      
      // Generate Prometheus output
      const output = metrics.generatePrometheusOutput();
      
      reply
        .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
        .send(output);
    }
  );

  /**
   * GET /metrics/json - JSON metrics endpoint
   * 
   * Returns metrics in JSON format for custom dashboards
   */
  fastify.get(
    "/json",
    {
      schema: {
        description: "JSON metrics endpoint",
        tags: ["Health"],
        response: {
          200: {
            type: "object",
            properties: {
              timestamp: { type: "string" },
              metrics: { type: "object" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      metrics.updateSystemMetrics();
      
      return {
        timestamp: new Date().toISOString(),
        metrics: {
          scans: {
            total: metrics.scansTotal.collect(),
          },
          injections: {
            detected: metrics.injectionsDetected.collect(),
          },
          vulnerabilities: {
            found: metrics.vulnerabilitiesFound.collect(),
            packages: metrics.vulnerablePackages.collect(),
          },
          secrets: {
            detected: metrics.secretsDetected.collect(),
          },
          compliance: {
            score: metrics.complianceScore.collect(),
            violations: metrics.complianceViolations.collect(),
          },
          api: {
            requests: metrics.apiRequestsTotal.collect(),
          },
          agents: {
            actions: metrics.agentActionsTotal.collect(),
            blocked: metrics.agentActionsBlocked.collect(),
          },
          cache: {
            hits: metrics.cacheHits.collect(),
            misses: metrics.cacheMisses.collect(),
          },
          system: {
            connections: metrics.activeConnections.collect(),
            memory: metrics.memoryUsageBytes.collect(),
          },
        },
      };
    }
  );
}
