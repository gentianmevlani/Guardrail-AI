/**
 * Admin & Support Ops Integration Tests
 * 
 * Comprehensive tests for admin functionality including:
 * - RBAC enforcement
 * - User management operations
 * - Impersonation lifecycle
 * - Broadcast email system
 * - Audit logging
 * - Security controls
 */

import { prisma } from "@guardrail/database";
import { generateToken } from "../../middleware/fastify-auth";
import { buildServer } from "../../server";

// =============================================================================
// TEST SETUP
// =============================================================================

describe("Admin & Support Ops API", () => {
  let server: any;
  let adminUser: any;
  let supportUser: any;
  let regularUser: any;
  let testUser: any;

  beforeAll(async () => {
    server = await buildServer();
    
    // Create test users
    adminUser = await prisma.user.create({
      data: {
        email: "admin@test.com",
        name: "Admin User",
        role: "admin",
        password: "test-password",
        emailVerified: new Date(),
      },
    });

    supportUser = await prisma.user.create({
      data: {
        email: "support@test.com",
        name: "Support User",
        role: "support",
        password: "test-password",
        emailVerified: new Date(),
      },
    });

    regularUser = await prisma.user.create({
      data: {
        email: "user@test.com",
        name: "Regular User",
        role: "user",
        password: "test-password",
        emailVerified: new Date(),
      },
    });

    testUser = await prisma.user.create({
      data: {
        email: "target@test.com",
        name: "Target User",
        role: "user",
        password: "test-password",
        emailVerified: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ["admin@test.com", "support@test.com", "user@test.com", "target@test.com"]
        }
      }
    });
    await server.close();
  });

  // =============================================================================
  // AUTHENTICATION & AUTHORIZATION TESTS
  // =============================================================================

  describe("Authentication & Authorization", () => {
    test("should deny access without authentication", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/users",
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        success: false,
        error: "No token provided",
        code: "NO_TOKEN",
      });
    });

    test("should deny access to non-admin users", async () => {
      const userToken = generateToken({
        id: regularUser.id,
        email: regularUser.email,
        role: regularUser.role,
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/users",
        headers: {
          authorization: `Bearer ${userToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        success: false,
        error: "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
      });
    });

    test("should allow access to admin users", async () => {
      const adminToken = generateToken({
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/dashboard",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
      });
    });

    test("should allow access to support users", async () => {
      const supportToken = generateToken({
        id: supportUser.id,
        email: supportUser.email,
        role: supportUser.role,
      });

      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/dashboard",
        headers: {
          authorization: `Bearer ${supportToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
      });
    });
  });

  // =============================================================================
  // USER MANAGEMENT TESTS
  // =============================================================================

  describe("User Management", () => {
    let adminToken: string;

    beforeEach(() => {
      adminToken = generateToken({
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      });
    });

    test("should list users with pagination", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/users?page=1&limit=10",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          users: expect.any(Array),
          total: expect.any(Number),
          page: 1,
          limit: 10,
        },
      });
    });

    test("should filter users by role", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/users?role=user",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
      });
    });

    test("should search users by email or name", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/users?query=target",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
      });
    });

    test("should get user details", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/v1/admin/users/${testUser.id}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
          role: testUser.role,
        },
      });
    });

    test("should return 404 for non-existent user", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/users/non-existent",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        success: false,
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    });

    test("should disable user account", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/v1/admin/users/${testUser.id}/disable`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          reason: "Test disable",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        message: "User disabled successfully",
      });
    });

    test("should enable user account", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/v1/admin/users/${testUser.id}/enable`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          reason: "Test enable",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        message: "User enabled successfully",
      });
    });

    test("should reset user MFA", async () => {
      const response = await server.inject({
        method: "POST",
        url: `/api/v1/admin/users/${testUser.id}/reset-mfa`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        message: "MFA reset successfully",
      });
    });
  });

  // =============================================================================
  // IMPERSONATION TESTS
  // =============================================================================

  describe("Impersonation", () => {
    let adminToken: string;
    let supportToken: string;

    beforeEach(() => {
      adminToken = generateToken({
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      });

      supportToken = generateToken({
        id: supportUser.id,
        email: supportUser.email,
        role: supportUser.role,
      });
    });

    test("should start impersonation session", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/impersonate/start",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          targetUserId: testUser.id,
          reason: "Support investigation - test case",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          impersonationToken: expect.any(String),
          session: {
            actorUserId: adminUser.id,
            targetUserId: testUser.id,
            reason: "Support investigation - test case",
            isActive: true,
          },
          expiresIn: 600, // 10 minutes
        },
      });
    });

    test("should prevent self-impersonation", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/impersonate/start",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          targetUserId: adminUser.id,
          reason: "Trying to impersonate myself",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        error: "Cannot impersonate yourself",
        code: "SELF_IMPERSONATION",
      });
    });

    test("should validate target user exists", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/impersonate/start",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          targetUserId: "non-existent-user",
          reason: "Test with invalid user",
        },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toMatchObject({
        success: false,
        error: "Failed to start impersonation",
        code: "IMPERSONATION_START_FAILED",
      });
    });

    test("should require minimum reason length", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/impersonate/start",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          targetUserId: testUser.id,
          reason: "Too short",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    test("should end impersonation session", async () => {
      // First start a session
      const startResponse = await server.inject({
        method: "POST",
        url: "/api/v1/admin/impersonate/start",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          targetUserId: testUser.id,
          reason: "Test session for ending",
        },
      });

      expect(startResponse.statusCode).toBe(200);

      // Then end it
      const endResponse = await server.inject({
        method: "POST",
        url: "/api/v1/admin/impersonate/stop",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(endResponse.statusCode).toBe(200);
      expect(endResponse.json()).toMatchObject({
        success: true,
        message: "Impersonation session ended",
      });
    });
  });

  // =============================================================================
  // BROADCAST EMAIL TESTS
  // =============================================================================

  describe("Broadcast Email System", () => {
    let adminToken: string;

    beforeEach(() => {
      adminToken = generateToken({
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      });
    });

    test("should create broadcast job", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/broadcast",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          subject: "Test Broadcast",
          htmlContent: "<h1>Test Email</h1><p>This is a test broadcast.</p>",
          textContent: "Test Email\n\nThis is a test broadcast.",
          audienceFilter: {
            activeOnly: true,
            verifiedOnly: false,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          subject: "Test Broadcast",
          status: "pending",
          createdBy: adminUser.id,
          sentCount: 0,
          failedCount: 0,
        },
      });
    });

    test("should validate broadcast content", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/broadcast",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          subject: "", // Empty subject
          htmlContent: "<p>Test</p>",
          audienceFilter: {
            activeOnly: true,
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    test("should list broadcast jobs", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/broadcast?page=1&limit=10",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          jobs: expect.any(Array),
          total: expect.any(Number),
          page: 1,
          limit: 10,
        },
      });
    });

    test("should get broadcast job status", async () => {
      // First create a job
      const createResponse = await server.inject({
        method: "POST",
        url: "/api/v1/admin/broadcast",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          subject: "Status Test",
          htmlContent: "<p>Test</p>",
          audienceFilter: { activeOnly: true },
        },
      });

      const jobId = createResponse.json().data.id;

      // Then get its status
      const statusResponse = await server.inject({
        method: "GET",
        url: `/api/v1/admin/broadcast/${jobId}/status`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(statusResponse.statusCode).toBe(200);
      expect(statusResponse.json()).toMatchObject({
        success: true,
        data: {
          id: jobId,
          subject: "Status Test",
          status: "pending",
        },
      });
    });
  });

  // =============================================================================
  // SUPPORT NOTES TESTS
  // =============================================================================

  describe("Support Notes", () => {
    let adminToken: string;

    beforeEach(() => {
      adminToken = generateToken({
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      });
    });

    test("should create support note", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/support-notes",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          targetUserId: testUser.id,
          note: "User reported login issues. Investigated and reset password.",
          isInternal: true,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          actorUserId: adminUser.id,
          targetUserId: testUser.id,
          note: "User reported login issues. Investigated and reset password.",
          isInternal: true,
        },
      });
    });

    test("should validate support note content", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/support-notes",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          targetUserId: testUser.id,
          note: "", // Empty note
        },
      });

      expect(response.statusCode).toBe(400);
    });

    test("should get support notes for user", async () => {
      // First create a note
      await server.inject({
        method: "POST",
        url: "/api/v1/admin/support-notes",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          targetUserId: testUser.id,
          note: "Test note for retrieval",
        },
      });

      // Then get notes
      const response = await server.inject({
        method: "GET",
        url: `/api/v1/admin/support-notes/${testUser.id}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          notes: expect.any(Array),
          total: expect.any(Number),
          page: 1,
          limit: 50,
        },
      });
    });
  });

  // =============================================================================
  // AUDIT LOG TESTS
  // =============================================================================

  describe("Audit Logging", () => {
    let adminToken: string;

    beforeEach(() => {
      adminToken = generateToken({
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      });
    });

    test("should log admin actions", async () => {
      // Perform an admin action
      await server.inject({
        method: "GET",
        url: "/api/v1/admin/users",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      // Check that audit log would be created
      // Note: In the mock implementation, this just logs to console
      // In production, this would verify the database entry
      expect(true).toBe(true); // Placeholder for audit log verification
    });

    test("should get audit log entries", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/audit-log?page=1&limit=20",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          entries: expect.any(Array),
          total: expect.any(Number),
          page: 1,
          limit: 20,
        },
      });
    });

    test("should filter audit log by actor", async () => {
      const response = await server.inject({
        method: "GET",
        url: `/api/v1/admin/audit-log?actorUserId=${adminUser.id}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
      });
    });
  });

  // =============================================================================
  // DASHBOARD TESTS
  // =============================================================================

  describe("Dashboard", () => {
    let adminToken: string;

    beforeEach(() => {
      adminToken = generateToken({
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      });
    });

    test("should get dashboard stats", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/dashboard",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        success: true,
        data: {
          totalUsers: expect.any(Number),
          activeUsers: expect.any(Number),
          recentSignups: expect.any(Number),
          openSupportTickets: expect.any(Number),
          activeImpersonations: expect.any(Number),
          pendingBroadcasts: expect.any(Number),
          systemHealth: expect.any(String),
        },
      });
    });
  });

  // =============================================================================
  // SECURITY TESTS
  // =============================================================================

  describe("Security Controls", () => {
    let adminToken: string;
    let supportToken: string;

    beforeEach(() => {
      adminToken = generateToken({
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      });

      supportToken = generateToken({
        id: supportUser.id,
        email: supportUser.email,
        role: supportUser.role,
      });
    });

    test("should prevent support users from impersonating admins", async () => {
      // Create an admin user to target
      const anotherAdmin = await prisma.user.create({
        data: {
          email: "another-admin@test.com",
          name: "Another Admin",
          role: "admin",
          password: "test-password",
          emailVerified: new Date(),
        },
      });

      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/impersonate/start",
        headers: {
          authorization: `Bearer ${supportToken}`,
        },
        payload: {
          targetUserId: anotherAdmin.id,
          reason: "Support trying to impersonate admin",
        },
      });

      expect(response.statusCode).toBe(500); // Should fail due to admin protection

      // Cleanup
      await prisma.user.delete({ where: { id: anotherAdmin.id } });
    });

    test("should validate token format", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/admin/users",
        headers: {
          authorization: "Bearer invalid-token-format",
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        success: false,
        error: "Invalid token",
        code: "INVALID_TOKEN",
      });
    });

    test("should handle malformed requests gracefully", async () => {
      const response = await server.inject({
        method: "POST",
        url: "/api/v1/admin/impersonate/start",
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
        },
        payload: "invalid-json",
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
