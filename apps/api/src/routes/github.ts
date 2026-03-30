// @ts-nocheck — GitHub REST payloads are loosely typed; narrow incrementally when touching this file.
import { pool } from "@guardrail/database";
import crypto from "crypto";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  apiFetch,
  FetchRetryExhaustedError,
  FetchTimeoutError,
  oauthFetch,
} from "../lib/fetch-with-timeout";
import { logger } from "../logger";
import { authMiddleware } from "../middleware/fastify-auth";

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;

async function generateOAuthState(sessionId: string): Promise<string> {
  const state = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(
    `INSERT INTO oauth_states (state, provider, session_id, expires_at)
     VALUES ($1, 'github_app', $2, $3)
     ON CONFLICT (state) DO UPDATE SET expires_at = $3`,
    [state, sessionId, expiresAt],
  );

  return state;
}

async function validateOAuthState(
  state: string,
  sessionId: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM oauth_states 
     WHERE state = $1 AND (session_id = $2 OR session_id IS NULL) AND expires_at > NOW()
     RETURNING id`,
    [state, sessionId],
  );

  return result.rows.length > 0;
}

async function cleanupExpiredOAuthStates(): Promise<void> {
  await pool.query(`DELETE FROM oauth_states WHERE expires_at < NOW()`);
}

setInterval(() => {
  cleanupExpiredOAuthStates().catch((error) => {
    logger.error(
      { error: error.message, stack: error.stack, component: 'oauth-cleanup' },
      'Failed to cleanup expired OAuth states'
    );
  });
}, 60000);

const githubAuthSchema = z.object({
  code: z.string(),
  state: z.string(),
  error: z.string().optional(),
});

// Extend FastifyRequest type to include session
declare module "fastify" {
  interface FastifyRequest {
    session?: {
      sessionId?: string;
      userId?: string;
    };
  }
}

// Add prisma to FastifyInstance
declare module "fastify" {
  interface FastifyInstance {
    prisma: any;
  }
}

export async function githubRoutes(fastify: FastifyInstance) {
  // Initiate GitHub OAuth flow
  fastify.post(
    "/connect",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!GITHUB_CLIENT_ID || !GITHUB_REDIRECT_URI) {
          fastify.log.error("GitHub OAuth not configured");
          return reply
            .status(500)
            .send({ error: "GitHub OAuth not configured" });
        }

        // Generate a random state for security
        const sessionId = request.session?.sessionId || "anonymous";
        const state = await generateOAuthState(sessionId);

        // Build GitHub OAuth URL
        const params = new URLSearchParams({
          client_id: GITHUB_CLIENT_ID,
          redirect_uri: GITHUB_REDIRECT_URI,
          scope: "repo user:email",
          state,
        });

        const githubUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

        return reply.send({ redirectUrl: githubUrl });
      } catch (error) {
        fastify.log.error({
          msg: "GitHub connect error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return reply
          .status(500)
          .send({ error: "Failed to initiate GitHub OAuth" });
      }
    },
  );

  // Handle GitHub OAuth callback
  fastify.get(
    "/callback",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any;
        const parsed = githubAuthSchema.safeParse(query);

        if (!parsed.success) {
          fastify.log.error({ msg: "Invalid OAuth callback parameters" });
          return reply.redirect(
            `${process.env.FRONTEND_URL}/dashboard?error=invalid_parameters`,
          );
        }

        const { code, state, error } = parsed.data;

        if (error) {
          fastify.log.error({ msg: "GitHub OAuth error", error });
          return reply.redirect(
            `${process.env.FRONTEND_URL}/dashboard?error=github_auth_failed`,
          );
        }

        // Verify state
        const sessionId = request.session?.sessionId || "anonymous";
        const isValidState = await validateOAuthState(state, sessionId);

        if (!isValidState) {
          fastify.log.error({ msg: "Invalid OAuth state" });
          return reply.redirect(
            `${process.env.FRONTEND_URL}/dashboard?error=invalid_state`,
          );
        }

        // Exchange code for access token (with timeout protection)
        let tokenResponse: Response;
        let tokenData: any;
        try {
          tokenResponse = await oauthFetch(
            "https://github.com/login/oauth/access_token",
            {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code: code,
                redirect_uri: GITHUB_REDIRECT_URI,
              }),
              logPrefix: "github-oauth-token",
            },
          );

          if (!tokenResponse.ok) {
            fastify.log.error({
              msg: "Token exchange failed",
              status: tokenResponse.statusText,
            });
            return reply.redirect(
              `${process.env.FRONTEND_URL}/dashboard?error=token_exchange_failed`,
            );
          }

          tokenData = await tokenResponse.json();
        } catch (error) {
          if (
            error instanceof FetchTimeoutError ||
            error instanceof FetchRetryExhaustedError
          ) {
            fastify.log.error({
              msg: "GitHub token exchange timeout",
              error: error.message,
            });
            return reply.redirect(
              `${process.env.FRONTEND_URL}/dashboard?error=github_timeout`,
            );
          }
          throw error;
        }

        if (!tokenData.access_token) {
          fastify.log.error({
            msg: "No access token in response",
            data: tokenData,
          });
          return reply.redirect(
            `${process.env.FRONTEND_URL}/dashboard?error=token_exchange_failed`,
          );
        }

        // Get user information (with timeout protection)
        let userData: any;
        try {
          const userResponse = await apiFetch("https://api.github.com/user", {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              "User-Agent": "guardrail",
            },
            logPrefix: "github-api-user",
          });

          if (!userResponse.ok) {
            fastify.log.error({
              msg: "Failed to get user info",
              status: userResponse.statusText,
            });
            return reply.redirect(
              `${process.env.FRONTEND_URL}/dashboard?error=user_info_failed`,
            );
          }

          userData = await userResponse.json();
        } catch (error) {
          if (
            error instanceof FetchTimeoutError ||
            error instanceof FetchRetryExhaustedError
          ) {
            fastify.log.error({
              msg: "GitHub user info timeout",
              error: error.message,
            });
            return reply.redirect(
              `${process.env.FRONTEND_URL}/dashboard?error=github_timeout`,
            );
          }
          throw error;
        }

        // Get user's repositories (with timeout protection)
        let reposData: unknown[];
        try {
          const reposResponse = await apiFetch(
            "https://api.github.com/user/repos?type=owner&sort=updated&per_page=100",
            {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                "User-Agent": "guardrail",
              },
              logPrefix: "github-api-repos",
            },
          );

          if (!reposResponse.ok) {
            fastify.log.error({
              msg: "Failed to get repositories",
              status: reposResponse.statusText,
            });
            return reply.redirect(
              `${process.env.FRONTEND_URL}/dashboard?error=repos_failed`,
            );
          }

          reposData = (await reposResponse.json()) as unknown[];
        } catch (error) {
          if (
            error instanceof FetchTimeoutError ||
            error instanceof FetchRetryExhaustedError
          ) {
            fastify.log.error({
              msg: "GitHub repos timeout",
              error: error.message,
            });
            return reply.redirect(
              `${process.env.FRONTEND_URL}/dashboard?error=github_timeout`,
            );
          }
          throw error;
        }

        // Store GitHub connection in database
        if (request.session?.userId) {
          await fastify.prisma.githubAccount.upsert({
            where: {
              userId: request.session.userId,
            },
            update: {
              githubId: userData.id.toString(),
              username: userData.login,
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              scope: tokenData.scope,
              tokenType: tokenData.token_type,
              isActive: true,
            },
            create: {
              userId: request.session.userId,
              githubId: userData.id.toString(),
              username: userData.login,
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              scope: tokenData.scope,
              tokenType: tokenData.token_type,
              isActive: true,
            },
          });

          // Store repositories
          for (const repo of reposData) {
            await fastify.prisma.repository.upsert({
              where: {
                githubId: repo.id.toString(),
              },
              update: {
                name: repo.name,
                fullName: repo.full_name,
                description: repo.description,
                isPrivate: repo.private,
                url: repo.html_url,
                cloneUrl: repo.clone_url,
                defaultBranch: repo.default_branch,
                language: repo.language,
                userId: request.session.userId,
                isActive: true,
              },
              create: {
                githubId: repo.id.toString(),
                name: repo.name,
                fullName: repo.full_name,
                description: repo.description,
                isPrivate: repo.private,
                url: repo.html_url,
                cloneUrl: repo.clone_url,
                defaultBranch: repo.default_branch,
                language: repo.language,
                userId: request.session.userId,
                isActive: true,
              },
            });
          }
        }

        // Redirect to dashboard with success
        return reply.redirect(
          `${process.env.FRONTEND_URL}/dashboard?github_connected=true`,
        );
      } catch (error) {
        fastify.log.error({
          msg: "GitHub callback error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return reply.redirect(
          `${process.env.FRONTEND_URL}/dashboard?error=github_callback_failed`,
        );
      }
    },
  );

  // Disconnect GitHub
  fastify.post(
    "/disconnect",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.session?.userId) {
          return reply.status(401).send({ error: "Not authenticated" });
        }

        // Deactivate GitHub account
        await fastify.prisma.githubAccount.updateMany({
          where: {
            userId: request.session.userId,
          },
          data: {
            isActive: false,
          },
        });

        // Deactivate repositories
        await fastify.prisma.repository.updateMany({
          where: {
            userId: request.session.userId,
          },
          data: {
            isActive: false,
          },
        });

        return reply.send({ success: true });
      } catch (error) {
        fastify.log.error({
          msg: "GitHub disconnect error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return reply.status(500).send({ error: "Failed to disconnect GitHub" });
      }
    },
  );

  // Get GitHub status
  fastify.get(
    "/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.session?.userId) {
          return reply.send({ connected: false });
        }

        const githubAccount = await fastify.prisma.githubAccount.findFirst({
          where: {
            userId: request.session.userId,
            isActive: true,
          },
          include: {
            repositories: {
              where: {
                isActive: true,
              },
            },
          },
        });

        if (!githubAccount) {
          return reply.send({ connected: false });
        }

        return reply.send({
          connected: true,
          username: githubAccount.username,
          repositories: githubAccount.repositories.map((repo) => ({
            id: repo.id,
            githubId: repo.githubId,
            name: repo.name,
            fullName: repo.fullName,
            description: repo.description,
            isPrivate: repo.isPrivate,
            url: repo.url,
            language: repo.language,
            lastScan: repo.lastScan?.toISOString() || null,
          })),
        });
      } catch (error) {
        fastify.log.error({
          msg: "GitHub status error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return reply.status(500).send({ error: "Failed to get GitHub status" });
      }
    },
  );

  // Get GitHub App installations status
  fastify.get(
    "/app/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const installations = await fastify.prisma.githubAppInstallation.findMany({
          where: {
            isActive: true,
          },
          include: {
            installedRepos: {
              where: {
                isActive: true,
              },
              orderBy: {
                updatedAt: "desc",
              },
            },
            webhookEvents: {
              orderBy: {
                receivedAt: "desc",
              },
              take: 1,
            },
          },
          orderBy: {
            lastWebhookAt: "desc",
          },
        });

        return reply.send({
          installations: installations.map((inst) => ({
            id: inst.id,
            installationId: inst.installationId.toString(),
            accountLogin: inst.accountLogin,
            accountType: inst.accountType,
            repositorySelection: inst.repositorySelection,
            repositoriesCount: inst.installedRepos.length,
            repositories: inst.installedRepos.map((repo) => ({
              id: repo.id,
              fullName: repo.fullName,
              name: repo.name,
              isPrivate: repo.isPrivate,
              defaultBranch: repo.defaultBranch,
              lastScanAt: repo.lastScanAt?.toISOString() || null,
            })),
            lastWebhookAt: inst.lastWebhookAt?.toISOString() || null,
            createdAt: inst.createdAt.toISOString(),
          })),
        });
      } catch (error) {
        fastify.log.error({
          msg: "GitHub App status error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return reply.status(500).send({ error: "Failed to get GitHub App status" });
      }
    },
  );

  // Get repositories list (for frontend syncGitHubRepos)
  fastify.get(
    "/github/repos",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.session?.userId) {
          return reply.send({
            success: true,
            data: {
              connected: false,
              repos: [],
              message: "Connect your GitHub account to see repositories",
            },
          });
        }

        const githubAccount = await fastify.prisma.githubAccount.findFirst({
          where: {
            userId: request.session.userId,
            isActive: true,
          },
        });

        if (!githubAccount) {
          return reply.send({
            success: true,
            data: {
              connected: false,
              repos: [],
              message: "GitHub not connected",
            },
          });
        }

        // Fetch repositories from database
        const repos = await fastify.prisma.repository.findMany({
          where: {
            userId: request.session.userId,
            isActive: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
        });

        return reply.send({
          success: true,
          data: {
            connected: true,
            username: githubAccount.username,
            repos: repos.map((repo: any) => ({
              id: repo.id,
              githubId: repo.githubId,
              name: repo.name,
              fullName: repo.fullName,
              description: repo.description,
              isPrivate: repo.isPrivate,
              url: repo.url,
              language: repo.language,
              lastScan: repo.lastScan?.toISOString() || null,
            })),
          },
        });
      } catch (error) {
        fastify.log.error({
          msg: "GitHub repos error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return reply.status(500).send({
          success: false,
          error: "Failed to get repositories",
        });
      }
    },
  );

  // Scan a GitHub repository
  fastify.post(
    "/github/scan",
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Authentication required",
          });
        }

        const { repo, branch } = request.body as {
          repo?: string;
          branch?: string;
        };

        if (!repo) {
          return reply.status(400).send({
            success: false,
            error: "Repository name is required",
          });
        }

        // Parse repo name (format: owner/repo)
        const [owner, repoName] = repo.split('/');
        if (!owner || !repoName) {
          return reply.status(400).send({
            success: false,
            error: "Invalid repository format. Expected: owner/repo",
          });
        }

        const prisma = (fastify as any).prisma;
        if (!prisma) {
          return reply.status(500).send({
            success: false,
            error: "Database not available",
          });
        }

        // Trigger real scan using the triggerScan function from webhooks
        try {
          const { triggerScan } = await import('./webhooks');
          
          // Trigger the scan (this will clone the repo and run security checks)
          const scanResult = await triggerScan(
            fastify,
            prisma,
            repo,
            branch || "main",
            undefined, // SHA - will use latest commit from branch
            undefined, // installationId - not needed for manual scans
            user.id
          );

          // Return scan results
          return reply.send({
            success: true,
            data: {
              scanId: scanResult.scanId,
              runId: scanResult.runId,
              repo,
              branch: branch || "main",
              status: "completed",
              findings: {
                total: scanResult.totalFindings,
                critical: scanResult.criticalCount,
                high: scanResult.highCount,
              },
              message: `Scan completed. Found ${scanResult.totalFindings} issues.`,
            },
          });

          // Create scan record in database
          const scan = await prisma.scan.findUnique({
            where: { id: scanResult.scanId },
            select: {
              id: true,
              status: true,
              verdict: true,
              score: true,
              filesScanned: true,
              issuesFound: true,
              startedAt: true,
              completedAt: true,
            },
          });

          return reply.send({
            success: true,
            data: {
              scanId: scanResult.scanId,
              runId: scanResult.runId,
              repo,
              branch: branch || "main",
              status: scan?.status || "completed",
              verdict: scan?.verdict,
              score: scan?.score,
              findings: {
                total: scanResult.totalFindings,
                critical: scanResult.criticalCount,
                high: scanResult.highCount,
              },
              filesScanned: scan?.filesScanned || 0,
              startedAt: scan?.startedAt,
              completedAt: scan?.completedAt,
            },
          });
        } catch (scanError: any) {
          fastify.log.error({
            error: scanError.message,
            stack: scanError.stack,
            repo,
            userId: user.id,
          }, "Scan execution failed");

          return reply.status(500).send({
            success: false,
            error: "Failed to execute scan",
            message: scanError.message,
          });
        }
      } catch (error) {
        fastify.log.error({
          msg: "GitHub scan error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return reply.status(500).send({
          success: false,
          error: "Failed to start scan",
        });
      }
    },
  );

  // Sync repositories
  fastify.post(
    "/sync",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.session?.userId) {
          return reply.status(401).send({ error: "Not authenticated" });
        }

        const githubAccount = await fastify.prisma.githubAccount.findFirst({
          where: {
            userId: request.session.userId,
            isActive: true,
          },
        });

        if (!githubAccount) {
          return reply.status(400).send({ error: "GitHub not connected" });
        }

        // Fetch repositories from GitHub (with timeout protection)
        let reposData: unknown[];
        try {
          const reposResponse = await apiFetch(
            "https://api.github.com/user/repos?type=owner&sort=updated&per_page=100",
            {
              headers: {
                Authorization: `Bearer ${githubAccount.accessToken}`,
                "User-Agent": "guardrail",
              },
              logPrefix: "github-api-sync-repos",
            },
          );

          if (!reposResponse.ok) {
            fastify.log.error({
              msg: "Failed to fetch repositories for sync",
              status: reposResponse.statusText,
            });
            return reply
              .status(502)
              .send({ error: "Failed to fetch repositories from GitHub" });
          }

          reposData = (await reposResponse.json()) as unknown[];
        } catch (error) {
          if (
            error instanceof FetchTimeoutError ||
            error instanceof FetchRetryExhaustedError
          ) {
            fastify.log.error({
              msg: "GitHub sync repos timeout",
              error: error.message,
            });
            return reply.status(504).send({ error: "GitHub API timeout" });
          }
          throw error;
        }

        // Update repositories in database
        for (const repo of reposData) {
          await fastify.prisma.repository.upsert({
            where: {
              githubId: repo.id.toString(),
            },
            update: {
              name: repo.name,
              fullName: repo.full_name,
              description: repo.description,
              isPrivate: repo.private,
              url: repo.html_url,
              cloneUrl: repo.clone_url,
              defaultBranch: repo.default_branch,
              language: repo.language,
              isActive: true,
            },
            create: {
              githubId: repo.id.toString(),
              name: repo.name,
              fullName: repo.full_name,
              description: repo.description,
              isPrivate: repo.private,
              url: repo.html_url,
              cloneUrl: repo.clone_url,
              defaultBranch: repo.default_branch,
              language: repo.language,
              userId: request.session.userId,
              isActive: true,
            },
          });
        }

        return reply.send({ success: true, synced: reposData.length });
      } catch (error) {
        fastify.log.error({
          msg: "GitHub sync error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return reply.status(500).send({ error: "Failed to sync repositories" });
      }
    },
  );
}
