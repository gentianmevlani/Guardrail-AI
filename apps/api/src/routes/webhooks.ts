// @ts-nocheck — Webhook handlers mix filesystem, Prisma, and provider-specific payloads.
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { execSync } from "child_process";
import { getFrontendUrl } from "../config/secrets";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";
import {
  getInstallationOctokit,
  createCheckRun,
  updateCheckRun,
  createAnnotationsFromFindings,
  postPRComment,
  findExistingComment,
  updatePRComment,
  generatePRCommentSummary,
} from "../services/github-app-service";
import { realtimeEventsService } from "../services/realtime-events";

// Webhook secret for verification
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
interface GitHubWebhookPayload {
  action?: string;
  ref?: string;
  installation?: {
    id: number;
    account: {
      id: number;
      login: string;
      type: string;
    };
    repository_selection: string;
    permissions: Record<string, string>;
    events: string[];
  };
  repositories?: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    default_branch: string;
  }>;
  repository?: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    clone_url: string;
    default_branch: string;
    owner: {
      login: string;
    };
  };
  sender?: {
    login: string;
    id: number;
  };
  commits?: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  }>;
  head_commit?: {
    id: string;
    message: string;
  };
  pusher?: {
    name: string;
    email: string;
  };
  pull_request?: {
    number: number;
    title: string;
    state: string;
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
    };
  };
}

/**
 * Verify GitHub webhook signature using x-hub-signature-256
 */
function verifySignature(payload: string, signature: string | undefined): boolean {
  if (!GITHUB_WEBHOOK_SECRET || !signature) {
    return false;
  }

  // GitHub sends signature as "sha256=<hex>"
  if (!signature.startsWith("sha256=")) {
    return false;
  }

  const hmac = crypto.createHmac("sha256", GITHUB_WEBHOOK_SECRET);
  const digest = `sha256=${hmac.update(payload).digest("hex")}`;
  
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Hash payload for duplicate detection
 */
function hashPayload(payload: string): string {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * GitHub Webhook Routes
 * 
 * Handles incoming webhooks from GitHub for:
 * - Push events (trigger scans)
 * - Pull request events (add status checks)
 * - Installation events
 */
export async function webhookRoutes(fastify: FastifyInstance) {
  
  /**
   * GitHub webhook receiver
   * POST /api/webhooks/github
   */
  fastify.post("/github", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const signature = request.headers["x-hub-signature-256"] as string;
      const event = request.headers["x-github-event"] as string;
      const deliveryId = request.headers["x-github-delivery"] as string;

      // Get raw body for signature verification
      const rawBody = JSON.stringify(request.body);

      // Verify webhook signature - REQUIRED for security
      if (!GITHUB_WEBHOOK_SECRET) {
        fastify.log.warn({ deliveryId }, "GITHUB_WEBHOOK_SECRET not configured");
        return reply.status(500).send({ error: "Webhook secret not configured" });
      }

      if (!verifySignature(rawBody, signature)) {
        fastify.log.warn({ deliveryId }, "Invalid webhook signature");
        return reply.status(401).send({ error: "Invalid signature" });
      }

      const payload = request.body as GitHubWebhookPayload;
      const prisma = (fastify as any).prisma;

      if (!prisma) {
        fastify.log.error("Prisma client not available");
        return reply.status(500).send({ error: "Database not available" });
      }

      // Store webhook event for idempotency tracking
      const payloadHash = hashPayload(rawBody);
      const webhookEvent = await prisma.githubWebhookEvent.upsert({
        where: { deliveryId },
        create: {
          deliveryId,
          eventType: event,
          action: payload.action,
          sha: payload.pull_request?.head.sha || payload.head_commit?.id,
          prNumber: payload.pull_request?.number,
          ref: payload.ref,
          payloadHash,
          status: "received",
          installationId: payload.installation?.id
            ? await getInstallationIdFromGitHubId(prisma, payload.installation.id)
            : null,
          repositoryId: payload.repository?.id
            ? await getRepositoryIdFromGitHubId(prisma, payload.installation?.id, payload.repository.id)
            : null,
        },
        update: {
          // Update if delivery ID already exists (shouldn't happen, but handle gracefully)
          receivedAt: new Date(),
        },
      });

      fastify.log.info({
        event,
        deliveryId,
        repository: payload.repository?.full_name,
        installationId: payload.installation?.id,
      }, "Received GitHub webhook");

      // Handle different event types
      switch (event) {
        case "push":
          await handlePushEvent(fastify, prisma, payload, deliveryId, webhookEvent.id);
          break;

        case "pull_request":
          await handlePullRequestEvent(fastify, prisma, payload, deliveryId, webhookEvent.id);
          break;

        case "installation":
          await handleInstallationEvent(fastify, prisma, payload, deliveryId);
          break;

        case "installation_repositories":
          await handleInstallationRepositoriesEvent(fastify, prisma, payload, deliveryId);
          break;

        case "ping":
          fastify.log.info({ deliveryId }, "Received ping event");
          return reply.send({ received: true, event: "ping", message: "Webhook configured correctly" });

        default:
          fastify.log.info({ event, deliveryId }, "Unhandled webhook event");
          await prisma.githubWebhookEvent.update({
            where: { id: webhookEvent.id },
            data: { status: "skipped", error: `Unhandled event type: ${event}` },
          });
      }

      return reply.send({ received: true, event, deliveryId });
    } catch (error: unknown) {
      fastify.log.error({ msg: "Webhook error", error: toErrorMessage(error), stack: getErrorStack(error) });
      return reply.status(500).send({ error: "Webhook processing failed" });
    }
  });

  /**
   * Webhook status endpoint
   * GET /api/webhooks/status
   */
  fastify.get("/status", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      configured: !!GITHUB_WEBHOOK_SECRET,
      endpoints: {
        github: "/api/webhooks/github",
      },
    });
  });
}

