/**
 * Broadcast Utilities
 *
 * Centralized utilities for broadcasting real-time updates to connected clients
 * via WebSocket and SSE. Use these functions throughout the API to push updates.
 */

import { enhancedWebSocketService } from "../services/websocket-service";
import {
  broadcastToChannel,
  broadcastGlobal,
  broadcastToUser,
} from "../routes/streaming";

export interface DashboardUpdateEvent {
  security?: {
    riskScore?: number;
    totalFindings?: number;
    criticalCount?: number;
    highCount?: number;
  };
  activity?: {
    totalScans?: number;
    activeProjects?: number;
  };
}

export interface ActivityEvent {
  id: string;
  type: "scan" | "alert" | "deploy" | "config" | "user";
  action: string;
  resource: string;
  actor: string;
  timestamp: string;
  severity?: "info" | "warning" | "error" | "success";
  metadata?: Record<string, unknown>;
}

export interface ScanEvent {
  scanId: string;
  status: "started" | "in_progress" | "completed" | "failed";
  progress?: number;
  message?: string;
  result?: unknown;
}

export interface NotificationEvent {
  id: string;
  type: "security" | "compliance" | "system" | "billing";
  title: string;
  message: string;
  severity: "info" | "warning" | "error" | "success";
  actionUrl?: string;
}

/**
 * Broadcast a dashboard summary update to all connected clients
 */
export function broadcastDashboardUpdate(data: DashboardUpdateEvent): void {
  // Send via WebSocket
  enhancedWebSocketService.broadcastDashboardUpdate(data);
  // Send via SSE
  broadcastToChannel("dashboard", "dashboard-update", data);
}

/**
 * Broadcast a new activity event
 */
export function broadcastActivity(event: ActivityEvent): void {
  enhancedWebSocketService.broadcastActivityEvent(event);
  broadcastToChannel("activity", "activity-event", event);
}

/**
 * Broadcast a scan event (started, progress, completed)
 */
export function broadcastScanEvent(event: ScanEvent): void {
  switch (event.status) {
    case "started":
      enhancedWebSocketService.broadcastScanStarted(event.scanId, {
        message: event.message,
      });
      broadcastToChannel(`scan-${event.scanId}`, "scan-started", event);
      broadcastToChannel("dashboard", "scan-started", event);
      break;
    case "in_progress":
      enhancedWebSocketService.broadcastScanProgress(
        event.scanId,
        event.progress || 0,
        event.status,
        { message: event.message },
      );
      broadcastToChannel(`scan-${event.scanId}`, "scan-progress", event);
      break;
    case "completed":
    case "failed":
      enhancedWebSocketService.broadcastScanComplete(
        event.scanId,
        event.result || {},
      );
      broadcastToChannel(`scan-${event.scanId}`, "scan-complete", event);
      broadcastToChannel("dashboard", "scan-complete", event);
      break;
  }
}

/**
 * Broadcast a notification to all connected clients
 */
export function broadcastNotification(notification: NotificationEvent): void {
  enhancedWebSocketService.sendGlobalNotification(notification);
  broadcastGlobal("notification", notification);
}

/**
 * Broadcast a notification to a specific user
 */
export function broadcastUserNotification(
  userId: string,
  notification: NotificationEvent,
): void {
  broadcastToUser(userId, "notification", notification);
}

/**
 * Broadcast findings update (when vulnerabilities are detected)
 */
export function broadcastFindingsUpdate(findings: any): void {
  enhancedWebSocketService.broadcastFindingsUpdate(findings);
  broadcastToChannel("dashboard", "findings-update", findings);
}

/**
 * Broadcast health score update
 */
export function broadcastHealthUpdate(healthScore: any): void {
  enhancedWebSocketService.broadcastHealthUpdate(healthScore);
  broadcastToChannel("dashboard", "health-update", healthScore);
}

export default {
  broadcastDashboardUpdate,
  broadcastActivity,
  broadcastScanEvent,
  broadcastNotification,
  broadcastUserNotification,
  broadcastFindingsUpdate,
  broadcastHealthUpdate,
};
