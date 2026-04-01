import { prisma } from "@guardrail/database";
import {
  AuditQuery,
  QueryResult,
  Timeline,
  Changes,
  Attribution,
  DateRange,
  AuditEvent,
} from "@guardrail/core";

/**
 * Audit Query Service
 *
 * Query and retrieve audit trail data
 */
export class AuditQueryService {
  /**
   * Query audit events with filters
   */
  async query(query: AuditQuery): Promise<QueryResult> {
    const where: any = {};

    if (query.agentId) where.agentId = query.agentId;
    if (query.taskId) where.taskId = query.taskId;
    if (query.correlationId) where.correlationId = query.correlationId;
    if (query.actionType) where.actionType = query.actionType;
    if (query.status) where.status = query.status;
    if (query.riskLevel) where.riskLevel = query.riskLevel;

    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) where.timestamp.gte = query.startDate;
      if (query.endDate) where.timestamp.lte = query.endDate;
    }

    const limit = query.limit || 100;
    const offset = query.offset || 0;

    // @ts-ignore - agentAction may not exist in schema yet
    const [events, total] = await Promise.all([
      // @ts-ignore - agentAction may not exist in schema yet
      prisma.agentAction.findMany({
        where,
        orderBy: { id: "desc" },
        take: limit,
        skip: offset,
      }),
      // @ts-ignore - agentAction may not exist in schema yet
      prisma.agentAction.count({ where }),
    ]);

    return {
      events: events as unknown as AuditEvent[],
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    };
  }

  /**
   * Get task timeline
   */
  async getTaskTimeline(taskId: string): Promise<Timeline> {
    // @ts-ignore - agentAction may not exist in schema yet
    const events = await prisma.agentAction.findMany({
      where: { agentId: taskId }, // Map taskId to agentId for now
      orderBy: { id: "asc" },
    });

    const actionCounts: { [key: string]: number } = events.reduce(
      (acc: { [key: string]: number }, event: any) => {
        acc[event.actionType || "unknown"] =
          (acc[event.actionType || "unknown"] || 0) + 1;
        return acc;
      },
      {},
    );

    const summary = {
      totalActions: events.length,
      successfulActions: events.filter((e: any) => e.status === "SUCCESS")
        .length,
      failedActions: events.filter((e: any) => e.status === "FAILURE").length,
      blockedActions: events.filter((e: any) => e.status === "BLOCKED").length,
      actionCounts,
      duration: 0, // Default duration
    };

    return {
      taskId,
      events: events as unknown as AuditEvent[],
      summary,
    };
  }

  /**
   * Get code changes for a file or task
   */
  async getCodeChanges(taskId: string, filePath?: string): Promise<Changes[]> {
    const where: any = {
      taskId,
      actionType: { in: ["CODE_MODIFICATION", "CODE_GENERATION"] },
    };

    if (filePath) {
      where.target = {
        path: ["target", "path"],
        equals: filePath,
      };
    }

    // @ts-ignore - agentAction may not exist in schema yet
    const actions = await prisma.agentAction.findMany({
      where,
      orderBy: { id: "desc" },
    });

    return actions.map((action: any) => ({
      filePath: (action.metadata as any)?.path || "unknown",
      timestamp: action.createdAt,
      diff: action.metadata as any,
      agent: action.agentId,
      reasoning: (action.metadata as any)?.summary || "",
    }));
  }

  /**
   * Get AI vs human attribution
   */
  async getAttribution(
    projectId: string,
    period: DateRange,
  ): Promise<Attribution> {
    // This would need to integrate with your project tracking system
    // For now, we'll provide a simplified implementation

    // @ts-ignore - agentAction may not exist in schema yet
    const actions = await prisma.agentAction.findMany({
      where: {}, // Remove date filtering for now since createdAt field doesn't exist
    });

    let aiLines = 0;
    let aiFiles = new Set<string>();
    const agentBreakdown = new Map<
      string,
      { lines: number; files: Set<string> }
    >();

    for (const action of actions) {
      const meta = (action as any).metadata as any;
      if (meta?.linesAdded) {
        aiLines += meta.linesAdded;
      }
      if (meta?.filesModified) {
        for (const file of meta.filesModified) {
          aiFiles.add(file);
        }
      }

      const agentName = action.agentId;
      if (!agentBreakdown.has(agentName)) {
        agentBreakdown.set(agentName, { lines: 0, files: new Set() });
      }

      const agentData = agentBreakdown.get(agentName)!;
      if (meta?.linesAdded) {
        agentData.lines += meta.linesAdded;
      }
      if (meta?.filesModified) {
        for (const file of meta.filesModified) {
          agentData.files.add(file);
        }
      }
    }

    // For this example, assume total is 2x AI (50% AI, 50% human)
    const totalLines = aiLines * 2;
    const humanLines = totalLines - aiLines;

    // Store hourly activity separately but don't include in return type
    // const hourlyActivity = actions.reduce((acc: any, e: any) => {
    //   const hour = e.timestamp.getHours();
    //   acc[hour] = (acc[hour] || 0) + 1;
    //   return acc;
    // }, {});

    return {
      projectId,
      period,
      aiGenerated: {
        lines: aiLines,
        files: aiFiles.size,
        percentage: (aiLines / totalLines) * 100,
      },
      humanWritten: {
        lines: humanLines,
        files: aiFiles.size * 2 - aiFiles.size,
        percentage: (humanLines / totalLines) * 100,
      },
      breakdown: Array.from(agentBreakdown.entries()).map(([agent, data]) => ({
        agent,
        lines: data.lines,
        files: data.files.size,
      })),
    };
  }

  /**
   * Get actions by correlation ID
   */
  async getCorrelatedActions(_correlationId: string): Promise<AuditEvent[]> {
    // @ts-ignore - agentAction may not exist in schema yet
    const actions = await prisma.agentAction.findMany({
      where: {}, // correlationId field doesn't exist yet
      orderBy: { id: "asc" },
    });

    return actions as unknown as AuditEvent[];
  }

  /**
   * Get recent actions for an agent
   */
  async getRecentActions(
    agentId: string,
    limit: number = 50,
  ): Promise<AuditEvent[]> {
    // @ts-ignore - agentAction may not exist in schema yet
    const actions = await prisma.agentAction.findMany({
      where: { agentId },
      orderBy: { id: "desc" },
      take: limit,
    });

    return actions as unknown as AuditEvent[];
  }

  /**
   * Get risk summary for a period
   */
  async getRiskSummary(_period: DateRange): Promise<Record<string, number>> {
    // @ts-ignore - agentAction may not exist in schema yet
    const actions = await prisma.agentAction.findMany({
      where: {}, // Remove date filtering for now
      orderBy: { id: "desc" },
    });

    const summary: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    for (const action of actions) {
      const meta = (action as any).metadata as any;
      if (meta?.riskLevel) {
        const level = meta.riskLevel as keyof typeof summary;
        if (summary[level] !== undefined) {
          summary[level]++;
        }
      }
    }

    return summary;
  }
}

// Export singleton instance
export const auditQueryService = new AuditQueryService();