/**
 * Get installation ID from GitHub installation ID
 */
async function getInstallationIdFromGitHubId(
  prisma: any,
  githubInstallationId: number
): Promise<string | null> {
  const installation = await prisma.githubAppInstallation.findUnique({
    where: { installationId: BigInt(githubInstallationId) },
    select: { id: true },
  });
  return installation?.id || null;
}

/**
 * Get repository ID from GitHub repository ID
 */
async function getRepositoryIdFromGitHubId(
  prisma: any,
  installationId: number | undefined,
  githubRepositoryId: number
): Promise<string | null> {
  if (!installationId) return null;

  const dbInstallationId = await getInstallationIdFromGitHubId(prisma, installationId);
  if (!dbInstallationId) return null;

  const repo = await prisma.githubAppRepository.findFirst({
    where: {
      installationId: dbInstallationId,
      repositoryId: BigInt(githubRepositoryId),
    },
    select: { id: true },
  });
  return repo?.id || null;
}

/**
 * Handle push events
 */
async function handlePushEvent(
  fastify: FastifyInstance,
  prisma: any,
  payload: GitHubWebhookPayload,
  deliveryId: string,
  webhookEventId: string
): Promise<void> {
  const { repository, ref, head_commit } = payload;

  if (!repository || !head_commit) {
    fastify.log.warn({ deliveryId }, "Push event missing repository or commit");
    return;
  }

  // Only process pushes to default branch
  const branch = ref?.replace("refs/heads/", "");
  if (branch !== repository.default_branch) {
    fastify.log.info({ 
      branch, 
      defaultBranch: repository.default_branch,
      deliveryId 
    }, "Skipping non-default branch push");
    await prisma.githubWebhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "skipped", error: "Non-default branch" },
    });
    return;
  }

  fastify.log.info({
    repository: repository.full_name,
    branch,
    commit: head_commit.id.slice(0, 7),
    deliveryId,
  }, "Processing push event");

  // Update webhook event status
  await prisma.githubWebhookEvent.update({
    where: { id: webhookEventId },
    data: { status: "processing" },
  });

  // Check if auto-scanning is enabled for this repository
  const installationId = payload.installation?.id;
  let dbRepoId: string | null = null;
  let autoScanEnabled = false;

  if (installationId) {
    const dbInstallationId = await getInstallationIdFromGitHubId(prisma, installationId);
    if (dbInstallationId) {
      dbRepoId = await getRepositoryIdFromGitHubId(prisma, installationId, repository.id);
      
      if (dbRepoId) {
        const repo = await prisma.githubAppRepository.findUnique({
          where: { id: dbRepoId },
        });
        autoScanEnabled = repo?.autoScanEnabled ?? true; // Default to enabled
      }
    }
  }

  // Update webhook event with repository ID
  if (dbRepoId) {
    await prisma.githubWebhookEvent.update({
      where: { id: webhookEventId },
      data: { repositoryId: dbRepoId },
    });
  }

  // Trigger scan if auto-scanning is enabled (default: enabled)
  if (autoScanEnabled !== false) {
    try {
      // Check for existing scan for this SHA to prevent duplicates
      const existingScan = await prisma.scan.findFirst({
        where: {
          commitSha: head_commit.id,
          repositoryId: dbRepoId || undefined,
          status: {
            in: ['queued', 'running'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (existingScan) {
        fastify.log.info({
          repository: repository.full_name,
          sha: head_commit.id.slice(0, 7),
          existingScanId: existingScan.id,
        }, 'Scan already in progress for this commit, skipping duplicate');
        
        // Link webhook event to existing scan
        await prisma.githubWebhookEvent.update({
          where: { id: webhookEventId },
          data: {
            status: "completed",
            processedAt: new Date(),
            runId: existingScan.id,
          },
        });
        return;
      }

      // Get userId from installation if available
      let userId: string | undefined;
      if (installationId) {
        const installation = await prisma.githubAppInstallation.findFirst({
          where: { installationId: BigInt(installationId) },
          include: { installation: true },
        });
        userId = installation?.userId || undefined;
      }

      // Trigger scan using existing triggerScan function
      const scanResult = await triggerScan(
        fastify,
        prisma,
        repository.full_name,
        branch,
        head_commit.id,
        installationId,
        userId
      );

      // Link webhook event to run
      await prisma.githubWebhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: "completed",
          processedAt: new Date(),
          runId: scanResult.runId,
        },
      });

      fastify.log.info({
        repository: repository.full_name,
        branch,
        runId: scanResult.runId,
        scanId: scanResult.scanId,
        findings: scanResult.totalFindings,
        deliveryId,
      }, "Push event scan completed successfully");
    } catch (error: unknown) {
      fastify.log.error({
        error: toErrorMessage(error),
        stack: getErrorStack(error),
        repository: repository.full_name,
        branch,
        deliveryId,
      }, "Failed to trigger scan from push event");

      await prisma.githubWebhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: "failed",
          error: toErrorMessage(error),
          processedAt: new Date(),
        },
      });
    }
  } else {
    fastify.log.info({
      repository: repository.full_name,
      deliveryId,
    }, "Auto-scanning disabled for repository, skipping scan");

    await prisma.githubWebhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: "skipped",
        error: "Auto-scanning disabled",
        processedAt: new Date(),
      },
    });
  }
}

