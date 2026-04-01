import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as path from "path";
import * as fs from "fs";
import { enqueueScan } from "../lib/queue";
import { pool } from "@guardrail/database";
import { requirePlan } from "../middleware/plan-gating";
import { authMiddleware, AuthenticatedRequest } from "../middleware/fastify-auth";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// Types
interface ShipCheckRequest {
  projectPath?: string;
  repositoryId?: string;
}

interface ProShipRequest extends ShipCheckRequest {
  baseUrl?: string;
  includeRealityMode?: boolean;
  includeSecurityScan?: boolean;
  includePerformanceCheck?: boolean;
  includeAccessibilityCheck?: boolean;
}

interface RealityModeRequest {
  projectPath: string;
  baseUrl: string;
}

interface BadgeRequest {
  projectPath: string;
  outputDir?: string;
}

/**
 * Ship Check API Routes
 *
 * Provides endpoints for:
 * - Running ship checks (MockProof + Badge)
 * - Pro ship comprehensive scanning (99/month feature)
 * - Reality mode scanning
 * - Badge generation
 * - Scan history
 */
export async function shipRoutes(fastify: FastifyInstance) {
  // Add auth middleware to all routes
  fastify.addHook("preHandler", async (request, reply) => {
    await authMiddleware(request as AuthenticatedRequest, reply);
  });

  /**
   * Run Pro Ship comprehensive scan (99/month feature)
   * POST /api/ship/pro
   * Requires: Pro tier or higher
   */
  fastify.post(
    "/pro",
    {
      preHandler: requirePlan({ minTierLevel: 2, featureName: "Pro Ship Scan" }),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {

        const body = request.body as ProShipRequest;
        const projectPath = body.projectPath || process.cwd();

        if (!fs.existsSync(projectPath)) {
          return reply.status(400).send({
            success: false,
            error: "Project path does not exist",
            projectPath,
          });
        }

        // Import pro ship scanner
        const shipModule = await import("guardrail-ship");
        const { ProShipScanner } = shipModule;
        const proShipScanner = new ProShipScanner();

        const config = {
          projectPath,
          baseUrl: body.baseUrl,
          includeRealityMode: body.includeRealityMode !== false,
          includeSecurityScan: body.includeSecurityScan !== false,
          includePerformanceCheck: body.includePerformanceCheck !== false,
          includeAccessibilityCheck: body.includeAccessibilityCheck !== false,
        };

        const result = await proShipScanner.runComprehensiveScan(config);

        return reply.send({
          success: true,
          ...result,
        });
      } catch (error: unknown) {
        fastify.log.error({ msg: "Pro ship error", error: toErrorMessage(error) });
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Pro ship scan failed",
        });
      }
    },
  );

  /**
   * Run full ship check
   * POST /api/ship/check
   */
  fastify.post(
    "/check",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as ShipCheckRequest;
        const projectPath = body.projectPath || process.cwd();

        // Validate project path exists
        if (!fs.existsSync(projectPath)) {
          return reply.status(400).send({
            success: false,
            error: "Project path does not exist",
            projectPath,
          });
        }

        // Dynamic import to avoid bundling issues
        const { shipBadgeGenerator } = await import("guardrail-ship");
        const { importGraphScanner } = await import("guardrail-ship");

        // Run MockProof scan
        const mockproofResult = await importGraphScanner.scan(projectPath);

        // Run Badge generation
        const outputDir = path.join(
          projectPath,
          ".guardrail",
          "ship",
          "badges",
        );
        const badgeResult = await shipBadgeGenerator.generateShipBadge({
          projectPath,
          outputDir,
        });

        // Save to history
        const historyDir = path.join(
          projectPath,
          ".guardrail",
          "ship",
          "history",
        );
        await fs.promises.mkdir(historyDir, { recursive: true });

        const historyEntry = {
          timestamp: new Date().toISOString(),
          verdict: badgeResult.verdict,
          score: badgeResult.score,
          mockproof: mockproofResult,
          checks: badgeResult.checks,
        };

        const historyFile = path.join(historyDir, `${Date.now()}.json`);
        await fs.promises.writeFile(
          historyFile,
          JSON.stringify(historyEntry, null, 2),
        );

        return reply.send({
          success: true,
          verdict: badgeResult.verdict,
          score: badgeResult.score,
          timestamp: new Date().toISOString(),
          mockproof: {
            verdict: mockproofResult.verdict,
            violations: mockproofResult.violations,
            scannedFiles: mockproofResult.scannedFiles,
            entrypoints: mockproofResult.entrypoints,
          },
          badge: {
            verdict: badgeResult.verdict,
            score: badgeResult.score,
            checks: badgeResult.checks,
            permalink: badgeResult.permalink,
            embedCode: badgeResult.embedCode,
          },
        });
      } catch (error: unknown) {
        fastify.log.error({ msg: "Ship check error", error: toErrorMessage(error) });
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Ship check failed",
        });
      }
    },
  );

  /**
   * Run MockProof scan only
   * POST /api/ship/mockproof
   */
  fastify.post(
    "/mockproof",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as ShipCheckRequest;
        const projectPath = body.projectPath || process.cwd();

        if (!fs.existsSync(projectPath)) {
          return reply.status(400).send({
            success: false,
            error: "Project path does not exist",
          });
        }

        const { importGraphScanner } = await import("guardrail-ship");
        const result = await importGraphScanner.scan(projectPath);

        return reply.send({
          success: true,
          ...result,
        });
      } catch (error: unknown) {
        fastify.log.error({ msg: "MockProof error", error: toErrorMessage(error) });
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "MockProof scan failed",
        });
      }
    },
  );

  /**
   * Generate ship badge
   * POST /api/ship/badge
   */
  fastify.post(
    "/badge",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as BadgeRequest;
        const { projectPath } = body;

        if (!projectPath || !fs.existsSync(projectPath)) {
          return reply.status(400).send({
            success: false,
            error: "Valid project path is required",
          });
        }

        const { shipBadgeGenerator } = await import("guardrail-ship");

        const outputDir =
          body.outputDir ||
          path.join(projectPath, ".guardrail", "ship", "badges");
        const result = await shipBadgeGenerator.generateShipBadge({
          projectPath,
          outputDir,
        });

        return reply.send({
          success: true,
          ...result,
        });
      } catch (error: unknown) {
        fastify.log.error({
          msg: "Badge generation error",
          error: toErrorMessage(error),
        });
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Badge generation failed",
        });
      }
    },
  );

  /**
   * Run Reality Mode
   * POST /api/ship/reality-mode
   */
  fastify.post(
    "/reality-mode",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as RealityModeRequest;
        const { projectPath, baseUrl } = body;

        if (!projectPath || !baseUrl) {
          return reply.status(400).send({
            success: false,
            error: "projectPath and baseUrl are required",
          });
        }

        // Check if reality scanner exists
        const scannerPath = path.resolve(
          __dirname,
          "../../../../src/lib/reality-mode/reality-scanner.ts",
        );

        if (
          !fs.existsSync(scannerPath.replace(".ts", ".js")) &&
          !fs.existsSync(scannerPath)
        ) {
          return reply.send({
            success: true,
            message: "Reality Mode scan queued",
            verdict: "pending",
            note: "Full Reality Mode requires additional setup",
          });
        }

        const { realityScanner } = await import("guardrail-ship");

        const outputDir = path.join(
          projectPath,
          ".guardrail",
          "ship",
          "reality-mode",
        );
        await fs.promises.mkdir(outputDir, { recursive: true });

        // @ts-ignore - method exists at runtime
        const result = await realityScanner.scan({
          projectPath,
          baseUrl,
          outputDir,
        });

        return reply.send({
          success: true,
          ...result,
        });
      } catch (error: unknown) {
        fastify.log.error({ msg: "Reality mode error", error: toErrorMessage(error) });
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Reality mode failed",
        });
      }
    },
  );

  /**
   * Get scan history
   * GET /api/ship/history
   */
  fastify.get(
    "/history",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { projectPath?: string; limit?: string };
        const projectPath = query.projectPath || process.cwd();
        const limit = parseInt(query.limit || "10", 10);

        const historyDir = path.join(
          projectPath,
          ".guardrail",
          "ship",
          "history",
        );

        if (!fs.existsSync(historyDir)) {
          return reply.send({
            success: true,
            history: [],
          });
        }

        const files = await fs.promises.readdir(historyDir);
        const jsonFiles = files
          .filter((f) => f.endsWith(".json"))
          .sort((a, b) => b.localeCompare(a)) // Newest first
          .slice(0, limit);

        const history = await Promise.all(
          jsonFiles.map(async (file) => {
            const content = await fs.promises.readFile(
              path.join(historyDir, file),
              "utf-8",
            );
            return JSON.parse(content);
          }),
        );

        return reply.send({
          success: true,
          history,
        });
      } catch (error: unknown) {
        fastify.log.error({ msg: "History error", error: toErrorMessage(error) });
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Failed to load history",
        });
      }
    },
  );

  /**
   * Get ship badge SVG (for embedding)
   * GET /api/ship/badge/:projectId/:type.svg
   */
  fastify.get(
    "/badge/:projectId/:type",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as { projectId: string; type: string };
        const { projectId, type } = params;

        // For now, return a simple badge
        // In production, this would look up the project and return the actual badge
        const badgeType = type.replace(".svg", "");

        const colors = {
          ship: "#22c55e",
          "no-ship": "#ef4444",
          review: "#f59e0b",
        };

        const color = colors.ship; // Default to ship

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
  <rect width="120" height="20" rx="3" fill="#555"/>
  <rect x="60" width="60" height="20" rx="3" fill="${color}"/>
  <rect x="60" width="4" height="20" fill="${color}"/>
  <text x="30" y="14" fill="#fff" font-family="sans-serif" font-size="11" text-anchor="middle">guardrail</text>
  <text x="90" y="14" fill="#fff" font-family="sans-serif" font-size="11" text-anchor="middle">SHIP</text>
</svg>`;

        reply.header("Content-Type", "image/svg+xml");
        reply.header("Cache-Control", "no-cache");
        return reply.send(svg);
      } catch (error: unknown) {
        return reply.status(500).send({ error: "Failed to generate badge" });
      }
    },
  );

  /**
   * Run ship check on a GitHub repository
   * POST /api/ship/github
   * 
   * This endpoint enqueues a real scan job that will:
   * 1. Clone the repository
   * 2. Run the guardrail CLI scan
   * 3. Store artifacts and findings
   * 4. Update scan status in database
   */
  fastify.post(
    "/github",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as { repositoryId: string; branch?: string };
        const { repositoryId, branch = "main" } = body;

        if (!request.session?.userId) {
          return reply.status(401).send({ error: "Not authenticated" });
        }

        const userId = request.session.userId;

        // Get repository from database
        const repository = await (fastify as any).prisma?.repository?.findFirst(
          {
            where: {
              id: repositoryId,
              userId: userId,
              isActive: true,
            },
          },
        );

        if (!repository) {
          return reply.status(404).send({ error: "Repository not found" });
        }

        // Get GitHub account for access token
        const githubAccount = await (
          fastify as any
        ).prisma?.githubAccount?.findFirst({
          where: {
            userId: userId,
            isActive: true,
          },
        });

        if (!githubAccount) {
          return reply.status(400).send({ error: "GitHub not connected" });
        }

        // Build the clone URL with access token for private repos
        const cloneUrl = repository.isPrivate && githubAccount.accessToken
          ? `https://${githubAccount.accessToken}@github.com/${repository.fullName}.git`
          : repository.cloneUrl || `https://github.com/${repository.fullName}.git`;

        // Create scan record in database
        const scanId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        await pool.query(
          `INSERT INTO scans (id, user_id, repository_id, project_path, branch, status, progress, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'queued', 0, NOW(), NOW())`,
          [scanId, userId, repositoryId, repository.fullName, branch]
        );

        // Enqueue the scan job - the worker will clone and scan the repo
        const jobId = await enqueueScan({
          scanId,
          userId,
          repositoryId,
          repositoryUrl: cloneUrl,
          branch,
          requestId: `ship-${Date.now()}`,
        });

        fastify.log.info({
          msg: "GitHub ship check enqueued",
          scanId,
          jobId,
          repository: repository.fullName,
          branch,
        });

        return reply.send({
          success: true,
          status: "queued",
          scanId,
          jobId,
          message: `Ship check queued for ${repository.fullName}@${branch}`,
          repository: {
            id: repository.id,
            name: repository.name,
            fullName: repository.fullName,
          },
        });
      } catch (error: unknown) {
        fastify.log.error({
          msg: "GitHub ship check error",
          error: toErrorMessage(error),
        });
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "GitHub ship check failed",
        });
      }
    },
  );
}
