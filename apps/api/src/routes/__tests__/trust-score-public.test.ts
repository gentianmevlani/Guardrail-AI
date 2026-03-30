/**
 * Tests for Public Trust Score API
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import Fastify, { FastifyInstance } from "fastify";

const mockPrisma = {
  publicTrustScore: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  apiKey: {
    findFirst: jest.fn(),
  },
};

import { trustScorePublicRoutes } from "../trust-score-public";

describe("Public Trust Score API", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    (app as any).prisma = mockPrisma;
    await app.register(trustScorePublicRoutes, { prefix: "/" });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /score/:org/:repo", () => {
    it("returns 404 when no score exists", async () => {
      mockPrisma.publicTrustScore.findFirst.mockResolvedValue(null);
      mockPrisma.publicTrustScore.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: "/score/acme/webapp",
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe("No score found");
      expect(body.org).toBe("acme");
      expect(body.repo).toBe("webapp");
    });

    it("returns score data when found", async () => {
      const mockScore = {
        org: "acme",
        repo: "webapp",
        score: 92,
        verdict: "SHIP",
        grade: "B",
        findingCount: 3,
        criticalCount: 0,
        highCount: 1,
        dimensions: { api_integrity: { score: 95, weight: 0.3, label: "API Integrity", findingCount: 0 } },
        commitSha: "abc123",
        branch: "main",
        computedAt: new Date("2026-03-30T00:00:00Z"),
      };
      mockPrisma.publicTrustScore.findFirst.mockResolvedValue(mockScore);
      mockPrisma.publicTrustScore.findMany.mockResolvedValue([mockScore]);

      const res = await app.inject({
        method: "GET",
        url: "/score/acme/webapp",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.score).toBe(92);
      expect(body.verdict).toBe("SHIP");
      expect(body.grade).toBe("B");
      expect(body.fullName).toBe("acme/webapp");
      expect(body.links.badge).toContain("/api/badge/acme/webapp.svg");
    });

    it("rejects invalid org/repo names", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/score/acme%2F../webapp",
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /score/:org/:repo", () => {
    it("requires API key", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/score/acme/webapp",
        payload: { score: 92, verdict: "SHIP", grade: "B", findingCount: 3 },
      });

      expect(res.statusCode).toBe(401);
    });

    it("rejects invalid API key", async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/score/acme/webapp",
        headers: { "x-api-key": "bad-key" },
        payload: { score: 92, verdict: "SHIP", grade: "B", findingCount: 3 },
      });

      expect(res.statusCode).toBe(403);
    });

    it("creates score with valid API key", async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue({ id: "key1", userId: "user1" });
      mockPrisma.publicTrustScore.create.mockResolvedValue({ id: "score1" });
      mockPrisma.publicTrustScore.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.publicTrustScore.update.mockResolvedValue({ id: "score1" });

      const res = await app.inject({
        method: "POST",
        url: "/score/acme/webapp",
        headers: { "x-api-key": "valid-key" },
        payload: {
          score: 92,
          verdict: "SHIP",
          grade: "B",
          findingCount: 3,
          criticalCount: 0,
          highCount: 1,
          commitSha: "abc123",
          branch: "main",
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.score).toBe(92);
      expect(body.badge).toContain("/api/badge/acme/webapp.svg");
    });

    it("validates request body schema", async () => {
      mockPrisma.apiKey.findFirst.mockResolvedValue({ id: "key1", userId: "user1" });

      const res = await app.inject({
        method: "POST",
        url: "/score/acme/webapp",
        headers: { "x-api-key": "valid-key" },
        payload: { score: 200, verdict: "INVALID" }, // score > 100, bad verdict
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /leaderboard", () => {
    it("returns paginated leaderboard", async () => {
      const entries = [
        { org: "acme", repo: "api", score: 98, verdict: "SHIP", grade: "A", findingCount: 0, criticalCount: 0, computedAt: new Date(), branch: "main" },
        { org: "acme", repo: "web", score: 87, verdict: "SHIP", grade: "B", findingCount: 5, criticalCount: 0, computedAt: new Date(), branch: "main" },
      ];
      mockPrisma.publicTrustScore.findMany.mockResolvedValue(entries);
      mockPrisma.publicTrustScore.count.mockResolvedValue(2);

      const res = await app.inject({
        method: "GET",
        url: "/leaderboard?limit=10&sort=score",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.total).toBe(2);
      expect(body.entries).toHaveLength(2);
      expect(body.entries[0].rank).toBe(1);
      expect(body.entries[0].score).toBe(98);
      expect(body.entries[0].verified).toBe(true);
    });

    it("supports minScore filter", async () => {
      mockPrisma.publicTrustScore.findMany.mockResolvedValue([]);
      mockPrisma.publicTrustScore.count.mockResolvedValue(0);

      const res = await app.inject({
        method: "GET",
        url: "/leaderboard?minScore=90",
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.publicTrustScore.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            score: { gte: 90 },
          }),
        })
      );
    });
  });

  describe("GET /verified", () => {
    it("returns only verified (score >= 85, 0 criticals, SHIP) projects", async () => {
      mockPrisma.publicTrustScore.findMany.mockResolvedValue([]);
      mockPrisma.publicTrustScore.count.mockResolvedValue(0);

      const res = await app.inject({
        method: "GET",
        url: "/verified",
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.publicTrustScore.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isLatest: true,
            score: { gte: 85 },
            criticalCount: 0,
            verdict: "SHIP",
          }),
        })
      );
    });
  });
});
