/**
 * Tests for Fix Application Routes
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import Fastify, { FastifyInstance } from "fastify";

// Mock dependencies
const mockPrisma = {
  run: {
    findFirst: jest.fn(),
  },
  finding: {
    findMany: jest.fn(),
  },
  securityEvent: {
    create: jest.fn(),
  },
};

jest.mock("fs/promises", () => ({
  readFile: jest.fn().mockResolvedValue("const x = 1;\nconst y = 2;\nconst z = 3;"),
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("child_process", () => ({
  execSync: jest.fn().mockReturnValue(""),
}));

// Set global prisma mock
(global as any).prisma = mockPrisma;

// Import route after mocks
import { fixesRoutes } from "../fixes";

describe("Fix Application Routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    app = Fastify();
    
    // Mock auth middleware
    app.decorateRequest("user", null);
    app.addHook("preHandler", async (request) => {
      (request as any).user = { id: "test-user-id", email: "test@example.com" };
    });

    // Register routes
    await app.register(fixesRoutes, { prefix: "/api/v1/fixes" });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /api/v1/fixes/apply", () => {
    it("should return 404 when run not found", async () => {
      mockPrisma.run.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/fixes/apply",
        payload: {
          runId: "nonexistent-run",
          packId: "pack-1",
        },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toEqual({
        success: false,
        error: "Run not found",
      });
    });

    it("should return 404 when fix pack not found", async () => {
      mockPrisma.run.findFirst.mockResolvedValue({
        id: "run-123",
        user_id: "test-user-id",
        project_path: "/test/path",
      });
      mockPrisma.finding.findMany.mockResolvedValue([]);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/fixes/apply",
        payload: {
          runId: "run-123",
          packId: "nonexistent-pack",
        },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toEqual({
        success: false,
        error: "Fix pack not found",
      });
    });

    it("should perform dry run when dryRun=true", async () => {
      mockPrisma.run.findFirst.mockResolvedValue({
        id: "run-123",
        user_id: "test-user-id",
        project_path: "/test/path",
      });
      mockPrisma.finding.findMany.mockResolvedValue([
        {
          id: "finding-1",
          rule_id: "no-console",
          type: "code_quality",
          file: "src/test.ts",
          line: 1,
          severity: "warning",
          suggestion: "Remove console.log",
          metadata: { fixPackId: "pack-1" },
        },
      ]);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/fixes/apply",
        payload: {
          runId: "run-123",
          packId: "pack-1",
          dryRun: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.dryRun).toBe(true);
    });
  });

  describe("POST /api/v1/fixes/diff", () => {
    it("should generate diff for fix pack", async () => {
      mockPrisma.run.findFirst.mockResolvedValue({
        id: "run-123",
        user_id: "test-user-id",
        project_path: "/test/path",
      });
      mockPrisma.finding.findMany.mockResolvedValue([
        {
          id: "finding-1",
          rule_id: "no-console",
          type: "code_quality",
          file: "src/test.ts",
          line: 1,
          severity: "warning",
          suggestion: "Remove console.log",
          metadata: { fixPackId: "pack-1" },
        },
      ]);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/fixes/diff",
        payload: {
          runId: "run-123",
          packId: "pack-1",
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.packId).toBe("pack-1");
    });

    it("should return 404 when run not found for diff", async () => {
      mockPrisma.run.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/fixes/diff",
        payload: {
          runId: "nonexistent-run",
          packId: "pack-1",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/v1/fixes/rollback", () => {
    it("should return error for invalid rollback ID", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/fixes/rollback",
        payload: {
          rollbackId: "invalid-rollback-id",
        },
      });

      expect(response.statusCode).toBe(500);
    });
  });
});
