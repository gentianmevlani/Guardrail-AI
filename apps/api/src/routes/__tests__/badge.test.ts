/**
 * Tests for Badge SVG Generation
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import Fastify, { FastifyInstance } from "fastify";

jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn(),
}));

import { badgeRoutes } from "../badge";

describe("Badge Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    (app as any).prisma = {
      scan: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    await app.register(badgeRoutes, { prefix: "/api" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/badge/:org/:repo.svg", () => {
    it("returns valid SVG with no-data badge when no scan exists", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/badge/acme/webapp.svg",
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("image/svg+xml");
      expect(res.body).toContain("<svg");
      expect(res.body).toContain("guardrail");
      expect(res.body).toContain("no data");
    });

    it("includes shield logo by default", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/badge/acme/webapp.svg",
      });

      expect(res.body).toContain("<g transform="); // Logo group
    });

    it("supports flat-square style", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/badge/acme/webapp.svg?style=flat-square",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('rx="0"');
    });

    it("hides logo when logo=false", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/badge/acme/webapp.svg?logo=false",
      });

      expect(res.body).not.toContain("transform="); // No logo transform
    });

    it("sets proper caching headers", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/badge/acme/webapp.svg",
      });

      expect(res.headers["cache-control"]).toContain("max-age=");
    });
  });

  describe("GET /api/badge/:org/:repo.json", () => {
    it("returns shields.io-compatible JSON format", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/badge/acme/webapp.json",
      });

      // No scan data — 404 with shields.io schema
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.schemaVersion).toBe(1);
      expect(body.label).toBe("guardrail");
    });
  });

  describe("GET /api/badge/test.svg", () => {
    it("generates test badge from query params", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/badge/test.svg?v=SHIP&s=92",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("SHIP");
      expect(res.body).toContain("92");
      expect(res.headers["cache-control"]).toBe("no-cache");
    });

    it("renders NO-SHIP badge in red", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/badge/test.svg?v=NO-SHIP&s=45",
      });

      expect(res.body).toContain("#e05d44"); // red color
    });

    it("renders high-score badge in green", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/badge/test.svg?v=SHIP&s=97",
      });

      expect(res.body).toContain("#44cc11"); // bright green
    });
  });
});