/**
 * Handle pull request events
 */
async function handlePullRequestEvent(
  fastify: FastifyInstance,
  prisma: any,
  payload: GitHubWebhookPayload,
  deliveryId: string,
  webhookEventId: string
): Promise<void> {
  const { action, repository, pull_request, installation } = payload;

  if (!repository || !pull_request || !installation) {
    fastify.log.warn({ deliveryId }, "PR event missing required data");
    return;
  }

  // Only handle opened, synchronize, and reopened events
  if (!["opened", "synchronize", "reopened"].includes(action || "")) {
    fastify.log.info({ action, deliveryId }, "Skipping PR action");
    await prisma.githubWebhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "skipped", error: `Unhandled action: ${action}` },
    });
    return;
  }

  const sha = pull_request.head.sha;
  const [owner, repo] = repository.full_name.split("/");

  fastify.log.info({
    repository: repository.full_name,
    pr: pull_request.number,
    sha: sha.slice(0, 7),
    action,
    deliveryId,
  }, "Processing pull request event");

  // Check idempotency - have we already processed this SHA?
  const existingEvent = await prisma.githubWebhookEvent.findFirst({
    where: {
      sha,
      eventType: "pull_request",
      prNumber: pull_request.number,
      checkRunCreated: true,
      commentPosted: true,
      status: "completed",
    },
  });

  if (existingEvent && action === "synchronize") {
    // For synchronize events, we want to update the check run, not create a new one
    fastify.log.info({ sha, pr: pull_request.number }, "Updating existing check run for synchronize");
  } else if (existingEvent) {
    fastify.log.info({ sha, pr: pull_request.number }, "Already processed this SHA, skipping");
    await prisma.githubWebhookEvent.update({
      where: { id: webhookEventId },
      data: { status: "skipped", error: "Already processed" },
    });
    return;
  }

  // Update webhook event status
  await prisma.githubWebhookEvent.update({
    where: { id: webhookEventId },
    data: { status: "processing" },
  });

  try {
    // Get or create installation record
    const dbInstallationId = await getInstallationIdFromGitHubId(prisma, installation.id);
    if (!dbInstallationId) {
      throw new Error(`Installation ${installation.id} not found in database`);
    }

    // Get or create repository record
    let dbRepoId = await getRepositoryIdFromGitHubId(prisma, installation.id, repository.id);
    if (!dbRepoId) {
      // Create repository record
      const newRepo = await prisma.githubAppRepository.create({
        data: {
          installationId: dbInstallationId,
          repositoryId: BigInt(repository.id),
          fullName: repository.full_name,
          name: repository.name,
          isPrivate: repository.private,
          defaultBranch: repository.default_branch,
        },
      });
      dbRepoId = newRepo.id;
    }

    // Update webhook event with repository ID
    await prisma.githubWebhookEvent.update({
      where: { id: webhookEventId },
      data: { repositoryId: dbRepoId },
    });

    // Trigger scan (this would be async in production)
    const scanResult = await triggerScan(
      fastify,
      prisma,
      repository.full_name,
      pull_request.head.ref,
      sha,
      installation.id
    );

    // Create or update check run
    let checkRunId: number | null = null;
    const existingCheckRun = await prisma.githubCheckRun.findFirst({
      where: {
        repositoryId: dbRepoId,
        headSha: sha,
        prNumber: pull_request.number,
      },
    });

    const checkRunName = "guardrail Security Scan";
    const annotations = createAnnotationsFromFindings(
      scanResult.findings.map((f: any) => ({
        file: f.file,
        line: f.line || 0,
        endLine: f.endLine || f.line || 0,
        severity: f.severity,
        title: f.title || f.message,
        message: f.message,
      }))
    );

    const conclusion = scanResult.criticalCount > 0 ? "failure" : 
                      scanResult.totalFindings > 0 ? "neutral" : "success";

    if (existingCheckRun) {
      // Update existing check run
      await updateCheckRun(
        installation.id,
        owner,
        repo,
        Number(existingCheckRun.checkRunId),
        "completed",
        conclusion,
        {
          title: checkRunName,
          summary: `Found ${scanResult.totalFindings} security findings (${scanResult.criticalCount} critical, ${scanResult.highCount} high)`,
          annotations: annotations.slice(0, 50), // GitHub limits to 50 annotations
        }
      );
      checkRunId = Number(existingCheckRun.checkRunId);
    } else {
      // Create new check run
      const checkRun = await createCheckRun(
        installation.id,
        owner,
        repo,
        sha,
        checkRunName,
        "completed",
        conclusion,
        {
          title: checkRunName,
          summary: `Found ${scanResult.totalFindings} security findings (${scanResult.criticalCount} critical, ${scanResult.highCount} high)`,
          annotations: annotations.slice(0, 50),
        },
        `guardrail-${scanResult.runId}`
      );
      checkRunId = checkRun.checkRunId;

      // Store check run in database
      await prisma.githubCheckRun.create({
        data: {
          checkRunId: BigInt(checkRunId),
          installationId: dbInstallationId,
          repositoryId: dbRepoId,
          headSha: sha,
          prNumber: pull_request.number,
          status: "completed",
          conclusion,
          title: checkRunName,
          summary: `Found ${scanResult.totalFindings} security findings`,
          annotationsCount: annotations.length,
          runId: scanResult.runId,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });
    }

    // Post or update PR comment
    const commentMarker = `<!-- guardrail-comment-${pull_request.number} -->`;
    const existingCommentId = await findExistingComment(
      installation.id,
      owner,
      repo,
      pull_request.number,
      commentMarker
    );

    const runUrl = `${getFrontendUrl()}/runs/${scanResult.runId}`;

    // Build trust score data for the PR comment if available
    let trustScoreData: Parameters<typeof generatePRCommentSummary>[3] | undefined;
    if (scanResult.trustScore) {
      const ts = scanResult.trustScore;
      // Look up previous score from main branch for delta
      let delta: number | undefined;
      let previousScore: number | undefined;
      try {
        const mainScore = await prisma.publicTrustScore.findFirst({
          where: { org: owner, repo, branch: repository.default_branch },
          orderBy: { computedAt: 'desc' },
          select: { score: true },
        });
        if (mainScore) {
          previousScore = mainScore.score;
          delta = ts.overall - mainScore.score;
        }
      } catch {
        // No previous score available, that's fine
      }

      trustScoreData = {
        score: ts.overall,
        verdict: ts.decision,
        grade: ts.grade,
        delta,
        previousScore,
        dimensions: ts.dimensions,
      };
    }

    const commentBody = generatePRCommentSummary(
      scanResult.findings.map((f: any) => ({
        severity: f.severity,
        category: f.category || f.type || 'general',
        title: f.title || f.message,
        file: f.file,
        line: f.line || 0,
      })),
      scanResult.runId,
      runUrl,
      trustScoreData
    ) + `\n\n${commentMarker}`;

    if (existingCommentId) {
      await updatePRComment(installation.id, owner, repo, existingCommentId, commentBody);
    } else {
      await postPRComment(installation.id, owner, repo, pull_request.number, commentBody);
    }

    // Update webhook event
    await prisma.githubWebhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: "completed",
        processedAt: new Date(),
        checkRunCreated: true,
        commentPosted: true,
        runId: scanResult.runId,
      },
    });

    fastify.log.info({
      repository: repository.full_name,
      pr: pull_request.number,
      checkRunId,
      runId: scanResult.runId,
    }, "PR check run and comment created successfully");

  } catch (error: unknown) {
    fastify.log.error({
      error: toErrorMessage(error),
      stack: getErrorStack(error),
      repository: repository.full_name,
      pr: pull_request.number,
    }, "Failed to process PR event");

    await prisma.githubWebhookEvent.update({
      where: { id: webhookEventId },
      data: {
        status: "failed",
        error: toErrorMessage(error),
        processedAt: new Date(),
      },
    });
  }
}

