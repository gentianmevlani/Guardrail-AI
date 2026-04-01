// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AIAuditLogger } from "../../audit/logger";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    agentAction: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@guardrail/database", () => ({
  prisma: mockPrisma,
}));

vi.mock("@guardrail/core", () => ({
  calculateHash: vi.fn((input: string) => `hash-${input.slice(0, 80)}`),
}));

describe("AIAuditLogger", () => {
  let auditLogger: AIAuditLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    auditLogger = new AIAuditLogger();
  });

  describe("logAction", () => {
    it("persists an action with sequence 1 when no prior row", async () => {
      mockPrisma.agentAction.findFirst.mockResolvedValue(null);
      mockPrisma.agentAction.create.mockResolvedValue({ id: "a1" });

      const event = {
        agentId: "agent-1",
        taskId: "task-1",
        correlationId: "c1",
        actionType: "CODE_GENERATION",
        status: "COMPLETED",
        timestamp: new Date(),
        metadata: { language: "ts" },
      };

      await auditLogger.logAction(event);

      expect(mockPrisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agentId: event.agentId,
          taskId: event.taskId,
          sequenceNumber: 1,
          previousHash: "",
          hash: expect.any(String),
        }),
      });
    });

    it("increments sequence when a prior action exists", async () => {
      mockPrisma.agentAction.findFirst.mockResolvedValue({
        sequenceNumber: 2,
        hash: "prev",
      });
      mockPrisma.agentAction.create.mockResolvedValue({ id: "a2" });

      const event = {
        agentId: "agent-1",
        taskId: "task-1",
        correlationId: "c1",
        actionType: "CODE_GENERATION",
        status: "COMPLETED",
        timestamp: new Date(),
        metadata: {},
      };

      await auditLogger.logAction(event);

      expect(mockPrisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sequenceNumber: 3,
          previousHash: "prev",
        }),
      });
    });
  });

  describe("logCodeGeneration", () => {
    it("writes CODE_GENERATION with metadata", async () => {
      mockPrisma.agentAction.findFirst.mockResolvedValue(null);
      mockPrisma.agentAction.create.mockResolvedValue({ id: "a1" });

      await auditLogger.logCodeGeneration({
        agentId: "ag",
        taskId: "tk",
        correlationId: "co",
        language: "ts",
        prompt: "hi",
        generatedCode: "x",
        tokensUsed: 10,
        model: "gpt-4o-mini",
      });

      expect(mockPrisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: "CODE_GENERATION",
          status: "COMPLETED",
          metadata: expect.objectContaining({
            language: "ts",
            tokensUsed: 10,
            model: "gpt-4o-mini",
          }),
        }),
      });
    });
  });

  describe("logCodeModification", () => {
    it("is currently a no-op stub (does not hit prisma)", async () => {
      await auditLogger.logCodeModification(
        "a",
        "t",
        {} as any,
        "c",
      );
      expect(mockPrisma.agentAction.create).not.toHaveBeenCalled();
    });
  });

  describe("logShellCommand", () => {
    it("persists shell metadata without risk scoring fields", async () => {
      mockPrisma.agentAction.findFirst.mockResolvedValue(null);
      mockPrisma.agentAction.create.mockResolvedValue({ id: "a1" });

      await auditLogger.logShellCommand({
        agentId: "ag",
        taskId: "tk",
        correlationId: "co",
        command: "ls",
        workingDirectory: "/tmp",
        exitCode: 0,
        stdout: "ok",
        stderr: "",
      });

      expect(mockPrisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: "SHELL_COMMAND",
          status: "COMPLETED",
          metadata: expect.objectContaining({
            command: "ls",
            workingDirectory: "/tmp",
            exitCode: 0,
          }),
        }),
      });
    });
  });

  describe("verifyAuditTrail", () => {
    it("returns true (stub implementation)", async () => {
      const ok = await auditLogger.verifyAuditTrail("agent-1");
      expect(ok).toBe(true);
    });
  });
});
