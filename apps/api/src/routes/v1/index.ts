/**
 * API v1 Routes - Versioned endpoints with backward compatibility
 *
 * This module registers all API endpoints with /api/v1/* prefix structure.
 * Legacy routes are maintained for backward compatibility with deprecation warnings.
 */

import { FastifyInstance } from "fastify";
import { securityEventsRoutes } from "../../routes/admin/security-events";
import { agentRoutes } from "../../routes/agents";
import { apiKeysRoutes } from "../../routes/api-keys";
import { attackSurfaceRoutes } from "../../routes/attack-surface";
import { auditRoutes } from "../../routes/audit";
import { authV1Routes } from "../../routes/auth-v1";
import { authRoutes } from "../../routes/auth-fastify";
import { autopilotRoutes } from "../../routes/autopilot";
import { billingRoutes } from "../../routes/billing";
import { collaborationRoutes } from "../../routes/collaboration";
import { complianceRoutes } from "../../routes/compliance";
import { complianceRoutes as complianceV1Routes } from "../../routes/compliance-v1";
import { containerRoutes } from "../../routes/container";
import { dashboardRoutes } from "../../routes/dashboard";
import { deployHooksRoutes } from "../../routes/deploy-hooks";
import { findingsRoutes } from "../../routes/findings";
import { githubRoutes } from "../../routes/github";
import { guardrailsRoutes } from "../../routes/guardrails";
import { iacRoutes } from "../../routes/iac";
import { injectionRoutes } from "../../routes/injection";
import { intelligenceRoutes } from "../../routes/intelligence";
import { licenseRoutes } from "../../routes/license";
import { mcpWrapperRoutes } from "../../routes/mcp-wrapper";
import { mfaRoutes } from "../../routes/mfa";
import { metricsRoutes } from "../../routes/metrics";
import { notificationRoutes } from "../../routes/notifications";
import { onboardingRoutes } from "../../routes/onboarding";
import { organizationRoutes } from "../../routes/organizations";
import { piiRoutes } from "../../routes/pii";
import { policiesRoutes } from "../../routes/policies";
import { productionIntegrityRoutes } from "../../routes/production-integrity";
import { profileRoutes } from "../../routes/profile";
import { projectRoutes } from "../../routes/projects";
import { realityCheckRoutes } from "../../routes/reality-check";
import { reportRoutes } from "../../routes/reports";
import { runsRoutes } from "../../routes/runs";
import { sandboxRoutes } from "../../routes/sandbox";
import { scanRoutes } from "../../routes/scans";
import { scheduledScanRoutes } from "../../routes/scheduled-scans";
import { secretsRoutes } from "../../routes/secrets";
import { securityRoutes } from "../../routes/security";
import { settingsRoutes } from "../../routes/settings";
import { shipRoutes } from "../../routes/ship";
import { fixesRoutes } from "../../routes/fixes";
import { enhancedGuardrailRoutes } from "../../routes/enhanced-guardrail";
import { badgeRoutes } from "../../routes/badge";
import { streamingRoutes } from "../../routes/streaming";
import { supplyChainRoutes } from "../../routes/supply-chain";
import { teamRoutes } from "../../routes/team";
import { tenantRoutes } from "../../routes/tenants";
import { usageRoutes } from "../../routes/usage";
import { validationRoutes } from "../../routes/validation";
import { webhookRoutes } from "../../routes/webhooks";
import { trustScorePublicRoutes } from "../../routes/trust-score-public";

/**
 * Register all v1 API routes with proper versioning
 *
 * DEPRECATION PLAN:
 * - Legacy /api/* routes will be maintained until v2.0 (estimated 6 months)
 * - New clients should use /api/v1/* endpoints
 * - Legacy routes will return deprecation headers after v1.5
 */