/**
 * Handle GitHub App installation events
 */
async function handleInstallationEvent(
  fastify: FastifyInstance,
  prisma: any,
  payload: GitHubWebhookPayload,
  deliveryId: string
): Promise<void> {
  const { action, installation } = payload;

  if (!installation) {
    fastify.log.warn({ deliveryId }, "Installation event missing installation data");
    return;
  }

  fastify.log.info({
    action,
    installationId: installation.id,
    account: installation.account.login,
    deliveryId,
  }, "Processing installation event");

  try {
    if (action === "created") {
      // Create installation record
      await prisma.githubAppInstallation.upsert({
        where: { installationId: BigInt(installation.id) },
        create: {
          installationId: BigInt(installation.id),
          accountId: BigInt(installation.account.id),
          accountLogin: installation.account.login,
          accountType: installation.account.type,
          repositorySelection: installation.repository_selection,
          permissions: installation.permissions,
          events: installation.events,
          isActive: true,
          lastWebhookAt: new Date(),
        },
        update: {
          accountLogin: installation.account.login,
          accountType: installation.account.type,
          repositorySelection: installation.repository_selection,
          permissions: installation.permissions,
          events: installation.events,
          isActive: true,
          lastWebhookAt: new Date(),
        },
      });

      fastify.log.info({ installationId: installation.id }, "Installation created/updated");
    } else if (action === "deleted") {
      // Mark installation as inactive
      await prisma.githubAppInstallation.updateMany({
        where: { installationId: BigInt(installation.id) },
        data: {
          isActive: false,
          suspendedAt: new Date(),
        },
      });

      fastify.log.info({ installationId: installation.id }, "Installation deleted");
    }
  } catch (error: unknown) {
    fastify.log.error({
      error: toErrorMessage(error),
      installationId: installation.id,
    }, "Failed to process installation event");
  }
}

