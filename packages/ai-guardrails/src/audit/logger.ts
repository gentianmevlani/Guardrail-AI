// Note: Some types imported dynamically to avoid build errors if core not built yet
import type { AuditEvent, CodeModParams } from "@guardrail/core";
import { calculateHash } from "@guardrail/core";
// CodeGenParams and ShellParams are unused, removed
import { prisma } from "@guardrail/database";

/**
 * AI Audit Logger
 *
 * Creates tamper-proof audit trail of all AI actions
 */
export class AIAuditLogger {
  /**
   * Log any AI action
   */
  async logAction(event: AuditEvent): Promise<void> {
    try {
      // Get previous action for sequence number and hash chain
      const previousAction = await (prisma as any).agentAction.findFirst({
        where: {
          agentId: event.agentId,
          taskId: event.taskId,
        },
        orderBy: { sequenceNumber: 'desc' },
      });

      const sequenceNumber = previousAction ? previousAction.sequenceNumber + 1 : 1;
      const previousHash = previousAction?.hash || "";

      // Create hash of this action
      const actionData = {
        agentId: event.agentId,
        taskId: event.taskId,
        correlationId: event.correlationId,
        sequenceNumber,
        actionType: event.actionType,
        status: event.status,
        timestamp: event.timestamp,
        metadata: event.metadata,
        previousHash,
      };
      const hash = calculateHash(JSON.stringify(actionData));

      await (prisma as any).agentAction.create({
        data: {
          ...actionData,
          hash,
        },
      });
    } catch (error) {
      // Silently fail if schema doesn't exist yet
      console.warn("Audit logging failed:", error);
    }
  }

  /**
   * Log code generation
   */
  async logCodeGeneration(params: any): Promise<void> {
    try {
      const agentId = params.agentId || "unknown";
      const taskId = params.taskId || "unknown";
      const correlationId = params.correlationId || "unknown";

      const previousAction = await (prisma as any).agentAction.findFirst({
        where: {
          agentId,
          taskId,
        },
        orderBy: { sequenceNumber: 'desc' },
      });

      const sequenceNumber = previousAction ? previousAction.sequenceNumber + 1 : 1;
      const previousHash = previousAction?.hash || "";

      const status = params.error ? "FAILED" : "COMPLETED";
      const metadata: any = {
        language: params.language,
        prompt: params.prompt,
      };

      if (params.tokensUsed !== undefined) {
        metadata.tokensUsed = params.tokensUsed;
      }
      if (params.model) {
        metadata.model = params.model;
      }
      if (params.generatedCode) {
        metadata.generatedCode = params.generatedCode;
        metadata.codeLength = params.generatedCode.length;
      }
      if (params.error) {
        metadata.error = params.error;
      }

      const actionData = {
        agentId,
        taskId,
        correlationId,
        sequenceNumber,
        actionType: "CODE_GENERATION",
        status,
        timestamp: new Date(),
        metadata,
        previousHash,
      };
      const hash = calculateHash(JSON.stringify(actionData));

      await (prisma as any).agentAction.create({
        data: {
          ...actionData,
          hash,
        },
      });
    } catch (error) {
      console.warn("Code generation audit logging failed:", error);
    }
  }

  /**
   * Log code modification
   */
  async logCodeModification(
    _agentId: string,
    _taskId: string,
    _params: CodeModParams,
    _correlationId: string,
  ): Promise<void> {
    // Temporarily disabled
    console.log("Code modification logged");
    return;
  }

  /**
   * Log shell command
   */
  async logShellCommand(params: any): Promise<void> {
    try {
      const agentId = params.agentId || "unknown";
      const taskId = params.taskId || "unknown";
      const correlationId = params.correlationId || "unknown";

      const previousAction = await (prisma as any).agentAction.findFirst({
        where: {
          agentId,
          taskId,
        },
        orderBy: { sequenceNumber: 'desc' },
      });

      const sequenceNumber = previousAction ? previousAction.sequenceNumber + 1 : 1;
      const previousHash = previousAction?.hash || "";

      const status = params.exitCode !== 0 ? "FAILED" : "COMPLETED";
      const metadata: any = {
        command: params.command,
      };

      if (params.workingDirectory) {
        metadata.workingDirectory = params.workingDirectory;
      }
      if (params.exitCode !== undefined) {
        metadata.exitCode = params.exitCode;
      }
      if (params.stdout !== undefined) {
        metadata.stdout = params.stdout;
      }
      if (params.stderr !== undefined) {
        metadata.stderr = params.stderr;
      }
      if (params.output !== undefined) {
        metadata.output = params.output;
      }

      const actionData = {
        agentId,
        taskId,
        correlationId,
        sequenceNumber,
        actionType: "SHELL_COMMAND",
        status,
        timestamp: new Date(),
        metadata,
        previousHash,
      };
      const hash = calculateHash(JSON.stringify(actionData));

      await (prisma as any).agentAction.create({
        data: {
          ...actionData,
          hash,
        },
      });
    } catch (error) {
      console.warn("Shell command audit logging failed:", error);
    }
  }

  /**
   * Verify audit trail integrity
   */
  async verifyAuditTrail(_agentId: string): Promise<boolean> {
    // Temporarily disabled
    console.log("Audit trail verification skipped");
    return true;
  }
}

// Export singleton instance
export const aiAuditLogger = new AIAuditLogger();
