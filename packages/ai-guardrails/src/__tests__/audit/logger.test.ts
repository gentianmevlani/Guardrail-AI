// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { AIAuditLogger } from "../../audit/logger";

// Mock dependencies
const mockPrisma = {
  agentAction: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockDiff = {
  createPatch: jest.fn(),
};

// Mock modules
jest.mock("@guardrail/database", () => ({
  prisma: mockPrisma,
  ActionType: {
    CODE_GENERATION: "CODE_GENERATION",
    CODE_MODIFICATION: "CODE_MODIFICATION",
    SHELL_COMMAND: "SHELL_COMMAND",
  },
  ActionStatus: {
    PENDING: "PENDING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
  },
  RiskLevel: {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
  },
}));

jest.mock("@guardrail/core", () => ({
  calculateHash: jest.fn((input) => `hash-${JSON.stringify(input)}`),
  AuditEvent: {},
  Diff: {},
  CodeGenParams: {},
  CodeModParams: {},
  ShellParams: {},
}));

jest.mock("diff", () => ({
  createPatch: mockDiff.createPatch,
}));

describe("AIAuditLogger", () => {
  let auditLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogger = new AIAuditLogger();
  });

  describe("logAction", () => {
    it("should log an action with sequence number", async () => {
      // Arrange
      const event = {
        agentId: "agent-123",
        taskId: "task-456",
        correlationId: "corr-789",
        actionType: "CODE_GENERATION",
        status: "COMPLETED",
        timestamp: new Date(),
        metadata: { language: "typescript" },
      };

      mockPrisma.agentAction.findFirst.mockResolvedValue(null);
      mockPrisma.agentAction.create.mockResolvedValue({ id: "action-1" });

      // Act
      const result = await auditLogger.logAction(event);

      // Assert
      expect(result).toBeDefined();
      expect(mockPrisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agentId: event.agentId,
          taskId: event.taskId,
          correlationId: event.correlationId,
          sequenceNumber: 1,
          actionType: event.actionType,
          status: event.status,
          timestamp: event.timestamp,
          metadata: event.metadata,
          hash: expect.any(String),
          previousHash: "",
        }),
      });
    });

    it("should increment sequence number for same agent/task", async () => {
      // Arrange
      const event = {
        agentId: "agent-123",
        taskId: "task-456",
        correlationId: "corr-789",
        actionType: "CODE_GENERATION",
        status: "COMPLETED",
        timestamp: new Date(),
      };

      mockPrisma.agentAction.findFirst.mockResolvedValue({
        hash: "previous-hash",
        sequenceNumber: 1,
      });
      mockPrisma.agentAction.create.mockResolvedValue({ id: "action-2" });

      // Act
      await auditLogger.logAction(event);
      const result = await auditLogger.logAction(event);

      // Assert
      expect(mockPrisma.agentAction.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          sequenceNumber: 2,
          previousHash: "previous-hash",
        }),
      });
    });
  });

  describe("logCodeGeneration", () => {
    it("should log code generation event", async () => {
      // Arrange
      const params = {
        agentId: "agent-123",
        taskId: "task-456",
        correlationId: "corr-789",
        language: "typescript",
        prompt: "Create a function",
        generatedCode: "function test() { return true; }",
        tokensUsed: 150,
        model: "gpt-4",
      };

      mockPrisma.agentAction.findFirst.mockResolvedValue(null);
      mockPrisma.agentAction.create.mockResolvedValue({ id: "action-1" });

      // Act
      const result = await auditLogger.logCodeGeneration(params);

      // Assert
      expect(mockPrisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agentId: params.agentId,
          taskId: params.taskId,
          correlationId: params.correlationId,
          actionType: "CODE_GENERATION",
          status: "COMPLETED",
          metadata: {
            language: params.language,
            prompt: params.prompt,
            generatedCode: params.generatedCode,
            tokensUsed: params.tokensUsed,
            model: params.model,
            codeLength: params.generatedCode.length,
          },
        }),
      });
    });

    it("should handle failed code generation", async () => {
      // Arrange
      const params = {
        agentId: "agent-123",
        taskId: "task-456",
        correlationId: "corr-789",
        language: "typescript",
        prompt: "Create a function",
        error: "Generation failed",
        tokensUsed: 50,
        model: "gpt-4",
      };

      mockPrisma.agentAction.findFirst.mockResolvedValue(null);
      mockPrisma.agentAction.create.mockResolvedValue({ id: "action-1" });

      // Act
      const result = await auditLogger.logCodeGeneration(params);

      // Assert
      expect(mockPrisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "FAILED",
          metadata: expect.objectContaining({
            error: params.error,
          }),
        }),
      });
    });
  });

  describe("logCodeModification", () => {
    it("should log code modification with diff", async () => {
      // Arrange
      const params = {
        agentId: "agent-123",
        taskId: "task-456",
        correlationId: "corr-789",
        filePath: "/src/test.ts",
        originalCode: "function old() { return false; }",
        modifiedCode: "function new() { return true; }",
        reason: "Fix bug",
      };

      const mockPatch =
        "@@ -1,1 +1,1 @@\n-function old() { return false; }\n+function new() { return true; }";
      mockDiff.createPatch.mockReturnValue(mockPatch);

      mockPrisma.agentAction.findFirst.mockResolvedValue(null);
      mockPrisma.agentAction.create.mockResolvedValue({ id: "action-1" });

      // Act
      const result = await auditLogger.logCodeModification(params);

      // Assert
      expect(mockDiff.createPatch).toHaveBeenCalledWith(
        "file",
        params.originalCode,
        params.modifiedCode,
        "",
        "",
      );

      expect(mockPrisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: "CODE_MODIFICATION",
          metadata: expect.objectContaining({
            filePath: params.filePath,
            originalCode: params.originalCode,
            modifiedCode: params.modifiedCode,
            diff: mockPatch,
            reason: params.reason,
            linesAdded: 1,
            linesDeleted: 1,
            riskLevel: "LOW",
          }),
        }),
      });
    });

    it("should assess high risk for large changes", async () => {
      // Arrange
      const params = {
        agentId: "agent-123",
        taskId: "task-456",
        correlationId: "corr-789",
        filePath: "/src/test.ts",
        originalCode: "old",
        modifiedCode: "new\n".repeat(200), // 200 lines
        reason: "Major refactor",
      };

      mockDiff.createPatch.mockReturnValue("large diff");
      mockPrisma.agentAction.findFirst.mockResolvedValue(null);
      mockPrisma.agentAction.create.mockResolvedValue({ id: "action-1" });

      // Act
      const result = await auditLogger.logCodeModification(params);

      // Assert
      expect(mockPrisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            riskLevel: "HIGH",
          }),
        }),
      });
    });
  });

  describe("logShellCommand", () => {
    it("should log shell command with risk assessment", async () => {
      // Arrange
      const params = {
        agentId: "agent-123",
        taskId: "task-456",
        correlationId: "corr-789",
        command: "ls -la",
        workingDirectory: "/home/user",
        exitCode: 0,
        stdout: "file1.txt\nfile2.txt",
        stderr: "",
      };

      mockPrisma.agentAction.findFirst.mockResolvedValue(null);
      mockPrisma.agentAction.create.mockResolvedValue({ id: "action-1" });

      // Act
      const result = await auditLogger.logShellCommand(params);

      // Assert
      expect(mockPrisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: "SHELL_COMMAND",
          status: "COMPLETED",
          metadata: expect.objectContaining({
            command: params.command,
            workingDirectory: params.workingDirectory,
            exitCode: params.exitCode,
            stdout: params.stdout,
            stderr: params.stderr,
            riskLevel: "LOW",
          }),
        }),
      });
    });

    it("should assess critical risk for dangerous commands", async () => {
      // Arrange
      const params = {
        agentId: "agent-123",
        taskId: "task-456",
        correlationId: "corr-789",
        command: "rm -rf /important/data",
        workingDirectory: "/",
        exitCode: 0,
        stdout: "",
        stderr: "",
      };

      mockPrisma.agentAction.findFirst.mockResolvedValue(null);
      mockPrisma.agentAction.create.mockResolvedValue({ id: "action-1" });

      // Act
      const result = await auditLogger.logShellCommand(params);

      // Assert
      expect(mockPrisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            riskLevel: "CRITICAL",
            riskFactors: expect.arrayContaining(["Contains dangerous command"]),
          }),
        }),
      });
    });

    it("should mark failed commands", async () => {
      // Arrange
      const params = {
        agentId: "agent-123",
        taskId: "task-456",
        correlationId: "corr-789",
        command: "invalid-command",
        workingDirectory: "/tmp",
        exitCode: 127,
        stdout: "",
        stderr: "command not found",
      };

      mockPrisma.agentAction.findFirst.mockResolvedValue(null);
      mockPrisma.agentAction.create.mockResolvedValue({ id: "action-1" });

      // Act
      const result = await auditLogger.logShellCommand(params);

      // Assert
      expect(mockPrisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "FAILED",
          metadata: expect.objectContaining({
            exitCode: params.exitCode,
            stderr: params.stderr,
          }),
        }),
      });
    });
  });

  describe("verifyChainIntegrity", () => {
    it("should verify hash chain integrity", async () => {
      // Arrange
      const agentId = "agent-123";
      const taskId = "task-456";

      const mockActions = [
        {
          sequenceNumber: 1,
          hash: "hash1",
          previousHash: "",
        },
        {
          sequenceNumber: 2,
          hash: "hash2",
          previousHash: "hash1",
        },
        {
          sequenceNumber: 3,
          hash: "hash3",
          previousHash: "hash2",
        },
      ];

      mockPrisma.agentAction.findMany.mockResolvedValue(mockActions);

      // Act
      const result = await auditLogger.verifyChainIntegrity(agentId, taskId);

      // Assert
      expect(result).toBe(true);
      expect(mockPrisma.agentAction.findMany).toHaveBeenCalledWith({
        where: {
          agentId,
          taskId,
        },
        orderBy: {
          sequenceNumber: "asc",
        },
      });
    });

    it("should detect broken chain", async () => {
      // Arrange
      const agentId = "agent-123";
      const taskId = "task-456";

      const mockActions = [
        {
          sequenceNumber: 1,
          hash: "hash1",
          previousHash: "",
        },
        {
          sequenceNumber: 2,
          hash: "hash2",
          previousHash: "wrong-hash", // Break in chain
        },
      ];

      mockPrisma.agentAction.findMany.mockResolvedValue(mockActions);

      // Act
      const result = await auditLogger.verifyChainIntegrity(agentId, taskId);

      // Assert
      expect(result).toBe(false);
    });

    it("should handle empty chain", async () => {
      // Arrange
      mockPrisma.agentAction.findMany.mockResolvedValue([]);

      // Act
      const result = await auditLogger.verifyChainIntegrity(
        "agent-123",
        "task-456",
      );

      // Assert
      expect(result).toBe(true);
    });
  });
});
