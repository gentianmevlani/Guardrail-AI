/**
 * Realtime Events Service
 * 
 * Manages real-time event broadcasting for scans and runs with:
 * - User/tenant scoped subscriptions
 * - Event batching for backpressure
 * - Connection management
 */

import { WebSocket } from "ws";
import { logger } from "../logger";

// ============================================================================
// TYPES
// ============================================================================

export type RunStatus = "queued" | "running" | "complete" | "error" | "cancelled";

export interface RunProgressEvent {
  type: "run.status" | "run.progress" | "run.log" | "run.finding";
  runId: string;
  scanId?: string; // For scans
  userId: string;
  timestamp: string;
  data: {
    status?: RunStatus;
    progress?: number; // 0-100
    log?: string | string[]; // Single line or batched lines
    finding?: {
      id: string;
      type: string;
      severity: string;
      file: string;
      line: number;
      message: string;
    };
    findingsCount?: number;
    error?: string;
  };
}

interface Connection {
  ws: WebSocket;
  userId: string;
  tenantId?: string; // Multi-tenant isolation
  subscriptions: Set<string>; // subscribed run IDs
  logBuffer: Map<string, string[]>; // runId -> log lines (per-run batching)
  lastFlush: Map<string, number>; // runId -> timestamp
  backpressure: Map<string, number>; // runId -> pending message count
}

// ============================================================================
// SERVICE
// ============================================================================

class RealtimeEventsService {
  private connections: Map<WebSocket, Connection> = new Map();
  private readonly LOG_BATCH_SIZE = 10;
  private readonly LOG_BATCH_INTERVAL_MS = 500; // Flush every 500ms
  private readonly MAX_PENDING_MESSAGES = 50; // Backpressure threshold per run
  private readonly BACKPRESSURE_DELAY_MS = 100; // Delay when backpressure detected

  /**
   * Register a WebSocket connection with user authentication
   */
  registerConnection(ws: WebSocket, userId: string, tenantId?: string): void {
    const connection: Connection = {
      ws,
      userId,
      tenantId: tenantId ?? undefined,
      subscriptions: new Set(),
      logBuffer: new Map(),
      lastFlush: new Map(),
      backpressure: new Map(),
    };

    this.connections.set(ws, connection);

    // Set up flush interval for log batching (per-run)
    const flushInterval = setInterval(() => {
      // Flush all run-specific buffers
      for (const runId of connection.subscriptions) {
        this.flushLogBuffer(connection, runId);
      }
    }, this.LOG_BATCH_INTERVAL_MS);

    // Clean up on disconnect
    ws.on("close", () => {
      clearInterval(flushInterval);
      this.connections.delete(ws);
      logger.debug({ userId }, "Realtime connection closed");
    });

    ws.on("error", (error) => {
      logger.error({ userId, error }, "Realtime connection error");
      this.connections.delete(ws);
    });

    logger.info({ userId }, "Realtime connection registered");
  }

