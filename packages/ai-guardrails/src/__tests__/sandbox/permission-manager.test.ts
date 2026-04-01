// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PermissionTemplates } from "../../sandbox/templates";
import { PermissionManager } from "../../sandbox/permission-manager";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    agent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    agentPermission: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@guardrail/database", () => ({
  prisma: mockPrisma,
}));

describe("PermissionManager", () => {
  let pm: PermissionManager;
  const validScope = PermissionTemplates.codeReviewer;

  beforeEach(() => {
    vi.clearAllMocks();
    pm = new PermissionManager();
  });

  describe("registerAgent", () => {
    it("validates scope and resolves when prisma agent is missing", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);
      await expect(
        pm.registerAgent("a1", "n", "t", validScope),
      ).resolves.toBeUndefined();
      expect(mockPrisma.agent.findUnique).toHaveBeenCalledWith({
        where: { id: "a1" },
      });
    });
  });

  describe("getPermissions", () => {
    it("maps first agentPermission row to AgentPermissionScope", async () => {
      mockPrisma.agentPermission.findMany.mockResolvedValue([
        {
          filesystem: validScope.filesystem,
          network: validScope.network,
          shell: validScope.shell,
          resources: validScope.resources,
        },
      ]);

      const result = await pm.getPermissions("a1");
      expect(result?.filesystem.operations).toContain("read");
      expect(mockPrisma.agentPermission.findMany).toHaveBeenCalled();
    });

    it("returns null when no rows", async () => {
      mockPrisma.agentPermission.findMany.mockResolvedValue([]);
      await expect(pm.getPermissions("none")).resolves.toBeNull();
    });
  });

  describe("suspendAgent / reactivateAgent / revokeAgent", () => {
    it("suspend sets status SUSPENDED", async () => {
      mockPrisma.agent.update.mockResolvedValue({});
      await pm.suspendAgent("a1", "reason", "u1");
      expect(mockPrisma.agent.update).toHaveBeenCalledWith({
        where: { id: "a1" },
        data: { status: "SUSPENDED" },
      });
    });

    it("reactivate sets ACTIVE", async () => {
      mockPrisma.agent.update.mockResolvedValue({});
      await pm.reactivateAgent("a1");
      expect(mockPrisma.agent.update).toHaveBeenCalledWith({
        where: { id: "a1" },
        data: { status: "ACTIVE" },
      });
    });

    it("revoke sets TERMINATED via update", async () => {
      mockPrisma.agent.update.mockResolvedValue({});
      await pm.revokeAgent("a1");
      expect(mockPrisma.agent.update).toHaveBeenCalledWith({
        where: { id: "a1" },
        data: { status: "TERMINATED" },
      });
    });
  });

  describe("isAgentActive", () => {
    it("returns true when status is ACTIVE", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({ status: "ACTIVE" });
      await expect(pm.isAgentActive("a1")).resolves.toBe(true);
    });

    it("returns false when missing", async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);
      await expect(pm.isAgentActive("a1")).resolves.toBe(false);
    });
  });

  describe("validateScope", () => {
    it("accepts a well-formed template scope", async () => {
      const v = await pm.validateScope(PermissionTemplates.codeReviewer);
      expect(v.valid).toBe(true);
    });
  });

  describe("applyTemplate", () => {
    it("throws when template name is unknown", async () => {
      mockPrisma.agentPermission.findMany.mockResolvedValue([]);
      await expect(pm.applyTemplate("a1", "unknown-template")).rejects.toThrow(
        /not found/,
      );
    });

    it("applies codeReviewer template keys", async () => {
      mockPrisma.agentPermission.findMany.mockResolvedValue([
        {
          id: "p1",
          filesystem: validScope.filesystem,
          network: validScope.network,
          shell: validScope.shell,
          resources: validScope.resources,
        },
      ]);
      mockPrisma.agentPermission.findFirst.mockResolvedValue({ id: "p1" });
      mockPrisma.agentPermission.update.mockResolvedValue({});

      await pm.applyTemplate("a1", "codeReviewer");
      expect(mockPrisma.agentPermission.update).toHaveBeenCalled();
    });
  });
});
