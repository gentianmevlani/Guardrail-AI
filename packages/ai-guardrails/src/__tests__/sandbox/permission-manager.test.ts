// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock dependencies
const mockPrisma = {
  agent: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
};

// Mock the database module
jest.mock("@guardrail/database", () => ({
  prisma: mockPrisma,
}));

// Import the class after mocking
import { PermissionManager, AgentStatus } from "../../sandbox/index";

describe("PermissionManager", () => {
  let permissionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    permissionManager = new PermissionManager();
  });

  describe("registerAgent", () => {
    it("should register a new agent with valid permissions", async () => {
      // Arrange
      const agentData = {
        agentId: "agent-123",
        name: "Test Agent",
        type: "security-scanner",
        scope: {
          allowedPaths: ["/src"],
          allowedDomains: ["api.example.com"],
          maxFileSize: 1024000,
          allowedOperations: ["read", "write"],
        },
      };

      mockPrisma.agent.findUnique.mockResolvedValue(null);
      mockPrisma.agent.create.mockResolvedValue({ id: agentData.agentId });

      // Act & Assert
      await expect(
        permissionManager.registerAgent(
          agentData.agentId,
          agentData.name,
          agentData.type,
          agentData.scope,
        ),
      ).resolves.not.toThrow();

      expect(mockPrisma.agent.create).toHaveBeenCalledWith({
        data: {
          id: agentData.agentId,
          name: agentData.name,
          type: agentData.type,
          status: "pending",
          permissions: agentData.scope,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it("should update existing agent", async () => {
      // Arrange
      const agentData = {
        agentId: "agent-123",
        name: "Updated Agent",
        type: "security-scanner",
        scope: {
          allowedPaths: ["/src"],
          allowedDomains: ["api.example.com"],
          maxFileSize: 1024000,
          allowedOperations: ["read", "write"],
        },
      };

      mockPrisma.agent.findUnique.mockResolvedValue({
        id: agentData.agentId,
        status: "active",
      });
      mockPrisma.agent.update.mockResolvedValue({ id: agentData.agentId });

      // Act
      await permissionManager.registerAgent(
        agentData.agentId,
        agentData.name,
        agentData.type,
        agentData.scope,
      );

      // Assert
      expect(mockPrisma.agent.update).toHaveBeenCalledWith({
        where: { id: agentData.agentId },
        data: {
          name: agentData.name,
          type: agentData.type,
          permissions: agentData.scope,
          updatedAt: expect.any(Date),
        },
      });
    });

    it("should throw error for invalid scope", async () => {
      // Arrange
      const invalidScope = {
        allowedPaths: "", // Invalid empty string
        allowedDomains: ["invalid-domain"], // Invalid domain format
        maxFileSize: -1, // Invalid negative size
        allowedOperations: ["invalid-op"], // Invalid operation
      };

      // Act & Assert
      await expect(
        permissionManager.registerAgent(
          "agent-123",
          "Test Agent",
          "test",
          invalidScope,
        ),
      ).rejects.toThrow("Invalid permission scope");
    });
  });

  describe("getPermissions", () => {
    it("should return agent permissions", async () => {
      // Arrange
      const agentId = "agent-123";
      const expectedPermissions = {
        allowedPaths: ["/src"],
        allowedDomains: ["api.example.com"],
        maxFileSize: 1024000,
        allowedOperations: ["read", "write"],
      };

      mockPrisma.agent.findUnique.mockResolvedValue({
        id: agentId,
        permissions: expectedPermissions,
      });

      // Act
      const result = await permissionManager.getPermissions(agentId);

      // Assert
      expect(result).toEqual(expectedPermissions);
      expect(mockPrisma.agent.findUnique).toHaveBeenCalledWith({
        where: { id: agentId },
        select: { permissions: true },
      });
    });

    it("should return null for non-existent agent", async () => {
      // Arrange
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      // Act
      const result = await permissionManager.getPermissions("non-existent");

      // Assert
      expect(result).toBeNull();
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      mockPrisma.agent.findUnique.mockRejectedValue(
        new Error("Database error"),
      );

      // Act
      const result = await permissionManager.getPermissions("agent-123");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("updatePermissions", () => {
    it("should update agent permissions", async () => {
      // Arrange
      const agentId = "agent-123";
      const newScope = {
        allowedPaths: ["/new-path"],
        allowedDomains: ["new.example.com"],
        maxFileSize: 2048000,
        allowedOperations: ["read"],
      };

      mockPrisma.agent.findUnique.mockResolvedValue({ id: agentId });
      mockPrisma.agent.update.mockResolvedValue({ id: agentId });

      // Act
      await permissionManager.updatePermissions(agentId, newScope);

      // Assert
      expect(mockPrisma.agent.update).toHaveBeenCalledWith({
        where: { id: agentId },
        data: {
          permissions: newScope,
          updatedAt: expect.any(Date),
        },
      });
    });

    it("should throw error for agent not found", async () => {
      // Arrange
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        permissionManager.updatePermissions("non-existent", {}),
      ).rejects.toThrow("Agent not found");
    });
  });

  describe("suspendAgent", () => {
    it("should suspend an active agent", async () => {
      // Arrange
      const agentId = "agent-123";
      mockPrisma.agent.findUnique.mockResolvedValue({
        id: agentId,
        status: "active",
      });
      mockPrisma.agent.update.mockResolvedValue({ id: agentId });

      // Act
      await permissionManager.suspendAgent(
        agentId,
        "Violation detected",
        "user-123",
      );

      // Assert
      expect(mockPrisma.agent.update).toHaveBeenCalledWith({
        where: { id: agentId },
        data: {
          status: "suspended",
          suspendedAt: expect.any(Date),
          suspendedBy: "user-123",
          suspensionReason: "Violation detected",
          updatedAt: expect.any(Date),
        },
      });
    });

    it("should throw error for non-existent agent", async () => {
      // Arrange
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        permissionManager.suspendAgent("non-existent", "reason", "user-123"),
      ).rejects.toThrow("Agent not found");
    });
  });

  describe("reactivateAgent", () => {
    it("should reactivate a suspended agent", async () => {
      // Arrange
      const agentId = "agent-123";
      mockPrisma.agent.findUnique.mockResolvedValue({
        id: agentId,
        status: "suspended",
      });
      mockPrisma.agent.update.mockResolvedValue({ id: agentId });

      // Act
      await permissionManager.reactivateAgent(agentId);

      // Assert
      expect(mockPrisma.agent.update).toHaveBeenCalledWith({
        where: { id: agentId },
        data: {
          status: "active",
          suspendedAt: null,
          suspendedBy: null,
          suspensionReason: null,
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe("revokeAgent", () => {
    it("should revoke an agent", async () => {
      // Arrange
      const agentId = "agent-123";
      mockPrisma.agent.findUnique.mockResolvedValue({ id: agentId });
      mockPrisma.agent.delete.mockResolvedValue({ id: agentId });

      // Act
      await permissionManager.revokeAgent(agentId);

      // Assert
      expect(mockPrisma.agent.delete).toHaveBeenCalledWith({
        where: { id: agentId },
      });
    });
  });

  describe("isAgentActive", () => {
    it("should return true for active agent", async () => {
      // Arrange
      mockPrisma.agent.findUnique.mockResolvedValue({
        status: "active",
      });

      // Act
      const result = await permissionManager.isAgentActive("agent-123");

      // Assert
      expect(result).toBe(true);
    });

    it("should return false for suspended agent", async () => {
      // Arrange
      mockPrisma.agent.findUnique.mockResolvedValue({
        status: "suspended",
      });

      // Act
      const result = await permissionManager.isAgentActive("agent-123");

      // Assert
      expect(result).toBe(false);
    });

    it("should return false for non-existent agent", async () => {
      // Arrange
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      // Act
      const result = await permissionManager.isAgentActive("non-existent");

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("validateScope", () => {
    it("should validate correct scope", async () => {
      // Arrange
      const validScope = {
        allowedPaths: ["/src", "/lib"],
        allowedDomains: ["api.example.com", "cdn.example.com"],
        maxFileSize: 1024000,
        allowedOperations: ["read", "write", "execute"],
      };

      // Act
      const result = await permissionManager.validateScope(validScope);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect invalid paths", async () => {
      // Arrange
      const invalidScope = {
        allowedPaths: ["relative/path", ""],
        allowedDomains: ["api.example.com"],
        maxFileSize: 1024000,
        allowedOperations: ["read"],
      };

      // Act
      const result = await permissionManager.validateScope(invalidScope);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("allowedPaths must be absolute paths");
    });

    it("should detect invalid domains", async () => {
      // Arrange
      const invalidScope = {
        allowedPaths: ["/src"],
        allowedDomains: ["invalid-domain", ""],
        maxFileSize: 1024000,
        allowedOperations: ["read"],
      };

      // Act
      const result = await permissionManager.validateScope(invalidScope);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "allowedDomains must be valid domain names",
      );
    });

    it("should detect invalid file size", async () => {
      // Arrange
      const invalidScope = {
        allowedPaths: ["/src"],
        allowedDomains: ["api.example.com"],
        maxFileSize: -1,
        allowedOperations: ["read"],
      };

      // Act
      const result = await permissionManager.validateScope(invalidScope);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("maxFileSize must be a positive number");
    });

    it("should detect invalid operations", async () => {
      // Arrange
      const invalidScope = {
        allowedPaths: ["/src"],
        allowedDomains: ["api.example.com"],
        maxFileSize: 1024000,
        allowedOperations: ["invalid-op", ""],
      };

      // Act
      const result = await permissionManager.validateScope(invalidScope);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "allowedOperations contains invalid operations",
      );
    });
  });

  describe("applyTemplate", () => {
    it("should apply permission template to agent", async () => {
      // Arrange
      const agentId = "agent-123";
      const templateName = "read-only";
      const expectedScope = {
        allowedPaths: ["/src", "/lib"],
        allowedDomains: ["api.example.com"],
        maxFileSize: 512000,
        allowedOperations: ["read"],
      };

      mockPrisma.agent.findUnique.mockResolvedValue({ id: agentId });
      mockPrisma.agent.update.mockResolvedValue({ id: agentId });

      // Act
      await permissionManager.applyTemplate(agentId, templateName);

      // Assert
      expect(mockPrisma.agent.update).toHaveBeenCalledWith({
        where: { id: agentId },
        data: {
          permissions: expectedScope,
          updatedAt: expect.any(Date),
        },
      });
    });

    it("should throw error for unknown template", async () => {
      // Act & Assert
      await expect(
        permissionManager.applyTemplate("agent-123", "unknown-template"),
      ).rejects.toThrow("Unknown template: unknown-template");
    });
  });

  describe("AgentStatus enum", () => {
    it("should have correct values", () => {
      expect(AgentStatus.PENDING).toBe("pending");
      expect(AgentStatus.ACTIVE).toBe("active");
      expect(AgentStatus.SUSPENDED).toBe("suspended");
      expect(AgentStatus.TERMINATED).toBe("terminated");
    });
  });
});