  /**
   * Subscribe to a run/scan for realtime updates with run-specific room
   */
  subscribe(ws: WebSocket, runId: string, userId: string): boolean {
    const connection = this.connections.get(ws);
    if (!connection) {
      logger.warn({ runId, userId }, "Connection not found for subscription");
      return false;
    }

    // Verify user owns the run (security check)
    if (connection.userId !== userId) {
      logger.warn(
        { runId, userId, connectionUserId: connection.userId },
        "User mismatch in subscription",
      );
      return false;
    }

    // Create run-specific room ID: run:{runId}:{tenantId} for multi-tenant isolation
    const roomId = connection.tenantId 
      ? `run:${runId}:tenant:${connection.tenantId}`
      : `run:${runId}:user:${userId}`;
    
    connection.subscriptions.add(runId);
    
    // Initialize per-run buffers
    if (!connection.logBuffer.has(runId)) {
      connection.logBuffer.set(runId, []);
      connection.lastFlush.set(runId, Date.now());
      connection.backpressure.set(runId, 0);
    }

    logger.debug({ runId, userId, roomId, tenantId: connection.tenantId }, "Subscribed to run with room");

    // Send confirmation with room info
    this.send(ws, {
      type: "subscribed",
      runId,
      roomId,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Unsubscribe from a run/scan
   */
  unsubscribe(ws: WebSocket, runId: string): void {
    const connection = this.connections.get(ws);
    if (connection) {
      connection.subscriptions.delete(runId);
      logger.debug({ runId, userId: connection.userId }, "Unsubscribed from run");
    }
  }

  /**
   * Emit a status update with tenant scoping
   */
  emitStatus(
    runId: string,
    userId: string,
    status: RunStatus,
    tenantId?: string,
    error?: string,
  ): void {
    const event: RunProgressEvent = {
      type: "run.status",
      runId,
      userId,
      timestamp: new Date().toISOString(),
      data: { status, error },
    };

    this.broadcastToSubscribers(runId, userId, event, tenantId);
  }

  /**
   * Emit a progress update
   */
  emitProgress(
    runId: string,
    userId: string,
    progress: number,
  ): void {
    const event: RunProgressEvent = {
      type: "run.progress",
      runId,
      userId,
      timestamp: new Date().toISOString(),
      data: { progress },
    };

    this.broadcastToSubscribers(runId, userId, event);
  }

  /**
   * Emit a log line (batched per-run with backpressure handling)
   */
  emitLog(
    runId: string,
    userId: string,
    logLine: string,
    tenantId?: string,
  ): void {
    // Find all connections subscribed to this run with tenant isolation
    for (const [ws, connection] of this.connections.entries()) {
      if (
        connection.userId === userId &&
        connection.subscriptions.has(runId) &&
        ws.readyState === WebSocket.OPEN &&
        // Tenant isolation: only send to connections with matching tenant
        (!tenantId || !connection.tenantId || connection.tenantId === tenantId)
      ) {
        // Check backpressure
        const pending = connection.backpressure.get(runId) || 0;
        if (pending >= this.MAX_PENDING_MESSAGES) {
          logger.warn(
            { runId, userId, pending, tenantId },
            "Backpressure detected, skipping log emission",
          );
          continue;
        }

        // Get or create per-run log buffer
        let buffer = connection.logBuffer.get(runId);
        if (!buffer) {
          buffer = [];
          connection.logBuffer.set(runId, buffer);
        }

        buffer.push(logLine);
        connection.backpressure.set(runId, pending + 1);

        // Flush if buffer is full
        if (buffer.length >= this.LOG_BATCH_SIZE) {
          this.flushLogBuffer(connection, runId);
        }
      }
    }
  }

  /**
   * Emit a finding (incremental) with tenant scoping
   */
  emitFinding(
    runId: string,
    userId: string,
    finding: RunProgressEvent["data"]["finding"],
    findingsCount: number,
    tenantId?: string,
  ): void {
    const event: RunProgressEvent = {
      type: "run.finding",
      runId,
      userId,
      timestamp: new Date().toISOString(),
      data: { finding, findingsCount },
    };

    this.broadcastToSubscribers(runId, userId, event, tenantId);
  }

  /**
   * Flush log buffer for a connection
   */
  private flushLogBuffer(connection: Connection, runId?: string): void {
    // If runId provided, flush logs for that specific run
    if (runId && connection.subscriptions.has(runId)) {
      const buffer = connection.logBuffer.get(runId);
      if (buffer && buffer.length > 0) {
        const logs = [...buffer];
        const event: RunProgressEvent = {
          type: "run.log",
          runId,
          scanId: runId, // Use runId as scanId for scans
          userId: connection.userId,
          timestamp: new Date().toISOString(),
          data: { log: logs },
        };

        this.send(connection.ws, event);
        connection.logBuffer.set(runId, []);
        connection.lastFlush.set(runId, Date.now());
        connection.backpressure.set(runId, Math.max(0, (connection.backpressure.get(runId) || 0) - logs.length));
      }
      return;
    }

    // Flush all run-specific buffers that are due
    const now = Date.now();
    for (const [id, buffer] of connection.logBuffer.entries()) {
      if (connection.subscriptions.has(id) && buffer.length > 0) {
        const lastFlush = connection.lastFlush.get(id) || 0;
        if (now - lastFlush >= this.LOG_BATCH_INTERVAL_MS) {
          const logs = [...buffer];
          const event: RunProgressEvent = {
            type: "run.log",
            runId: id,
            scanId: id,
            userId: connection.userId,
            timestamp: new Date().toISOString(),
            data: { log: logs },
          };

          this.send(connection.ws, event);
          connection.logBuffer.set(id, []);
          connection.lastFlush.set(id, now);
          connection.backpressure.set(id, Math.max(0, (connection.backpressure.get(id) || 0) - logs.length));
        }
      }
    }
  }

  /**
   * Broadcast event to all subscribers of a run
   */
  private broadcastToSubscribers(
    runId: string,
    userId: string,
    event: RunProgressEvent,
    tenantId?: string,
  ): void {
    let sentCount = 0;

    for (const [ws, connection] of this.connections.entries()) {
      if (
        connection.userId === userId &&
        connection.subscriptions.has(runId) &&
        ws.readyState === WebSocket.OPEN &&
        (!tenantId || !connection.tenantId || connection.tenantId === tenantId)
      ) {
        try {
          this.send(ws, event);
          sentCount++;
        } catch (error) {
          logger.error(
            { runId, userId, error },
            "Failed to send realtime event",
          );
        }
      }
    }

    if (sentCount > 0) {
      logger.debug(
        { runId, userId, sentCount, eventType: event.type },
        "Realtime event broadcasted",
      );
    }
  }

  /**
   * Send a message to a WebSocket connection with backpressure handling
   * Returns true if sent successfully, false if backpressure detected
   */
  private send(ws: WebSocket, message: any): boolean {
    if (ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      // Check if buffer is full (backpressure)
      if (ws.bufferedAmount > 1024 * 1024) { // 1MB threshold
        logger.warn({ bufferedAmount: ws.bufferedAmount }, "WebSocket buffer full, backpressure detected");
        return false;
      }

      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error({ error }, "Failed to send WebSocket message");
      return false;
    }
  }

  /**
   * Get connection count for a user
   */
  getConnectionCount(userId: string): number {
    let count = 0;
    for (const connection of this.connections.values()) {
      if (connection.userId === userId) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get subscription count for a run
   */
  getSubscriptionCount(runId: string): number {
    let count = 0;
    for (const connection of this.connections.values()) {
      if (connection.subscriptions.has(runId)) {
        count++;
      }
    }
    return count;
  }
}

// Export singleton instance
export const realtimeEventsService = new RealtimeEventsService();
