/**
 * Deploy Hooks - Vercel/Netlify/Railway Integration
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as crypto from "crypto";
import { z } from "zod";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

const VERCEL_WEBHOOK_SECRET = process.env.VERCEL_WEBHOOK_SECRET;
const NETLIFY_WEBHOOK_SECRET = process.env.NETLIFY_WEBHOOK_SECRET;
const RAILWAY_WEBHOOK_SECRET = process.env.RAILWAY_WEBHOOK_SECRET;

interface DeployCheckResult {
  allowed: boolean;
  score: number;
  verdict: "GO" | "NO-GO" | "WARN";
  summary: string;
  problems: Array<{
    severity: "critical" | "warning";
    message: string;
    plainEnglish: string;
    fixable: boolean;
  }>;
  reportUrl?: string;
}

function verifyVercelSignature(
  payload: string,
  signature: string | undefined,
): boolean {
  if (!VERCEL_WEBHOOK_SECRET || !signature) return !VERCEL_WEBHOOK_SECRET;
  const hmac = crypto.createHmac("sha1", VERCEL_WEBHOOK_SECRET);
  const digest = hmac.update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

function verifyNetlifySignature(
  payload: string,
  signature: string | undefined,
): boolean {
  if (!NETLIFY_WEBHOOK_SECRET || !signature) return !NETLIFY_WEBHOOK_SECRET;
  const hmac = crypto.createHmac("sha256", NETLIFY_WEBHOOK_SECRET);
  const digest = hmac.update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function runDeployCheck(
  fastify: FastifyInstance,
  repoUrl: string,
  commitSha: string,
  branch: string,
): Promise<DeployCheckResult> {
  // Simplified check - in production would run full scan
  return {
    allowed: true,
    score: 75,
    verdict: "WARN",
    summary: "Deploy allowed with warnings",
    problems: [],
  };
}

function formatPlainEnglishResponse(result: DeployCheckResult): string {
  const emoji =
    result.verdict === "GO" ? "✅" : result.verdict === "WARN" ? "⚠️" : "❌";
  return `${emoji} ${result.verdict}: ${result.summary}`;
}

export async function deployHooksRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/vercel",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const signature = request.headers["x-vercel-signature"] as string;
        const rawBody = JSON.stringify(request.body);
        if (!verifyVercelSignature(rawBody, signature)) {
          return reply.status(401).send({ error: "Invalid signature" });
        }
        const payload = request.body as any;
        fastify.log.info({ type: payload.type }, "Vercel deploy hook received");

        if (
          payload.type === "deployment.created" ||
          payload.type === "deployment"
        ) {
          const { deployment, project } = payload.payload || payload;
          const result = await runDeployCheck(
            fastify,
            deployment?.meta?.githubRepoUrl || project?.link?.repo || "",
            deployment?.meta?.githubCommitSha ||
              deployment?.gitSource?.sha ||
              "",
            deployment?.meta?.githubCommitRef ||
              deployment?.gitSource?.ref ||
              "",
          );

          return reply.send({
            blocked: !result.allowed,
            verdict: result.verdict,
            score: result.score,
            message: result.summary,
            plainText: formatPlainEnglishResponse(result),
          });
        }
        return reply.send({ received: true, type: payload.type });
      } catch (error: unknown) {
        fastify.log.error({ error: toErrorMessage(error) }, "Vercel webhook error");
        return reply.status(500).send({ error: "Webhook processing failed" });
      }
    },
  );

  fastify.post(
    "/netlify",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const signature = request.headers["x-webhook-signature"] as string;
        const rawBody = JSON.stringify(request.body);
        if (!verifyNetlifySignature(rawBody, signature)) {
          return reply.status(401).send({ error: "Invalid signature" });
        }
        const payload = request.body as any;
        fastify.log.info(
          { event: payload.event },
          "Netlify deploy hook received",
        );

        if (
          payload.event === "deploy-building" ||
          payload.state === "building"
        ) {
          const result = await runDeployCheck(
            fastify,
            payload.repo_url || "",
            payload.commit_ref || "",
            payload.branch || "",
          );
          return reply.send({
            state: result.allowed ? "allowed" : "blocked",
            verdict: result.verdict,
            score: result.score,
            message: result.summary,
          });
        }
        return reply.send({ received: true });
      } catch (error: unknown) {
        fastify.log.error({ error: toErrorMessage(error) }, "Netlify webhook error");
        return reply.status(500).send({ error: "Webhook processing failed" });
      }
    },
  );

  fastify.post(
    "/railway",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const payload = request.body as any;
        fastify.log.info(
          { type: payload.type },
          "Railway deploy hook received",
        );

        if (payload.type === "DEPLOY") {
          const result = await runDeployCheck(
            fastify,
            payload.repo?.fullRepoName || "",
            payload.deployment?.meta?.commitHash || "",
            payload.deployment?.meta?.branch || "",
          );
          return reply.send({
            allowed: result.allowed,
            verdict: result.verdict,
            score: result.score,
            message: result.summary,
          });
        }
        return reply.send({ received: true });
      } catch (error: unknown) {
        fastify.log.error({ error: toErrorMessage(error) }, "Railway webhook error");
        return reply.status(500).send({ error: "Webhook processing failed" });
      }
    },
  );

  const checkSchema = z.object({
    repoUrl: z.string().optional(),
    repoName: z.string().optional(),
    commitSha: z.string(),
    branch: z.string().default("main"),
    platform: z
      .enum(["vercel", "netlify", "railway", "github-actions", "other"])
      .default("other"),
  });

  fastify.post(
    "/check",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const parsed = checkSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply
            .status(400)
            .send({ error: "Invalid request", details: parsed.error.issues });
        }
        const { repoUrl, repoName, commitSha, branch } = parsed.data;
        const result = await runDeployCheck(
          fastify,
          repoUrl || repoName || "",
          commitSha,
          branch,
        );
        return reply.send({
          ...result,
          plainText: formatPlainEnglishResponse(result),
          exitCode: result.allowed ? 0 : 1,
        });
      } catch (error: unknown) {
        fastify.log.error({ error: toErrorMessage(error) }, "Deploy check error");
        return reply.status(500).send({ error: "Check failed" });
      }
    },
  );

  fastify.get(
    "/status",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        integrations: {
          vercel: {
            configured: !!VERCEL_WEBHOOK_SECRET,
            webhookUrl: "/api/deploy-hooks/vercel",
          },
          netlify: {
            configured: !!NETLIFY_WEBHOOK_SECRET,
            webhookUrl: "/api/deploy-hooks/netlify",
          },
          railway: {
            configured: !!RAILWAY_WEBHOOK_SECRET,
            webhookUrl: "/api/deploy-hooks/railway",
          },
        },
        genericCheckUrl: "/api/deploy-hooks/check",
      });
    },
  );
}
