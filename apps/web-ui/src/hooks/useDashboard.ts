"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useApi } from "./useApi";
import { useWebSocket, type WebSocketMessage } from "./useWebSocket";
import {
  fetchDashboardSummary,
  fetchRecentActivity,
  fetchHealthScore,
  fetchFindings,
  fetchNotifications,
  type DashboardSummary,
  type ActivityEvent,
  type HealthScore,
  type FindingsResponse,
  type NotificationsResponse,
  type AppNotification,
} from "@/lib/api";

interface UseDashboardOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableWebSocket?: boolean;
}

interface UseDashboardReturn {
  summary: DashboardSummary | null;
  activity: ActivityEvent[];
  healthScore: HealthScore | null;
  findings: FindingsResponse | null;
  notifications: NotificationsResponse;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  wsStatus: "connecting" | "connected" | "disconnected" | "error";
  refresh: () => Promise<void>;
  refreshSummary: () => Promise<void>;
  refreshActivity: () => Promise<void>;
  refreshFindings: () => Promise<void>;
}

export function useDashboard(
  options: UseDashboardOptions = {},
): UseDashboardReturn {
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
    enableWebSocket = true,
  } = options;

  // Dashboard summary
  const {
    data: summary,
    isLoading: summaryLoading,
    isValidating: summaryValidating,
    error: summaryError,
    refetch: refetchSummary,
    mutate: mutateSummary,
  } = useApi(fetchDashboardSummary, {
    cacheKey: "dashboard-summary",
    cacheTTL: 60000,
    refetchInterval: autoRefresh ? refreshInterval : undefined,
    refetchOnFocus: true,
  });

  // Activity events
  const {
    data: activity,
    isLoading: activityLoading,
    refetch: refetchActivity,
    mutate: mutateActivity,
  } = useApi(() => fetchRecentActivity(10), {
    cacheKey: "dashboard-activity",
    cacheTTL: 30000,
    refetchInterval: autoRefresh ? refreshInterval : undefined,
    initialData: [],
  });

  // Health score
  const {
    data: healthScore,
    isLoading: healthLoading,
    refetch: refetchHealth,
    mutate: mutateHealth,
  } = useApi(fetchHealthScore, {
    cacheKey: "dashboard-health",
    cacheTTL: 60000,
    refetchInterval: autoRefresh ? refreshInterval * 2 : undefined,
  });

  // Findings
  const {
    data: findings,
    isLoading: findingsLoading,
    refetch: refetchFindings,
  } = useApi(() => fetchFindings({ limit: 20 }), {
    cacheKey: "dashboard-findings",
    cacheTTL: 60000,
    refetchInterval: autoRefresh ? refreshInterval : undefined,
  });

  // Notifications
  const {
    data: notifications,
    refetch: refetchNotifications,
    mutate: mutateNotifications,
  } = useApi(() => fetchNotifications(20), {
    cacheKey: "dashboard-notifications",
    cacheTTL: 30000,
    refetchInterval: autoRefresh ? refreshInterval : undefined,
    initialData: { notifications: [], total: 0, unreadCount: 0 },
  });

  // WebSocket for real-time updates
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "dashboard-update":
          if (message.data?.summary) {
            mutateSummary(message.data.summary as DashboardSummary);
          }
          break;

        case "activity-event":
          if (message.data) {
            mutateActivity((prev) => {
              const events = prev || [];
              return [message.data as unknown as ActivityEvent, ...events.slice(0, 9)];
            });
          }
          break;

        case "health-update":
          if (message.data) {
            mutateHealth(message.data as unknown as HealthScore);
          }
          break;

        case "notification":
          if (message.data) {
            mutateNotifications((prev) => {
              const current = prev || {
                notifications: [],
                total: 0,
                unreadCount: 0,
              };
              const newNotification = {
                ...(message.data as Record<string, unknown>),
                read: false,
              } as AppNotification;
              return {
                notifications: [newNotification, ...current.notifications.slice(0, 19)],
                total: current.total + 1,
                unreadCount: current.unreadCount + 1,
              };
            });
          }
          break;

        case "scan-complete":
        case "findings-update":
          // Refresh findings and summary when scan completes
          refetchFindings();
          refetchSummary();
          break;

        default:
          break;
      }
    },
    [
      mutateSummary,
      mutateActivity,
      mutateHealth,
      mutateNotifications,
      refetchFindings,
      refetchSummary,
    ],
  );

  const { status: wsStatus } = useWebSocket({
    autoConnect: enableWebSocket,
    onMessage: handleWebSocketMessage,
    onConnect: () => {
      // Join dashboard room for updates
    },
  });

  // Aggregate loading state
  const isLoading =
    summaryLoading || activityLoading || healthLoading || findingsLoading;
  const isRefreshing = summaryValidating;

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([
      refetchSummary(),
      refetchActivity(),
      refetchHealth(),
      refetchFindings(),
      refetchNotifications(),
    ]);
  }, [
    refetchSummary,
    refetchActivity,
    refetchHealth,
    refetchFindings,
    refetchNotifications,
  ]);

  return {
    summary,
    activity: activity || [],
    healthScore,
    findings,
    notifications: notifications || {
      notifications: [],
      total: 0,
      unreadCount: 0,
    },
    isLoading,
    isRefreshing,
    error: summaryError,
    wsStatus,
    refresh,
    refreshSummary: refetchSummary,
    refreshActivity: refetchActivity,
    refreshFindings: refetchFindings,
  };
}

export function useDashboardMetrics() {
  const { summary, healthScore, isLoading } = useDashboard({
    autoRefresh: true,
    refreshInterval: 60000,
  });

  const metrics = useMemo(() => {
    if (!summary) return null;

    return {
      riskScore: summary.security.riskScore,
      totalFindings: summary.security.totalFindings,
      criticalCount: summary.security.criticalCount,
      highCount: summary.security.highCount,
      shipVerdict: summary.ship.verdict,
      complianceScore: summary.compliance.overallScore,
      healthScore: healthScore?.overall ?? 0,
      trend: summary.security.trend,
    };
  }, [summary, healthScore]);

  return { metrics, isLoading };
}

export function useActivityFeed(limit = 10) {
  const {
    data: activity,
    isLoading,
    refetch,
  } = useApi(() => fetchRecentActivity(limit), {
    cacheKey: `activity-feed-${limit}`,
    cacheTTL: 30000,
    refetchInterval: 15000,
    initialData: [],
  });

  return {
    events: activity || [],
    isLoading,
    refresh: refetch,
  };
}

export default useDashboard;