export async function registerV1Routes(fastify: FastifyInstance) {
  // Core API endpoints
  fastify.register(authV1Routes, { prefix: "/auth" });
  fastify.register(projectRoutes, { prefix: "/projects" });
  fastify.register(scanRoutes, { prefix: "/scans" });
  fastify.register(scheduledScanRoutes, { prefix: "/scheduled-scans" });
  
  // Scan comparison
  const { scanComparisonRoutes } = await import("../../routes/scan-comparison");
  fastify.register(scanComparisonRoutes, { prefix: "/scans" });
  
  fastify.register(billingRoutes, { prefix: "/billing" });
  fastify.register(usageRoutes, { prefix: "/usage" });
  fastify.register(organizationRoutes, { prefix: "/organizations" });
  fastify.register(teamRoutes, { prefix: "/team" });
  fastify.register(apiKeysRoutes, { prefix: "/api-keys" });

  // Admin & Support Ops (SECURE: Admin only)
  fastify.register(securityEventsRoutes, { prefix: "/admin" });

  // AI and Analysis endpoints
  fastify.register(agentRoutes, { prefix: "/agents" });
  fastify.register(complianceRoutes, { prefix: "/compliance" });
  fastify.register(intelligenceRoutes, { prefix: "/intelligence" });
  fastify.register(auditRoutes, { prefix: "/audit" });
  fastify.register(injectionRoutes, { prefix: "/injection" });
  fastify.register(validationRoutes, { prefix: "/validation" });
  fastify.register(sandboxRoutes, { prefix: "/sandbox" });

  // Security endpoints
  fastify.register(securityRoutes, { prefix: "/security" });
  fastify.register(secretsRoutes, { prefix: "/secrets" });
  fastify.register(supplyChainRoutes, { prefix: "/supply-chain" });
  fastify.register(licenseRoutes, { prefix: "/license" });
  fastify.register(attackSurfaceRoutes, { prefix: "/attack-surface" });

  // Compliance and Governance
  fastify.register(iacRoutes, { prefix: "/iac" });
  fastify.register(piiRoutes, { prefix: "/pii" });
  fastify.register(containerRoutes, { prefix: "/container" });
  fastify.register(collaborationRoutes, { prefix: "/collaboration" });
  fastify.register(tenantRoutes, { prefix: "/tenants" });
  fastify.register(policiesRoutes, { prefix: "/policies" });
  fastify.register(complianceV1Routes, { prefix: "/legal" });

  // Dashboard and Reporting
  fastify.register(dashboardRoutes, { prefix: "/dashboard" });
  fastify.register(findingsRoutes, { prefix: "/findings" });
  fastify.register(guardrailsRoutes, { prefix: "/guardrails" });
  fastify.register(profileRoutes, { prefix: "/profile" });
  fastify.register(reportRoutes, { prefix: "/reports" });
  fastify.register(settingsRoutes, { prefix: "/settings" });
  fastify.register(metricsRoutes, { prefix: "/metrics" });

  // Product Features
  fastify.register(shipRoutes, { prefix: "/ship" });
  fastify.register(autopilotRoutes, { prefix: "/autopilot" });
  fastify.register(realityCheckRoutes, { prefix: "/reality-check" });
  fastify.register(fixesRoutes, { prefix: "/fixes" });
  
  // Enhanced guardrail Features
  fastify.register(enhancedGuardrailRoutes, { prefix: "/enhanced-guardrail" });

  // Integration and Infrastructure
  fastify.register(streamingRoutes, { prefix: "/stream" });
  fastify.register(mcpWrapperRoutes, { prefix: "/mcp" });
  fastify.register(githubRoutes, { prefix: "/github" });
  fastify.register(deployHooksRoutes, { prefix: "/deploy-hooks" });
  fastify.register(productionIntegrityRoutes, {
    prefix: "/production-integrity",
  });
  fastify.register(notificationRoutes, { prefix: "/notifications" });
  fastify.register(onboardingRoutes, { prefix: "/onboarding" });
  
  // Multi-Factor Authentication
  fastify.register(mfaRoutes, { prefix: "/mfa" });
  
  // Webhooks (no auth required - uses signature verification)
  fastify.register(webhookRoutes, { prefix: "/webhooks" });

  // Public Trust Score — badges, leaderboard, score API (no auth for reads)
  fastify.register(trustScorePublicRoutes, { prefix: "/" });
}

/**
 * Register legacy routes with deprecation warnings
 * These maintain backward compatibility for existing clients
 */
