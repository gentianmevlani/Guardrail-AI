/**
 * Hooks Index
 *
 * Central export for all custom hooks used in the guardrail Web UI.
 * Provides data fetching, real-time updates, and state management hooks.
 */

// Core API hooks
export { clearApiCache, getApiCacheEntry, useApi } from "./useApi";

// WebSocket hook for real-time communication
export {
    useWebSocket, type UseWebSocketOptions, type WebSocketMessage, type WebSocketStatus
} from "./useWebSocket";

// Server-Sent Events hooks for streaming updates
export {
    useDashboardStream, useSSE, useScanStream, type SSEMessage, type SSEStatus, type UseSSEOptions
} from "./useSSE";

// Dashboard-specific hooks
export {
    useActivityFeed, useDashboard,
    useDashboardMetrics
} from "./useDashboard";

// Scan hooks
export {
    useScan, type ScanResult, type ScanStatus, type UseScanOptions
} from "./useScan";

// Media query hook
export { useMediaQuery } from "./useMediaQuery";

// Onboarding hook
export { useOnboarding } from "./useOnboarding";

