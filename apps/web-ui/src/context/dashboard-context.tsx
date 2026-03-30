"use client";

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
  type DashboardSummary,
  type FindingsResponse,
  type HealthScore,
  type NotificationsResponse,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import type { SSENotification } from "@/types/api";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";

// State types
interface DashboardState {
  summary: DashboardSummary | null;
  activity: ActivityEvent[];
  healthScore: HealthScore | null;
  findings: FindingsResponse | null;
  notifications: NotificationsResponse;
  isLoading: boolean;
  isScanning: boolean;
  error: string | null;
  lastUpdated: string | null;
  wsConnected: boolean;
}

// Action types
type DashboardAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SCANNING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_SUMMARY"; payload: DashboardSummary | null }
  | { type: "SET_ACTIVITY"; payload: ActivityEvent[] }
  | { type: "ADD_ACTIVITY"; payload: ActivityEvent }
  | { type: "SET_HEALTH_SCORE"; payload: HealthScore | null }
  | { type: "SET_FINDINGS"; payload: FindingsResponse | null }
  | { type: "SET_NOTIFICATIONS"; payload: NotificationsResponse }
  | { type: "ADD_NOTIFICATION"; payload: SSENotification }
  | { type: "MARK_NOTIFICATIONS_READ"; payload: string[] }
  | { type: "SET_WS_CONNECTED"; payload: boolean }
  | { type: "SET_LAST_UPDATED"; payload: string };

const initialState: DashboardState = {
  summary: null,
  activity: [],
  healthScore: null,
  findings: null,
  notifications: { notifications: [], total: 0, unreadCount: 0 },
  isLoading: true,
  isScanning: false,
  error: null,
  lastUpdated: null,
  wsConnected: false,
};

function dashboardReducer(
  state: DashboardState,
  action: DashboardAction,
): DashboardState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_SCANNING":
      return { ...state, isScanning: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_SUMMARY":
      return { ...state, summary: action.payload };
    case "SET_ACTIVITY":
      return { ...state, activity: action.payload };
    case "ADD_ACTIVITY":
      return {
        ...state,
        activity: [action.payload, ...state.activity.slice(0, 19)],
      };
    case "SET_HEALTH_SCORE":
      return { ...state, healthScore: action.payload };
    case "SET_FINDINGS":
      return { ...state, findings: action.payload };
    case "SET_NOTIFICATIONS":
      return { ...state, notifications: action.payload };
    case "ADD_NOTIFICATION":
      return {
        ...state,
        notifications: {
          notifications: [
            {
              ...action.payload,
              read: false,
            } as unknown as NotificationsResponse["notifications"][0],
            ...state.notifications.notifications.slice(0, 19),
          ],
          total: state.notifications.total + 1,
          unreadCount: state.notifications.unreadCount + 1,
        },
      };
    case "MARK_NOTIFICATIONS_READ":
      return {
        ...state,
        notifications: {
          ...state.notifications,
          notifications: state.notifications.notifications.map((n) =>
            action.payload.includes(n.id) ? { ...n, read: true } : n,
          ),
          unreadCount: Math.max(
            0,
            state.notifications.unreadCount - action.payload.length,
          ),
        },
      };
    case "SET_WS_CONNECTED":
      return { ...state, wsConnected: action.payload };
    case "SET_LAST_UPDATED":
      return { ...state, lastUpdated: action.payload };
    default:
      return state;
  }
}

// Context types
interface DashboardContextType extends DashboardState {
  refresh: () => Promise<void>;
  refreshSummary: () => Promise<void>;
  refreshActivity: () => Promise<void>;
  refreshFindings: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAsRead: (ids: string[]) => Promise<void>;
  startScan: () => Promise<{ scanId: string } | null>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined,
);

interface DashboardProviderProps {
  children: React.ReactNode;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function DashboardProvider({
  children,
  autoRefresh = true,
  refreshInterval = 30000,
}: DashboardProviderProps) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case "connected":
        dispatch({ type: "SET_WS_CONNECTED", payload: true });
        break;

