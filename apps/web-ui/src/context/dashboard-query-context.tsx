"use client";

/**
 * Dashboard Query Context
 *
 * Enhanced dashboard context using the new query system.
 * Provides global dashboard state with:
 * - Automatic request deduplication
 * - Cache synchronization across components
 * - Optimistic updates for mutations
 * - Real-time WebSocket integration
 */

import { useWebSocket, type WebSocketMessage } from "@/hooks/useWebSocket";
import {
  fetchDashboardSummary,
  fetchFindings,
  fetchHealthScore,
  fetchNotifications,
  fetchRecentActivity,
  markNotificationsRead,
  triggerDeepScan,
  type ActivityEvent,
  type AppNotification,
  type DashboardSummary,
  type FindingsResponse,
  type HealthScore,
  type NotificationsResponse,
} from "@/lib/api";
import {
  QueryProvider,
  useInvalidateQueries,
  useMutation,
  useQuery,
  useQueryClient,
  useSetQueryData,
} from "@/lib/query";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

// Query keys - centralized for easy invalidation
export const DASHBOARD_QUERY_KEYS = {
  all: "dashboard",
  summary: "dashboard:summary",
  activity: "dashboard:activity",
  health: "dashboard:health",
  findings: "dashboard:findings",
  notifications: "dashboard:notifications",
} as const;

// Context types
interface DashboardQueryContextType {
  // Data
  summary: DashboardSummary | null;
  activity: ActivityEvent[];
  healthScore: HealthScore | null;
  findings: FindingsResponse | null;
  notifications: NotificationsResponse;

  // Status
  isLoading: boolean;
  isFetching: boolean;
  isScanning: boolean;
  error: Error | null;
  lastUpdated: string | null;
  wsConnected: boolean;

  // Actions
  refresh: () => Promise<void>;
  refreshSummary: () => Promise<void>;
  refreshActivity: () => Promise<void>;
  refreshFindings: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAsRead: (ids: string[]) => Promise<void>;
  startScan: () => Promise<{ scanId: string } | null>;
}

const DashboardQueryContext = createContext<
  DashboardQueryContextType | undefined
>(undefined);

interface DashboardQueryProviderProps {
  children: React.ReactNode;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

function DashboardQueryProviderInner({
  children,
  autoRefresh = true,
  refreshInterval = 30000,
}: DashboardQueryProviderProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const invalidate = useInvalidateQueries();
  const setQueryData = useSetQueryData();

  // Dashboard summary query
  const summaryQuery = useQuery(
    DASHBOARD_QUERY_KEYS.summary,
    fetchDashboardSummary,
    {
      staleTime: 60000,
      refetchInterval: autoRefresh ? refreshInterval : false,
      refetchOnWindowFocus: true,
      onSuccess: () => {
        setLastUpdated(new Date().toISOString());
      },
    },
  );

  // Activity events query
  const activityQuery = useQuery(
    DASHBOARD_QUERY_KEYS.activity,
    () => fetchRecentActivity(20),
    {
      staleTime: 30000,
      refetchInterval: autoRefresh ? refreshInterval : false,
      initialData: [],
    },
  );

  // Health score query
  const healthQuery = useQuery(DASHBOARD_QUERY_KEYS.health, fetchHealthScore, {
    staleTime: 60000,
    refetchInterval: autoRefresh ? refreshInterval * 2 : false,
  });

  // Findings query
  const findingsQuery = useQuery(
    DASHBOARD_QUERY_KEYS.findings,
    () => fetchFindings({ limit: 20 }),
    {
      staleTime: 60000,
      refetchInterval: autoRefresh ? refreshInterval : false,
    },
  );

  // Notifications query
  const notificationsQuery = useQuery(
    DASHBOARD_QUERY_KEYS.notifications,
    () => fetchNotifications(20),
    {
      staleTime: 30000,
      refetchInterval: autoRefresh ? refreshInterval : false,
      initialData: { notifications: [], total: 0, unreadCount: 0 },
    },
  );

  // Mark notifications as read mutation with optimistic update
  const markReadMutation = useMutation(
    async (ids: string[]) => {
      await markNotificationsRead(ids);
      return ids;
    },
    {
      onMutate: async (ids) => {
        // Optimistically update the cache
        setQueryData<NotificationsResponse>(
          DASHBOARD_QUERY_KEYS.notifications,
          (old) => {
            if (!old) return { notifications: [], total: 0, unreadCount: 0 };
            return {
              ...old,
              notifications: old.notifications.map((n) =>
                ids.includes(n.id) ? { ...n, read: true } : n,
              ),
              unreadCount: Math.max(0, old.unreadCount - ids.length),
            };
          },
        );
      },
    },
  );

  // Start scan mutation
  const scanMutation = useMutation(
    async () => {
      setIsScanning(true);
      const result = await triggerDeepScan();
      return result;
    },
    {
      onSuccess: () => {
        // Will be set to false when scan-complete event received
      },
      onError: () => {
        setIsScanning(false);
      },
    },
  );

  // WebSocket message handler for real-time updates
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "connected":
          setWsConnected(true);
          break;

        case "dashboard-update":
          if (message.data?.summary) {
            setQueryData(
              DASHBOARD_QUERY_KEYS.summary,
              message.data.summary as DashboardSummary,
            );
            setLastUpdated(new Date().toISOString());
          }
          break;

        case "activity-event":
          if (message.data) {
            setQueryData<ActivityEvent[]>(
              DASHBOARD_QUERY_KEYS.activity,
              (prev) => {
                const events = prev || [];
                return [
                  message.data as unknown as ActivityEvent,
                  ...events.slice(0, 19),
                ];
              },
            );
          }
          break;

        case "health-update":
          if (message.data) {
            setQueryData(
              DASHBOARD_QUERY_KEYS.health,
              message.data as unknown as HealthScore,
            );
          }
          break;

        case "notification":
          if (message.data) {
            setQueryData<NotificationsResponse>(
              DASHBOARD_QUERY_KEYS.notifications,
              (prev) => {
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
                  notifications: [
                    newNotification,
                    ...current.notifications.slice(0, 19),
                  ],
                  total: current.total + 1,
                  unreadCount: current.unreadCount + 1,
                };
              },
            );
          }
          break;