export async function registerLegacyRoutes(fastify: FastifyInstance) {
  // Add deprecation warning hook for legacy routes
  fastify.addHook("onRequest", async (request, reply) => {
    if (
      request.url.startsWith("/api/") &&
      !request.url.startsWith("/api/v1/")
    ) {
      reply.header(
        "X-API-Deprecation-Warning",
        "This endpoint is deprecated. Please migrate to /api/v1/* endpoints.",
      );
      reply.header("Sunset", "2026-07-01"); // Estimated deprecation date
    }
  });

  // Register all existing routes with legacy prefixes for backward compatibility
  fastify.register(authRoutes, { prefix: "/api/auth" });
  fastify.register(projectRoutes, { prefix: "/api/projects" });
  fastify.register(scanRoutes, { prefix: "/api/scans" });
  fastify.register(scheduledScanRoutes, { prefix: "/api/scheduled-scans" });
  fastify.register(billingRoutes, { prefix: "/api/billing" });
  fastify.register(usageRoutes, { prefix: "/api/usage" });
  fastify.register(organizationRoutes, { prefix: "/api/organizations" });
  fastify.register(teamRoutes, { prefix: "/api/team" });
  fastify.register(apiKeysRoutes, { prefix: "/api" }); // Existing pattern
  fastify.register(agentRoutes, { prefix: "/api/agents" });
  fastify.register(complianceRoutes, { prefix: "/api/compliance" });
  fastify.register(dashboardRoutes, { prefix: "/api/dashboard" });
  fastify.register(findingsRoutes, { prefix: "/api/findings" });
  fastify.register(guardrailsRoutes, { prefix: "/api/guardrails" });
  fastify.register(profileRoutes, { prefix: "/api/profile" });
  fastify.register(reportRoutes, { prefix: "/api/reports" });
  fastify.register(settingsRoutes, { prefix: "/api/settings" });
  fastify.register(securityRoutes, { prefix: "/api/security" });
  fastify.register(shipRoutes, { prefix: "/api/ship" });
  fastify.register(enhancedGuardrailRoutes, { prefix: "/api/enhanced-guardrail" });
  fastify.register(badgeRoutes, { prefix: "/api" });
  fastify.register(autopilotRoutes, { prefix: "/api/autopilot" });
  fastify.register(realityCheckRoutes, { prefix: "/api/reality-check" });
  fastify.register(intelligenceRoutes, { prefix: "/api/intelligence" });
  fastify.register(auditRoutes, { prefix: "/api/audit" });
  fastify.register(injectionRoutes, { prefix: "/api/injection" });
  fastify.register(validationRoutes, { prefix: "/api/validation" });
  fastify.register(sandboxRoutes, { prefix: "/api/sandbox" });
  fastify.register(secretsRoutes, { prefix: "/api/secrets" });
  fastify.register(supplyChainRoutes, { prefix: "/api/supply-chain" });
  fastify.register(licenseRoutes, { prefix: "/api/license" });
  fastify.register(attackSurfaceRoutes, { prefix: "/api/attack-surface" });
  fastify.register(iacRoutes, { prefix: "/api/iac" });
  fastify.register(piiRoutes, { prefix: "/api/pii" });
  fastify.register(containerRoutes, { prefix: "/api/container" });
  fastify.register(collaborationRoutes, { prefix: "/api/collaboration" });
  fastify.register(tenantRoutes, { prefix: "/api/tenants" });
  fastify.register(policiesRoutes, { prefix: "/api/policies" });
  fastify.register(metricsRoutes, { prefix: "/metrics" }); // Existing pattern
  fastify.register(notificationRoutes, { prefix: "/api/notifications" });
  fastify.register(onboardingRoutes, { prefix: "/api/onboarding" });
  fastify.register(mfaRoutes, { prefix: "/api/mfa" });
  fastify.register(runsRoutes, { prefix: "/api/runs" });
  fastify.register(streamingRoutes, { prefix: "/api/stream" });
  fastify.register(mcpWrapperRoutes, { prefix: "/api/mcp" });
  fastify.register(githubRoutes, { prefix: "/api/auth" }); // GitHub OAuth endpoints
  fastify.register(deployHooksRoutes, { prefix: "/api/deploy-hooks" });
  fastify.register(productionIntegrityRoutes, {
    prefix: "/api/production-integrity",
  });
  
  // Webhooks (no auth required - uses signature verification)
  fastify.register(webhookRoutes, { prefix: "/api/webhooks" });
}