      case "dashboard-update":
        if (message.data?.summary) {
          dispatch({
            type: "SET_SUMMARY",
            payload: message.data.summary as DashboardSummary,
          });
          dispatch({
            type: "SET_LAST_UPDATED",
            payload: new Date().toISOString(),
          });
        }
        break;

      case "activity-event":
        if (message.data) {
          dispatch({
            type: "ADD_ACTIVITY",
            payload: message.data as unknown as ActivityEvent,
          });
        }
        break;

      case "health-update":
        if (message.data) {
          dispatch({
            type: "SET_HEALTH_SCORE",
            payload: message.data as unknown as HealthScore,
          });
        }
        break;

      case "notification":
        if (message.data) {
          dispatch({
            type: "ADD_NOTIFICATION",
            payload: message.data as unknown as SSENotification,
          });
        }
        break;

      case "scan-started":
        dispatch({ type: "SET_SCANNING", payload: true });
        break;

      case "scan-complete":
      case "findings-update":
        dispatch({ type: "SET_SCANNING", payload: false });
        // Trigger refresh of findings and summary
        refreshFindings();
        refreshSummary();
        break;

      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisconnect = useCallback(() => {
    dispatch({ type: "SET_WS_CONNECTED", payload: false });
  }, []);

  // WebSocket connection
  useWebSocket({
    autoConnect: true,
    reconnect: true,
    onMessage: handleWebSocketMessage,
    onDisconnect: handleDisconnect,
  });

  // Data fetching functions
  const refreshSummary = useCallback(async () => {
    try {
      const data = await fetchDashboardSummary();
      dispatch({ type: "SET_SUMMARY", payload: data });
      dispatch({ type: "SET_LAST_UPDATED", payload: new Date().toISOString() });
    } catch (error) {
      logger.error("Failed to fetch summary:", error);
    }
  }, []);

  const refreshActivity = useCallback(async () => {
    try {
      const data = await fetchRecentActivity(20);
      dispatch({ type: "SET_ACTIVITY", payload: data });
    } catch (error) {
      logger.error("Failed to fetch activity:", error);
    }
  }, []);

  const refreshHealthScore = useCallback(async () => {
    try {
      const data = await fetchHealthScore();
      dispatch({ type: "SET_HEALTH_SCORE", payload: data });
    } catch (error) {
      logger.error("Failed to fetch health score:", error);
    }
  }, []);

  const refreshFindings = useCallback(async () => {
    try {
      const data = await fetchFindings({ limit: 20 });
      dispatch({ type: "SET_FINDINGS", payload: data });
    } catch (error) {
      logger.error("Failed to fetch findings:", error);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await fetchNotifications(20);
      dispatch({ type: "SET_NOTIFICATIONS", payload: data });
    } catch (error) {
      logger.error("Failed to fetch notifications:", error);
    }
  }, []);

  const refresh = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      await Promise.all([
        refreshSummary(),
        refreshActivity(),
        refreshHealthScore(),
        refreshFindings(),
        refreshNotifications(),
      ]);
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: "Failed to refresh dashboard data",
      });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [
    refreshSummary,
    refreshActivity,
    refreshHealthScore,
    refreshFindings,
    refreshNotifications,
  ]);

  const markAsRead = useCallback(async (ids: string[]) => {
    const success = await markNotificationsRead(ids);
    if (success) {
      dispatch({ type: "MARK_NOTIFICATIONS_READ", payload: ids });
    }
  }, []);

  const startScan = useCallback(async () => {
    dispatch({ type: "SET_SCANNING", payload: true });
    try {
      const result = await triggerDeepScan();
      if (!result) {
        dispatch({ type: "SET_SCANNING", payload: false });
      }
      return result;
    } catch (error) {
      dispatch({ type: "SET_SCANNING", payload: false });
      throw error;
    }
  }, []);

  // Initial data load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      refreshSummary();
      refreshActivity();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, refreshSummary, refreshActivity]);

  const contextValue: DashboardContextType = {
    ...state,
    refresh,
    refreshSummary,
    refreshActivity,
    refreshFindings,
    refreshNotifications,
    markAsRead,
    startScan,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error(
      "useDashboardContext must be used within a DashboardProvider",
    );
  }
  return context;
}

export default DashboardContext;
