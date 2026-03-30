"use client";

import { logger } from "@/lib/logger";
import { useEffect, useRef, useState, useCallback } from "react";

export type WebSocketStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface WebSocketMessage {
  type: string;
  data?: Record<string, unknown>;
  room?: string;
  timestamp?: string;
  message?: string;
  runId?: string;
  scanId?: string;
}

export interface UseWebSocketOptions {
  url?: string;
  token?: string;
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

interface UseWebSocketReturn {
  status: WebSocketStatus;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: WebSocketMessage) => void;
  connect: () => void;
  disconnect: () => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

const getWebSocketUrl = (): string | null => {
  if (typeof window === "undefined") {
    return "ws://localhost:3000/ws";
  }
  
  // Check if we have an explicit WebSocket URL configured
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (wsUrl) {
    return wsUrl;
  }
  
  // In production on static hosts (Netlify, Vercel), WebSocket isn't available
  // Only enable WebSocket in development or when explicitly configured
  // Set NEXT_PUBLIC_WS_URL=wss://your-domain.com/ws to enable in production
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalhost && !wsUrl) {
    if (process.env.NODE_ENV === 'production') {
      logger.debug('[WebSocket] Disabled: Set NEXT_PUBLIC_WS_URL for real-time updates');
    }
    return null; // Disable WebSocket in production without explicit config
  }
  
  return `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
};

const DEFAULT_WS_URL = getWebSocketUrl();

export function useWebSocket(
  options: UseWebSocketOptions = {},
): UseWebSocketReturn {
  const {
    url = DEFAULT_WS_URL ?? undefined,
    token,
    autoConnect = true,
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [status, setStatus] = useState<WebSocketStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
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
    // Skip connection if WebSocket is disabled (null URL)
    if (!url) {
      setStatus("disconnected");
      return;
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    clearReconnectTimeout();
    setStatus("connecting");

    const wsUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setStatus("connected");
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setStatus("disconnected");
        wsRef.current = null;
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

      ws.onerror = (error) => {
        if (!mountedRef.current) return;
        setStatus("error");
        onError?.(error);
      };
    } catch (error) {
      logger.error('Failed to create WebSocket connection:', error);
      setStatus("error");
    }
  }, [
    url,
    token,
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
    reconnectAttempts.current = maxReconnectAttempts; // Prevent auto-reconnect

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, [maxReconnectAttempts, clearReconnectTimeout]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      logger.debug('WebSocket is not connected. Message not sent:', message);
    }
  }, []);

  const joinRoom = useCallback(
    (room: string) => {
      sendMessage({ type: "join-room", room });
    },
    [sendMessage],
  );

  const leaveRoom = useCallback(
    (room: string) => {
      sendMessage({ type: "leave-room", room });
    },
    [sendMessage],
  );

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [autoConnect, connect, clearReconnectTimeout]);

  return {
    status,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
  };
}

export default useWebSocket;