/**
 * Handle installation_repositories events
 */
async function handleInstallationRepositoriesEvent(
  fastify: FastifyInstance,
  prisma: any,
  payload: GitHubWebhookPayload,
  deliveryId: string
): Promise<void> {
  const { action, installation, repositories_added, repositories_removed } = payload as any;

  if (!installation) {
    fastify.log.warn({ deliveryId }, "Installation repositories event missing installation data");
    return;
  }

  const dbInstallationId = await getInstallationIdFromGitHubId(prisma, installation.id);
  if (!dbInstallationId) {
    fastify.log.warn({ installationId: installation.id }, "Installation not found");
    return;
  }

  try {
    if (action === "added" && repositories_added) {
      // Add repositories
      for (const repo of repositories_added) {
        await prisma.githubAppRepository.upsert({
          where: {
            installationId_repositoryId: {
              installationId: dbInstallationId,
              repositoryId: BigInt(repo.id),
            },
          },
          create: {
            installationId: dbInstallationId,
            repositoryId: BigInt(repo.id),
            fullName: repo.full_name,
            name: repo.name,
            isPrivate: repo.private,
            defaultBranch: repo.default_branch || "main",
          },
          update: {
            fullName: repo.full_name,
            name: repo.name,
            isPrivate: repo.private,
            defaultBranch: repo.default_branch || "main",
            isActive: true,
          },
        });
      }
      fastify.log.info({ count: repositories_added.length }, "Repositories added");
    } else if (action === "removed" && repositories_removed) {
      // Remove repositories
      const repoIds = repositories_removed.map((r: any) => BigInt(r.id));
      await prisma.githubAppRepository.updateMany({
        where: {
          installationId: dbInstallationId,
          repositoryId: { in: repoIds },
        },
        data: { isActive: false },
      });
      fastify.log.info({ count: repositories_removed.length }, "Repositories removed");
    }
  } catch (error: unknown) {
    fastify.log.error({
      error: toErrorMessage(error),
      installationId: installation.id,
    }, "Failed to process installation repositories event");
  }
}

