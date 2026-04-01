/**
 * Admin Authorization Middleware Tests
 *
 * Tests for requireAuth, requireAdmin, and requireOwnerOrAdmin middleware.
 */

import { FastifyReply, FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock JWT
vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn(),
  },
}));

// Mock logger
vi.mock("../../apps/api/src/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock secrets
vi.mock("../../apps/api/src/config/secrets", () => ({
  JWT_SECRET: "test-secret",
}));

import jwt from "jsonwebtoken";
import { logger } from "../../apps/api/src/logger";
import {
  AdminRequest,
  requireAdmin,
  requireAuth,
  requireOwnerOrAdmin,
  requireSuperAdmin,
} from "../../apps/api/src/middleware/require-admin";

describe("Admin Authorization Middleware", () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let sentResponse: { status?: number; body?: any } = {};

  beforeEach(() => {
    vi.clearAllMocks();
    sentResponse = {};

    mockRequest = {
      headers: {},
      url: "/api/admin/test",
      method: "POST",
      ip: "127.0.0.1",
    };

    mockReply = {
      sent: false,
      status: vi.fn().mockImplementation((code: number) => {
        sentResponse.status = code;
        return mockReply;
      }),
      send: vi.fn().mockImplementation((body: any) => {
        sentResponse.body = body;
        (mockReply as any).sent = true;
        return mockReply;
      }),
    };
  });

  describe("requireAuth", () => {
    it("should reject requests without authorization header", async () => {
      mockRequest.headers = {};

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(sentResponse.status).toBe(401);
      expect(sentResponse.body?.error).toBe("Authentication required");
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should reject requests with invalid Bearer token format", async () => {
      mockRequest.headers = { authorization: "Basic abc123" };

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(sentResponse.status).toBe(401);
    });

    it("should reject invalid JWT tokens", async () => {
      mockRequest.headers = { authorization: "Bearer invalid-token" };
      (jwt.verify as any).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(sentResponse.status).toBe(401);
    });

    it("should accept valid JWT tokens and set user on request", async () => {
      const mockUser = {
        userId: "user-123",
        email: "test@test.com",
        role: "user",
      };
      mockRequest.headers = { authorization: "Bearer valid-token" };
      (jwt.verify as any).mockReturnValue(mockUser);

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.sent).toBe(false);
      expect((mockRequest as AdminRequest).user).toEqual(mockUser);
    });
  });

  describe("requireAdmin", () => {
    it("should reject non-admin users", async () => {
      const mockUser = {
        userId: "user-123",
        email: "test@test.com",
        role: "user",
      };
      mockRequest.headers = { authorization: "Bearer valid-token" };
      (jwt.verify as any).mockReturnValue(mockUser);

      await requireAdmin(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(sentResponse.status).toBe(403);
      expect(sentResponse.body?.error).toBe("Admin access required");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Unauthorized admin access attempt",
        }),
      );
    });

    it("should allow admin users", async () => {
      const mockUser = {
        userId: "admin-123",
        email: "admin@test.com",
        role: "admin",
      };
      mockRequest.headers = { authorization: "Bearer valid-token" };
      (jwt.verify as any).mockReturnValue(mockUser);

      await requireAdmin(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.sent).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Admin action",
        }),
      );
    });

    it("should allow superadmin users", async () => {
      const mockUser = {
        userId: "super-123",
        email: "super@test.com",
        role: "superadmin",
      };
      mockRequest.headers = { authorization: "Bearer valid-token" };
      (jwt.verify as any).mockReturnValue(mockUser);

      await requireAdmin(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.sent).toBe(false);
    });
  });

  describe("requireSuperAdmin", () => {
    it("should reject regular admin users", async () => {
      const mockUser = {
        userId: "admin-123",
        email: "admin@test.com",
        role: "admin",
      };
      mockRequest.headers = { authorization: "Bearer valid-token" };
      (jwt.verify as any).mockReturnValue(mockUser);

      await requireSuperAdmin(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(sentResponse.status).toBe(403);
      expect(sentResponse.body?.error).toBe("Superadmin access required");
    });

    it("should allow superadmin users", async () => {
      const mockUser = {
        userId: "super-123",
        email: "super@test.com",
        role: "superadmin",
      };
      mockRequest.headers = { authorization: "Bearer valid-token" };
      (jwt.verify as any).mockReturnValue(mockUser);

      await requireSuperAdmin(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.sent).toBe(false);
    });
  });

  describe("requireOwnerOrAdmin", () => {
    it("should allow resource owner", async () => {
      const mockUser = {
        userId: "user-123",
        email: "test@test.com",
        role: "user",
      };
      mockRequest.headers = { authorization: "Bearer valid-token" };
      (jwt.verify as any).mockReturnValue(mockUser);

      const middleware = requireOwnerOrAdmin(() => "user-123");

      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.sent).toBe(false);
    });

    it("should reject non-owner non-admin", async () => {
      const mockUser = {
        userId: "user-123",
        email: "test@test.com",
        role: "user",
      };
      mockRequest.headers = { authorization: "Bearer valid-token" };
      (jwt.verify as any).mockReturnValue(mockUser);

      const middleware = requireOwnerOrAdmin(() => "other-user-456");

      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(sentResponse.status).toBe(403);
      expect(sentResponse.body?.error).toBe("Access denied");
    });

    it("should allow admin to access any resource", async () => {
      const mockUser = {
        userId: "admin-123",
        email: "admin@test.com",
        role: "admin",
      };
      mockRequest.headers = { authorization: "Bearer valid-token" };
      (jwt.verify as any).mockReturnValue(mockUser);

      const middleware = requireOwnerOrAdmin(() => "other-user-456");

      await middleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(mockReply.sent).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Admin accessing user resource",
        }),
      );
    });
  });

  describe("Audit Logging", () => {
    it("should log failed auth attempts with IP", async () => {
      mockRequest.headers = {};
      mockRequest.ip = "192.168.1.1";

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: "192.168.1.1",
        }),
      );
    });

    it("should log admin actions with user details", async () => {
      const mockUser = {
        userId: "admin-123",
        email: "admin@test.com",
        role: "admin",
      };
      mockRequest.headers = { authorization: "Bearer valid-token" };
      (jwt.verify as any).mockReturnValue(mockUser);

      await requireAdmin(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "admin-123",
          email: "admin@test.com",
          role: "admin",
          route: "/api/admin/test",
          method: "POST",
        }),
      );
    });
  });
});
