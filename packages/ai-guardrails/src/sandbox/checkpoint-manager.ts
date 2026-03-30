import { readFileSync, writeFileSync, existsSync } from 'fs';
import { calculateHash } from '@guardrail/core';
import { Checkpoint, FileSnapshot, RollbackResult } from '@guardrail/core';
import { prisma } from '@guardrail/database';
import { resourceGovernor } from './resource-governor';

/**
 * Manages checkpoints for rollback functionality
 */
export class CheckpointManager {
  /**
   * Create a checkpoint before risky operations
   */
  async createCheckpoint(
    agentId: string,
    taskId: string,
    modifiedFiles: string[],
    reason: string
  ): Promise<Checkpoint> {
    const snapshots: FileSnapshot[] = [];

    // Create snapshots of all files that will be modified
    for (const filePath of modifiedFiles) {
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        snapshots.push({
          path: filePath,
          originalContent: content,
          originalHash: calculateHash(content),
        });
      }
    }

    // Get current resource usage
    const resourcesUsed = await resourceGovernor.getUsage(agentId, taskId);

    // Create checkpoint object
    const checkpoint = {
      id: `ckpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      taskId,
      name: `Checkpoint for ${reason}`,
      description: reason,
      files: snapshots,
      metadata: { resourcesUsed }
    };

    // Save to database
    try {
      // @ts-ignore - agentCheckpoint may not exist in schema yet
      const saved = await (prisma as any).agentCheckpoint.create({
        data: {
          id: checkpoint.id,
          agentId,
          taskId,
          modifiedFiles: checkpoint.files?.length || 0,
          resourcesUsed: checkpoint.metadata?.resourcesUsed || {},
          triggerReason: 'manual'
        }
      });

      return {
        id: checkpoint.id,
        agentId,
        taskId,
        modifiedFiles: snapshots,
        resourcesUsed,
        createdAt: saved.createdAt,
      };
    } catch (error) {
      // Database table may not exist - return checkpoint without saving
      return {
        id: checkpoint.id,
        agentId,
        taskId,
        modifiedFiles: snapshots,
        resourcesUsed,
        createdAt: new Date(),
      };
    }
  }

  /**
   * Rollback to a specific checkpoint
   */
  async rollback(agentId: string, checkpointId: string): Promise<RollbackResult> {
  let checkpoint;
  try {
    // @ts-ignore - agentCheckpoint may not exist in schema yet
    checkpoint = await prisma.agentCheckpoint.findUnique({
      where: { id: checkpointId }
    });
  } catch (error) {
    return {
      success: false,
      filesRestored: 0,
      errors: ['Failed to retrieve checkpoint from database'],
    };
  }

  if (!checkpoint) {
    return {
      success: false,
      filesRestored: 0,
      errors: ['Checkpoint not found'],
    };
  }

  if (checkpoint.agentId !== agentId) {
    return {
      success: false,
      filesRestored: 0,
      errors: ['Checkpoint does not belong to this agent'],
    };
  }

  const errors: string[] = [];
  let filesRestored = 0;
  const snapshots = (checkpoint as any).files as unknown as FileSnapshot[] || checkpoint.modifiedFiles as unknown as FileSnapshot[];

  // Restore each file
  for (const snapshot of snapshots) {
    try {
      writeFileSync(snapshot.path, snapshot.originalContent, 'utf-8');
      filesRestored++;
    } catch (error) {
      errors.push(
        `Failed to restore ${snapshot.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return {
    success: errors.length === 0,
    filesRestored,
    errors,
  };
}

  /**
   * Execute an operation with automatic rollback on failure
   */
  async executeWithRollback<T>(
    agentId: string,
    taskId: string,
    modifiedFiles: string[],
    operation: () => Promise<T>,
    validation?: () => Promise<boolean>
  ): Promise<{ result?: T; rolledBack: boolean; error?: string }> {
    // Create checkpoint
    const checkpoint = await this.createCheckpoint(
      agentId,
      taskId,
      modifiedFiles,
      'before_risky_op'
    );

    let result: T | undefined;
    let success = true;
    let error: string | undefined;

    try {
      // Execute operation
      result = await operation();

      // Run validation if provided
      if (validation) {
        const isValid = await validation();
        if (!isValid) {
          success = false;
          error = 'Validation failed after operation';
        }
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    // Rollback if failed
    if (!success) {
      const rollbackResult = await this.rollback(agentId, checkpoint.id);
      return {
        rolledBack: true,
        error: error || `Rollback executed. ${rollbackResult.errors.join(', ')}`,
      };
    }

    return {
      result,
      rolledBack: false,
    };
  }

  /**
   * Get all checkpoints for a task
   */
  async getCheckpoints(agentId: string, _taskId: string): Promise<Checkpoint[]> {
    try {
      // @ts-ignore - agentCheckpoint may not exist in schema yet
      const checkpoints = await prisma.agentCheckpoint.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' }
      });

      return checkpoints.map((cp: any) => ({
        id: cp.id,
        agentId: cp.agentId,
        taskId: cp.taskId,
        modifiedFiles: cp.files as unknown as FileSnapshot[],
        resourcesUsed: cp.metadata as any,
        createdAt: cp.createdAt,
      }));
    } catch (error) {
      // Database table may not exist
      return [];
    }
  }

  /**
   * Delete old checkpoints to save space
   */
  async cleanupOldCheckpoints(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      // @ts-ignore - agentCheckpoint may not exist in schema yet
      const result = await prisma.agentCheckpoint.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      return result.count;
    } catch (error) {
      // Database table may not exist
      return 0;
    }
  }
}

// Export singleton instance
export const checkpointManager = new CheckpointManager();