/**
 * Trigger a scan and create Scan record in database
 * Exported for use by other routes (e.g., manual GitHub scans)
 */
export async function triggerScan(
  fastify: FastifyInstance,
  prisma: any,
  repoFullName: string,
  branch: string,
  sha: string,
  installationId?: number,
  userId?: string
): Promise<{
  runId: string;
  scanId: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  findings: Array<{
    file: string;
    line: number;
    endLine?: number;
    severity: string;
    title: string;
    message: string;
    category?: string;
  }>;
}> {
  fastify.log.info({ repoFullName, branch, sha }, "Triggering scan");

  // Create Scan record
  const scan = await prisma.scan.create({
    data: {
      userId: userId || "system", // System user for webhook-triggered scans
      projectPath: repoFullName,
      branch,
      commitSha: sha,
      status: "running",
      progress: 0,
      startedAt: new Date(),
    },
  });

  let tempDir: string | null = null;
  const findings: Array<{
    file: string;
    line: number;
    endLine?: number;
    severity: string;
    title: string;
    message: string;
    category?: string;
  }> = [];

  try {
    // 1. Clone the repository at the specific SHA
    tempDir = path.join(process.cwd(), "tmp", `scan-${scan.id}-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    const [owner, repo] = repoFullName.split("/");
    const cloneUrl = `https://github.com/${repoFullName}.git`;

    fastify.log.info({ tempDir, cloneUrl, branch, sha }, "Cloning repository");

    // Clone repository
    try {
      execSync(`git clone --depth 1 --branch ${branch} "${cloneUrl}" "${tempDir}"`, {
        stdio: "pipe",
        timeout: 120000, // 2 minute timeout
      });

      // Checkout specific SHA if provided
      if (sha) {
        execSync(`git checkout ${sha}`, {
          cwd: tempDir,
          stdio: "pipe",
          timeout: 30000,
        });
      }
    } catch (cloneError: any) {
      fastify.log.warn({ error: cloneError.message }, "Failed to clone repository, continuing with basic scan");
      // Continue with basic file scanning if clone fails
    }

    // 2. Run basic security scan
    if (tempDir && await fs.access(tempDir).then(() => true).catch(() => false)) {
      findings.push(...await runBasicSecurityScan(tempDir, fastify));
    }

    // Update scan with results
    const criticalCount = findings.filter((f) => f.severity === "critical").length;
    const highCount = findings.filter((f) => f.severity === "high").length;
    const mediumCount = findings.filter((f) => f.severity === "medium").length;
    const lowCount = findings.filter((f) => f.severity === "low").length;

    // Count files scanned
    let filesScanned = 0;
    let linesScanned = 0;
    if (tempDir) {
      try {
        const files = await getAllFiles(tempDir);
        filesScanned = files.length;
        for (const file of files.slice(0, 100)) { // Limit to first 100 files for performance
          try {
            const content = await fs.readFile(file, "utf-8");
            linesScanned += content.split("\n").length;
          } catch (fileError) {
            fastify.log.warn({ file, error: fileError }, "Failed to read file for line count");
          }
        }
      } catch (dirError) {
        fastify.log.warn({ directory: dir, error: dirError }, "Failed to read directory for scanning");
      }
    }

    // Emit final progress
    realtimeEventsService.emitProgress(runId, effectiveUserId, 100);
    
    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: "completed",
        progress: 100,
        verdict: criticalCount > 0 ? "fail" : findings.length > 0 ? "review" : "pass",
        score: Math.max(0, 100 - (criticalCount * 20 + highCount * 10 + mediumCount * 5 + lowCount * 1)),
        filesScanned,
        linesScanned,
        issuesFound: findings.length,
        criticalCount,
        warningCount: highCount + mediumCount,
        infoCount: lowCount,
        completedAt: new Date(),
        durationMs: Date.now() - scan.startedAt.getTime(),
      },
    });

    // Emit completion status
    realtimeEventsService.emitStatus(runId, effectiveUserId, "complete");
    realtimeEventsService.emitLog(runId, effectiveUserId, `Scan completed: ${findings.length} findings (${criticalCount} critical, ${highCount} high)`);

    // Store findings if any
    if (findings.length > 0) {
      await prisma.finding.createMany({
        data: findings.map((finding) => ({
          scanId: scan.id,
          type: finding.category || "security",
          severity: finding.severity,
          category: finding.category || "security",
          file: finding.file.replace(tempDir || "", "").replace(/^[\/\\]/, ""),
          line: finding.line,
          column: 0,
          endLine: finding.endLine || finding.line,
          endColumn: 0,
          title: finding.title,
          message: finding.message,
          status: "open",
        })),
      });
    }

    return {
      runId: scan.id,
      scanId: scan.id,
      totalFindings: findings.length,
      criticalCount,
      highCount,
      findings,
    };
  } catch (error: unknown) {
    fastify.log.error({ error: toErrorMessage(error), stack: getErrorStack(error) }, "Scan failed");
    
    // Emit error status
    const errorMessage = toErrorMessage(error) || "Unknown error";
    realtimeEventsService.emitStatus(runId, effectiveUserId, "error", errorMessage);
    realtimeEventsService.emitLog(runId, effectiveUserId, `Scan failed: ${errorMessage}`);
    
    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: "failed",
        error: toErrorMessage(error),
        completedAt: new Date(),
        durationMs: Date.now() - scan.startedAt.getTime(),
      },
    });

    return {
      runId: scan.id,
      scanId: scan.id,
      totalFindings: 0,
      criticalCount: 0,
      highCount: 0,
      findings: [],
    };
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        fastify.log.warn({ error: cleanupError, tempDir }, "Failed to cleanup temp directory");
      }
    }
  }
}

