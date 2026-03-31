/**
 * Public Trust Score API — Guardrail Score as a Public Signal
 *
 * Provides public, unauthenticated endpoints for:
 *   - Trust Score lookup  GET /api/v1/score/:org/:repo
 *   - Leaderboard         GET /api/v1/leaderboard
 *   - Score submission     POST /api/v1/score/:org/:repo (authenticated)
 *
 * These endpoints are the backbone of "Trust Score as a Public Signal":
 * badges, PR comments, and the Guardrail Verified directory all read from here.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// ─── Schemas ────────────────────────────────────────────────────────────────

const scoreParamsSchema = z.object({
  org: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/),
  repo: z.string().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/),
});

const submitScoreBodySchema = z.object({
  score: z.number().int().min(0).max(100),
  verdict: z.enum(["SHIP", "NO_SHIP", "REVIEW"]),
  grade: z.enum(["A", "B", "C", "D", "F"]),
  findingCount: z.number().int().min(0),
  criticalCount: z.number().int().min(0).default(0),
  highCount: z.number().int().min(0).default(0),
  dimensions: z.record(z.object({
    score: z.number(),
    weight: z.number(),
    findingCount: z.number(),
    label: z.string(),
  })).optional(),
  commitSha: z.string().max(64).optional(),
  branch: z.string().max(256).optional(),
  scanDurationMs: z.number().int().optional(),
  engineVersions: z.record(z.string()).optional(),
});

const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  language: z.string().max(64).optional(),
  sort: z.enum(["score", "recent", "trending"]).default("score"),
});

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreRecord {
  org: string;
  repo: string;
  score: number;
  verdict: string;
  grade: string;
  findingCount: number;
  criticalCount: number;
  highCount: number;
  dimensions: Record<string, unknown> | null;
  commitSha: string | null;
  branch: string | null;
  scanDurationMs: number | null;
  computedAt: string;
  isPublic: boolean;
}

// ─── Route Registration ─────────────────────────────────────────────────────

export async function trustScorePublicRoutes(fastify: FastifyInstance) {
  /**
   * GET /score/:org/:repo
   *
   * Public endpoint — returns the latest trust score for a repo.
   * No authentication required. Used by badges, PR bots, and the leaderboard.
   */
  fastify.get(
    "/score/:org/:repo",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const parsed = scoreParamsSchema.safeParse(request.params);
        if (!parsed.success) {
          return reply.status(400).send({
            error: "Invalid parameters",
            details: parsed.error.flatten().fieldErrors,
          });
        }

        const { org, repo } = parsed.data;
        const fullName = `${org}/${repo}`;

        const prisma = (fastify as any).prisma;
        if (!prisma) {
          return reply.status(503).send({ error: "Database unavailable" });
        }

        // Look up the most recent public score
        const record = await prisma.publicTrustScore.findFirst({
          where: { org, repo },
          orderBy: { computedAt: "desc" },
        });

        if (!record) {
          reply.header("Cache-Control", "public, max-age=60");
          return reply.status(404).send({
            error: "No score found",
            org,
            repo,
            message: `No Guardrail score recorded for ${fullName}. Run 'guardrail scan' and push results.`,
          });
        }

        const baseUrl = process.env.API_BASE_URL || "https://guardrailai.dev";

        reply.header("Cache-Control", "public, max-age=300, s-maxage=300");
        return reply.send({
          org,
          repo,
          fullName,
          score: record.score,
          verdict: record.verdict,
          grade: record.grade,
          findingCount: record.findingCount,
          criticalCount: record.criticalCount,
          highCount: record.highCount,
          dimensions: record.dimensions,
          commitSha: record.commitSha,
          branch: record.branch,
          computedAt: record.computedAt,
          // History summary
          history: await getScoreHistory(prisma, org, repo, 10),
          // Links
          links: {
            badge: `${baseUrl}/api/badge/${org}/${repo}.svg`,
            badgeJson: `${baseUrl}/api/badge/${org}/${repo}.json`,
            report: `${baseUrl}/report/${org}/${repo}`,
            api: `${baseUrl}/api/v1/score/${org}/${repo}`,
          },
        });
      } catch (error: unknown) {
        fastify.log.error({ msg: "Trust score lookup error", error: toErrorMessage(error) });
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  /**
   * GET /score/:org/:repo/history
   *
   * Returns score history for trend visualization.
   */
  fastify.get(
    "/score/:org/:repo/history",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const parsed = scoreParamsSchema.safeParse(request.params);
        if (!parsed.success) {
          return reply.status(400).send({ error: "Invalid parameters" });
        }

        const { org, repo } = parsed.data;
        const query = request.query as { limit?: string };
        const limit = Math.min(parseInt(query.limit || "30", 10), 100);

        const prisma = (fastify as any).prisma;
        if (!prisma) {
          return reply.status(503).send({ error: "Database unavailable" });
        }

        const history = await getScoreHistory(prisma, org, repo, limit);

        reply.header("Cache-Control", "public, max-age=300");
        return reply.send({
          org,
          repo,
          count: history.length,
          history,
        });
      } catch (error: unknown) {
        fastify.log.error({ msg: "Score history error", error: toErrorMessage(error) });
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  /**
   * POST /score/:org/:repo
   *
   * Submit a new trust score. Called by:
   *   - CI pipelines (via API key)
   *   - GitHub Actions
   *   - CLI `guardrail scan --publish`
   *
   * Requires authentication via API key in x-api-key header.
   */
  fastify.post(
    "/score/:org/:repo",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Auth: require API key
        const apiKey = request.headers["x-api-key"] as string | undefined;
        if (!apiKey) {
          return reply.status(401).send({ error: "API key required (x-api-key header)" });
        }

        const prisma = (fastify as any).prisma;
        if (!prisma) {
          return reply.status(503).send({ error: "Database unavailable" });
        }

        // Validate API key
        const keyRecord = await prisma.apiKey.findFirst({
          where: { key: apiKey, isActive: true },
          select: { id: true, userId: true },
        });

        if (!keyRecord) {
          return reply.status(403).send({ error: "Invalid or inactive API key" });
        }

        const paramsParsed = scoreParamsSchema.safeParse(request.params);
        if (!paramsParsed.success) {
          return reply.status(400).send({ error: "Invalid parameters" });
        }

        const bodyParsed = submitScoreBodySchema.safeParse(request.body);
        if (!bodyParsed.success) {
          return reply.status(400).send({
            error: "Invalid request body",
            details: bodyParsed.error.flatten().fieldErrors,
          });
        }

        const { org, repo } = paramsParsed.data;
        const body = bodyParsed.data;

        // Upsert the public trust score
        const record = await prisma.publicTrustScore.create({
          data: {
            org,
            repo,
            score: body.score,
            verdict: body.verdict,
            grade: body.grade,
            findingCount: body.findingCount,
            criticalCount: body.criticalCount,
            highCount: body.highCount,
            dimensions: body.dimensions ?? null,
            commitSha: body.commitSha ?? null,
            branch: body.branch ?? null,
            scanDurationMs: body.scanDurationMs ?? null,
            submittedBy: keyRecord.userId,
            computedAt: new Date(),
          },
        });

        // Update leaderboard cache (upsert latest score for this repo)
        await prisma.publicTrustScore.updateMany({
          where: { org, repo, isLatest: true },
          data: { isLatest: false },
        });
        await prisma.publicTrustScore.update({
          where: { id: record.id },
          data: { isLatest: true },
        });

        const baseUrl = process.env.API_BASE_URL || "https://guardrailai.dev";

        return reply.status(201).send({
          success: true,
          id: record.id,
          org,
          repo,
          score: body.score,
          verdict: body.verdict,
          grade: body.grade,
          badge: `${baseUrl}/api/badge/${org}/${repo}.svg`,
          embedMarkdown: `[![Guardrail Score](${baseUrl}/api/badge/${org}/${repo}.svg)](${baseUrl}/report/${org}/${repo})`,
        });
      } catch (error: unknown) {
        fastify.log.error({ msg: "Score submission error", error: toErrorMessage(error) });
        return reply.status(500).send({ error: "Failed to submit score" });
      }
    }
  );

  /**
   * GET /leaderboard
   *
   * Public leaderboard of Guardrail Verified projects.
   * Shows the top-scoring repos, filterable by language and score threshold.
   */
  fastify.get(
    "/leaderboard",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const parsed = leaderboardQuerySchema.safeParse(request.query);
        if (!parsed.success) {
          return reply.status(400).send({
            error: "Invalid query parameters",
            details: parsed.error.flatten().fieldErrors,
          });
        }

        const { limit, offset, minScore, sort } = parsed.data;

        const prisma = (fastify as any).prisma;
        if (!prisma) {
          return reply.status(503).send({ error: "Database unavailable" });
        }

        // Build where clause
        const where: any = { isLatest: true };
        if (minScore !== undefined) {
          where.score = { gte: minScore };
        }

        // Build orderBy
        let orderBy: any;
        switch (sort) {
          case "score":
            orderBy = { score: "desc" };
            break;
          case "recent":
            orderBy = { computedAt: "desc" };
            break;
          case "trending":
            orderBy = [{ score: "desc" }, { computedAt: "desc" }];
            break;
          default:
            orderBy = { score: "desc" };
        }

        const [entries, total] = await Promise.all([
          prisma.publicTrustScore.findMany({
            where,
            orderBy,
            skip: offset,
            take: limit,
            select: {
              org: true,
              repo: true,
              score: true,
              verdict: true,
              grade: true,
              findingCount: true,
              criticalCount: true,
              computedAt: true,
              branch: true,
            },
          }),
          prisma.publicTrustScore.count({ where }),
        ]);

        const baseUrl = process.env.API_BASE_URL || "https://guardrailai.dev";

        reply.header("Cache-Control", "public, max-age=120, s-maxage=120");
        return reply.send({
          total,
          limit,
          offset,
          sort,
          entries: entries.map((e: any, i: number) => ({
            rank: offset + i + 1,
            org: e.org,
            repo: e.repo,
            fullName: `${e.org}/${e.repo}`,
            score: e.score,
            verdict: e.verdict,
            grade: e.grade,
            findingCount: e.findingCount,
            criticalCount: e.criticalCount,
            computedAt: e.computedAt,
            verified: e.score >= 85 && e.criticalCount === 0,
            badge: `${baseUrl}/api/badge/${e.org}/${e.repo}.svg`,
          })),
        });
      } catch (error: unknown) {
        fastify.log.error({ msg: "Leaderboard error", error: toErrorMessage(error) });
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );

  /**
   * GET /verified
   *
   * Returns only "Guardrail Verified" projects (score >= 85, 0 criticals, verdict SHIP).
   * This is the data source for the "Guardrail Verified" badge registry.
   */
  fastify.get(
    "/verified",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { limit?: string; offset?: string };
        const limit = Math.min(parseInt(query.limit || "50", 10), 100);
        const offset = parseInt(query.offset || "0", 10);

        const prisma = (fastify as any).prisma;
        if (!prisma) {
          return reply.status(503).send({ error: "Database unavailable" });
        }

        const where = {
          isLatest: true,
          score: { gte: 85 },
          criticalCount: 0,
          verdict: "SHIP",
        };

        const [entries, total] = await Promise.all([
          prisma.publicTrustScore.findMany({
            where,
            orderBy: { score: "desc" },
            skip: offset,
            take: limit,
            select: {
              org: true,
              repo: true,
              score: true,
              grade: true,
              findingCount: true,
              computedAt: true,
            },
          }),
          prisma.publicTrustScore.count({ where }),
        ]);

        const baseUrl = process.env.API_BASE_URL || "https://guardrailai.dev";

        reply.header("Cache-Control", "public, max-age=300, s-maxage=300");
        return reply.send({
          total,
          limit,
          offset,
          verified: entries.map((e: any) => ({
            org: e.org,
            repo: e.repo,
            fullName: `${e.org}/${e.repo}`,
            score: e.score,
            grade: e.grade,
            findingCount: e.findingCount,
            verifiedAt: e.computedAt,
            badge: `${baseUrl}/api/badge/${e.org}/${e.repo}.svg`,
          })),
        });
      } catch (error: unknown) {
        fastify.log.error({ msg: "Verified list error", error: toErrorMessage(error) });
        return reply.status(500).send({ error: "Internal server error" });
      }
    }
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getScoreHistory(
  prisma: any,
  org: string,
  repo: string,
  limit: number
): Promise<Array<{ score: number; verdict: string; grade: string; commitSha: string | null; computedAt: string }>> {
  const records = await prisma.publicTrustScore.findMany({
    where: { org, repo },
    orderBy: { computedAt: "desc" },
    take: limit,
    select: {
      score: true,
      verdict: true,
      grade: true,
      commitSha: true,
      computedAt: true,
    },
  });

  return records.map((r: any) => ({
    score: r.score,
    verdict: r.verdict,
    grade: r.grade,
    commitSha: r.commitSha,
    computedAt: r.computedAt?.toISOString?.() ?? r.computedAt,
  }));
}
