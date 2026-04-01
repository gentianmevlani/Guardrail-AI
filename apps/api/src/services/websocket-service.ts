/**
 * WebSocket Service for API
 */

import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { logger } from "../logger";

interface RoomInfo {
  id: string;
  name: string;
  users: string[];
  createdAt: Date;
}

interface WebSocketStats {
  totalConnections: number;
  activeRooms: number;
  messagesPerMinute: number;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private rooms: Map<string, RoomInfo> = new Map();
  private stats: WebSocketStats = {
    totalConnections: 0,
    activeRooms: 0,
    messagesPerMinute: 0,
  };

  constructor(server: Server | null) {
    if (server) {
      this.initialize(server);
    }
  }

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      this.stats.totalConnections++;
      logger.debug("New WebSocket connection");

      ws.on("message", (data) => {
        logger.debug(
          { message: data.toString().substring(0, 100) },
          "WebSocket message received",
        );
      });

      ws.on("close", () => {
        logger.debug("WebSocket disconnected");
      });
    });
  }

  broadcast(message: any) {
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    }
  }

  getActiveRooms(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }

  getStats(): WebSocketStats {
    return {
      ...this.stats,
      activeRooms: this.rooms.size,
    };
  }

  getRoomInfo(roomId: string): RoomInfo | null {
    return this.rooms.get(roomId) || null;
  }

  createRoom(roomId: string, name: string, _userId: string): RoomInfo {
    const room: RoomInfo = {
      id: roomId,
      name,
      users: [],
      createdAt: new Date(),
    };
    this.rooms.set(roomId, room);
    return room;
  }

  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  sendGlobalNotification(notification: any): void {
    this.broadcast({ type: "notification", data: notification });
  }

  /**
   * Broadcast dashboard summary update to all connected clients
   */
  broadcastDashboardUpdate(summary: any): void {
    this.broadcast({
      type: "dashboard-update",
      data: { summary },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast a new activity event to all connected clients
   */
  broadcastActivityEvent(event: any): void {
    this.broadcast({
      type: "activity-event",
      data: event,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast health score update
   */
  broadcastHealthUpdate(healthScore: any): void {
    this.broadcast({
      type: "health-update",
      data: healthScore,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast scan started event
   */
  broadcastScanStarted(scanId: string, metadata?: unknown): void {
    const meta =
      metadata !== null && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};
    this.broadcast({
      type: "scan-started",
      data: { scanId, ...meta },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast scan progress event
   */
  broadcastScanProgress(
    scanId: string,
    progress: number,
    status: string,
    details?: unknown,
  ): void {
    const det =
      details !== null && typeof details === "object" && !Array.isArray(details)
        ? (details as Record<string, unknown>)
        : {};
    this.broadcast({
      type: "scan-progress",
      data: { scanId, progress, status, ...det },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast scan completed event
   */
  broadcastScanComplete(scanId: string, result: any): void {
    this.broadcast({
      type: "scan-complete",
      data: { scanId, ...result },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast findings update (e.g., when new vulnerabilities are found)
   */
  broadcastFindingsUpdate(findings: any): void {
    this.broadcast({
      type: "findings-update",
      data: findings,
      timestamp: new Date().toISOString(),
    });
  }

  joinRoom(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (room && !room.users.includes(userId)) {
      room.users.push(userId);
      return true;
    }
    return false;
  }

  leaveRoom(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (room) {
      room.users = room.users.filter((u) => u !== userId);
      return true;
    }
    return false;
  }

  handleMessage(
    _ws: any,
    message: { type: string; roomId?: string; userId?: string; payload?: unknown },
  ): void {
    // Handle different message types
    logger.debug(
      { type: message.type, roomId: message.roomId },
      "WebSocket message handled",
    );

    // Broadcast to room if applicable
    if (message.roomId) {
      this.broadcast({
        type: message.type,
        data: message.payload,
        roomId: message.roomId,
      });
    }
  }
}

export const webSocketService = new WebSocketService(null);

// Alias for compatibility
export const enhancedWebSocketService = webSocketService;