/**
 * Run basic security scan on cloned repository
 */
async function runBasicSecurityScan(
  projectPath: string,
  fastify: FastifyInstance
): Promise<Array<{
  file: string;
  line: number;
  endLine?: number;
  severity: string;
  title: string;
  message: string;
  category?: string;
}>> {
  const findings: Array<{
    file: string;
    line: number;
    endLine?: number;
    severity: string;
    title: string;
    message: string;
    category?: string;
  }> = [];

  const securityPatterns = [
    {
      pattern: /(api[_-]?key|apikey)\s*[:=]\s*['"]([^'"]{10,})['"]/i,
      severity: "critical" as const,
      title: "Hardcoded API Key",
      message: "API key found in source code",
      category: "secrets",
    },
    {
      pattern: /(password|pwd|passwd)\s*[:=]\s*['"]([^'"]{6,})['"]/i,
      severity: "critical" as const,
      title: "Hardcoded Password",
      message: "Password found in source code",
      category: "secrets",
    },
    {
      pattern: /(secret|token)\s*[:=]\s*['"]([^'"]{10,})['"]/i,
      severity: "high" as const,
      title: "Hardcoded Secret",
      message: "Secret or token found in source code",
      category: "secrets",
    },
    {
      pattern: /eval\s*\(/i,
      severity: "high" as const,
      title: "Unsafe eval() Usage",
      message: "eval() can execute arbitrary code",
      category: "code-quality",
    },
    {
      pattern: /dangerouslySetInnerHTML/i,
      severity: "medium" as const,
      title: "XSS Risk",
      message: "dangerouslySetInnerHTML can lead to XSS vulnerabilities",
      category: "security",
    },
    {
      pattern: /innerHTML\s*=/i,
      severity: "medium" as const,
      title: "XSS Risk",
      message: "innerHTML assignment can lead to XSS vulnerabilities",
      category: "security",
    },
    {
      pattern: /exec\s*\(/i,
      severity: "high" as const,
      title: "Command Injection Risk",
      message: "exec() can execute system commands",
      category: "security",
    },
    {
      pattern: /SELECT\s.*\+/i,
      severity: "high" as const,
      title: "SQL Injection Risk",
      message: "String concatenation in SQL queries can lead to injection",
      category: "security",
    },
  ];

  try {
    const files = await getAllFiles(projectPath);
    
    for (const file of files.slice(0, 500)) { // Limit to 500 files for performance
      try {
        const content = await fs.readFile(file, "utf-8");
        const lines = content.split("\n");
        
        lines.forEach((line, lineNum) => {
          for (const { pattern, severity, title, message, category } of securityPatterns) {
            if (pattern.test(line)) {
              findings.push({
                file,
                line: lineNum + 1,
                endLine: lineNum + 1,
                severity,
                title,
                message,
                category,
              });
              break; // Only report one finding per line
            }
          }
        });
      } catch (readError) {
        // Skip files that can't be read
      }
    }
  } catch (error) {
    fastify.log.warn({ error }, "Error during security scan");
  }

  return findings;
}

/**
 * Get all files in a directory recursively
 */
async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const ignoreDirs = ["node_modules", ".git", ".next", "dist", "build", ".turbo", ".cache"];
  
  async function walk(currentDir: string) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        // Skip ignored directories
        if (entry.isDirectory() && ignoreDirs.includes(entry.name)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          // Only include code files
          const ext = path.extname(entry.name).toLowerCase();
          const codeExts = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".rb", ".php"];
          if (codeExts.includes(ext) || entry.name === ".env" || entry.name.endsWith(".env.example")) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }
  
  await walk(dir);
  return files;
}
