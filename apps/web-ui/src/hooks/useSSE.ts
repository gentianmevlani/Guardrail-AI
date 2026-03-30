"use client";

import { logger } from "@/lib/logger";
import { useEffect, useRef, useState, useCallback } from "react";

export type SSEStatus = "connecting" | "connected" | "disconnected" | "error";

export interface SSEMessage<T = unknown> {
  event: string;
  data: T;
}

export interface UseSSEOptions {
  url: string;
  channels?: string[];
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: SSEMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

interface UseSSEReturn {
  status: SSEStatus;
  lastMessage: SSEMessage | null;
  connect: () => void;
  disconnect: () => void;
}

const API_BASE =
  typeof window !== "undefined" ? process.env.NEXT_PUBLIC_API_URL || "" : "";

export function useSSE(options: UseSSEOptions): UseSSEReturn {
  const {
    url,
    channels = [],
    autoConnect = true,
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [status, setStatus] = useState<SSEStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return;
    }

    clearReconnectTimeout();
    setStatus("connecting");

    // Build URL with channels
    const fullUrl =
      channels.length > 0
        ? `${API_BASE}${url}?channels=${channels.join(",")}`
        : `${API_BASE}${url}`;

    try {
      const eventSource = new EventSource(fullUrl, { withCredentials: true });
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!mountedRef.current) return;
        setStatus("connected");
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          const message: SSEMessage = { event: "message", data };
          setLastMessage(message);
          onMessage?.(message);
        } catch (error) {
          logger.error('Failed to parse SSE message:', error);
        }
      };

      // Handle custom events
      const eventTypes = [
        "connected",
        "dashboard-summary",
        "dashboard-update",
        "activity-event",
        "activity-initial",
        "health-update",
        "notification",
        "scan-started",
        "scan-progress",
        "scan-complete",
        "findings-update",
        "ping",
      ];

      eventTypes.forEach((eventType) => {
        eventSource.addEventListener(eventType, (event: MessageEvent) => {
          if (!mountedRef.current) return;
          try {
            const data = JSON.parse(event.data);
            const message: SSEMessage = { event: eventType, data };
            setLastMessage(message);
            onMessage?.(message);
          } catch (error) {
            logger.error(`Failed to parse SSE ${eventType} event:`, error);
          }
        });
      });

      eventSource.onerror = (error) => {
        if (!mountedRef.current) return;

        eventSource.close();
        eventSourceRef.current = null;
        setStatus("error");
        onError?.(error);
        onDisconnect?.();

        // Auto-reconnect logic
        if (reconnect && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, reconnectInterval);
        }
      };
    } catch (error) {
      logger.error('Failed to create EventSource:', error);
      setStatus("error");
    }
  }, [
    url,
    channels,
    reconnect,
    reconnectInterval,
    maxReconnectAttempts,
    onConnect,
    onDisconnect,
    onMessage,
    onError,
    clearReconnectTimeout,
  ]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttempts.current = maxReconnectAttempts;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus("disconnected");
  }, [maxReconnectAttempts, clearReconnectTimeout]);

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      clearReconnectTimeout();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [autoConnect, connect, clearReconnectTimeout]);

  return {
    status,
    lastMessage,
    connect,
    disconnect,
  };
}

/**
 * Hook for dashboard SSE stream
 */
export interface DashboardSummaryData {
  security?: {
    riskScore?: number;
    totalFindings?: number;
    criticalCount?: number;
    highCount?: number;
  };
  ship?: {
    verdict?: string;
    lastCheck?: string;
  };
}

export interface ActivityEventData {
  id?: string;
  type?: string;
  action?: string;
  resource?: string;
  actor?: string;
  timestamp?: string;
  severity?: string;
}

export interface NotificationData {
  id?: string;
  type?: string;
  title?: string;
  message?: string;
  severity?: string;
  createdAt?: string;
}

export function useDashboardStream(
  options: {
    onSummaryUpdate?: (data: DashboardSummaryData) => void;
    onActivityEvent?: (data: ActivityEventData) => void;
    onNotification?: (data: NotificationData) => void;
    enabled?: boolean;
  } = {},
) {
  const {
    onSummaryUpdate,
    onActivityEvent,
    onNotification,
    enabled = true,
  } = options;

  const handleMessage = useCallback(
    (message: SSEMessage) => {
      switch (message.event) {
        case "dashboard-summary":
        case "dashboard-update":
          onSummaryUpdate?.(message.data as DashboardSummaryData);
          break;
        case "activity-event":
        case "activity-initial":
          onActivityEvent?.(message.data as ActivityEventData);
          break;
        case "notification":
          onNotification?.(message.data as NotificationData);
          break;
        default:
          break;
      }
    },
    [onSummaryUpdate, onActivityEvent, onNotification],
  );

  return useSSE({
    url: "/api/stream/dashboard",
    channels: ["dashboard"],
    autoConnect: enabled,
    onMessage: handleMessage,
  });
}

/**
 * Hook for scan progress SSE stream
 */
export interface ScanProgressData {
  scanId?: string;
  progress?: number;
  status?: string;
}

export interface ScanCompleteData {
  scanId?: string;
  result?: {
    verdict?: string;
    score?: number;
    findings?: unknown[];
  };
}

export function useScanStream(
  scanId: string | null,
  options: {
    onProgress?: (data: ScanProgressData) => void;
    onComplete?: (data: ScanCompleteData) => void;
    enabled?: boolean;
  } = {},
) {
  const { onProgress, onComplete, enabled = true } = options;

  const handleMessage = useCallback(
    (message: SSEMessage) => {
      switch (message.event) {
        case "scan-progress":
          onProgress?.(message.data as ScanProgressData);
          break;
        case "scan-complete":
          onComplete?.(message.data as ScanCompleteData);
          break;
        default:
          break;
      }
    },
    [onProgress, onComplete],
  );

  return useSSE({
    url: scanId ? `/api/stream/scan/${scanId}` : "/api/stream/dashboard",
    autoConnect: enabled && !!scanId,
    onMessage: handleMessage,
  });
}

export default useSSE;