        case "scan-started":
          setIsScanning(true);
          break;

        case "scan-complete":
        case "findings-update":
          setIsScanning(false);
          // Invalidate related queries to trigger refetch
          invalidate([
            DASHBOARD_QUERY_KEYS.findings,
            DASHBOARD_QUERY_KEYS.summary,
          ]);
          break;

        default:
          break;
      }
    },
    [setQueryData, invalidate],
  );

  const handleDisconnect = useCallback(() => {
    setWsConnected(false);
  }, []);

  // WebSocket connection
  useWebSocket({
    autoConnect: true,
    reconnect: true,
    onMessage: handleWebSocketMessage,
    onDisconnect: handleDisconnect,
  });

  // Aggregate loading state
  const isLoading =
    summaryQuery.isLoading ||
    activityQuery.isLoading ||
    healthQuery.isLoading ||
    findingsQuery.isLoading;

  const isFetching =
    summaryQuery.isFetching ||
    activityQuery.isFetching ||
    healthQuery.isFetching ||
    findingsQuery.isFetching;

  // Action handlers
  const refresh = useCallback(async () => {
    await Promise.all([
      summaryQuery.refetch(),
      activityQuery.refetch(),
      healthQuery.refetch(),
      findingsQuery.refetch(),
      notificationsQuery.refetch(),
    ]);
  }, [
    summaryQuery,
    activityQuery,
    healthQuery,
    findingsQuery,
    notificationsQuery,
  ]);

  const refreshSummary = useCallback(async () => {
    await summaryQuery.refetch();
  }, [summaryQuery]);

  const refreshActivity = useCallback(async () => {
    await activityQuery.refetch();
  }, [activityQuery]);

  const refreshFindings = useCallback(async () => {
    await findingsQuery.refetch();
  }, [findingsQuery]);

  const refreshNotifications = useCallback(async () => {
    await notificationsQuery.refetch();
  }, [notificationsQuery]);

  const markAsRead = useCallback(
    async (ids: string[]) => {
      await markReadMutation.mutateAsync(ids);
    },
    [markReadMutation],
  );

  const startScan = useCallback(async () => {
    try {
      const result = await scanMutation.mutateAsync();
      return result;
    } catch {
      return null;
    }
  }, [scanMutation]);

  // Memoized context value
  const contextValue = useMemo<DashboardQueryContextType>(
    () => ({
      // Data
      summary: summaryQuery.data,
      activity: activityQuery.data || [],
      healthScore: healthQuery.data,
      findings: findingsQuery.data,
      notifications: notificationsQuery.data || {
        notifications: [],
        total: 0,
        unreadCount: 0,
      },

      // Status
      isLoading,
      isFetching,
      isScanning,
      error: summaryQuery.error,
      lastUpdated,
      wsConnected,

      // Actions
      refresh,
      refreshSummary,
      refreshActivity,
      refreshFindings,
      refreshNotifications,
      markAsRead,
      startScan,
    }),
    [
      summaryQuery.data,
      summaryQuery.error,
      activityQuery.data,
      healthQuery.data,
      findingsQuery.data,
      notificationsQuery.data,
      isLoading,
      isFetching,
      isScanning,
      lastUpdated,
      wsConnected,
      refresh,
      refreshSummary,
      refreshActivity,
      refreshFindings,
      refreshNotifications,
      markAsRead,
      startScan,
    ],
  );

  return (
    <DashboardQueryContext.Provider value={contextValue}>
      {children}
    </DashboardQueryContext.Provider>
  );
}

/**
 * Dashboard Query Provider
 * Wraps children with QueryProvider and DashboardQueryContext
 */
export function DashboardQueryProvider({
  children,
  autoRefresh = true,
  refreshInterval = 30000,
}: DashboardQueryProviderProps) {
  return (
    <QueryProvider>
      <DashboardQueryProviderInner
        autoRefresh={autoRefresh}
        refreshInterval={refreshInterval}
      >
        {children}
      </DashboardQueryProviderInner>
    </QueryProvider>
  );
}

/**
 * Hook to use dashboard query context
 */
export function useDashboardQueryContext() {
  const context = useContext(DashboardQueryContext);
  if (context === undefined) {
    throw new Error(
      "useDashboardQueryContext must be used within a DashboardQueryProvider",
    );
  }
  return context;
}

/**
 * Convenience hooks for specific data
 */

export function useDashboardSummaryQuery() {
  const { summary, isLoading, error, refreshSummary } =
    useDashboardQueryContext();
  return { summary, isLoading, error, refresh: refreshSummary };
}

export function useDashboardActivityQuery() {
  const { activity, isLoading, refreshActivity } = useDashboardQueryContext();
  return { activity, isLoading, refresh: refreshActivity };
}

export function useDashboardNotificationsQuery() {
  const { notifications, markAsRead, refreshNotifications } =
    useDashboardQueryContext();
  return { notifications, markAsRead, refresh: refreshNotifications };
}

export function useDashboardHealthQuery() {
  const { healthScore, isLoading } = useDashboardQueryContext();
  return { healthScore, isLoading };
}

export function useDashboardFindingsQuery() {
  const { findings, isLoading, refreshFindings } = useDashboardQueryContext();
  return { findings, isLoading, refresh: refreshFindings };
}

export default DashboardQueryContext;
