"use client";

/**
 * Query Provider
 *
 * React context provider for the QueryClient.
 * Provides query client to all child components and handles cleanup.
 */

import React, { createContext, useContext, useEffect, useMemo } from "react";
import { QueryClient, getQueryClient, setQueryClient } from "./query-client";

interface QueryProviderProps {
  client?: QueryClient;
  children: React.ReactNode;
}

const QueryClientContext = createContext<QueryClient | null>(null);

/**
 * QueryProvider - Provides QueryClient to component tree
 *
 * @example
 * ```tsx
 * // In _app.tsx or layout.tsx
 * const queryClient = new QueryClient({
 *   staleTime: 60000,
 * });
 *
 * export default function App({ children }) {
 *   return (
 *     <QueryProvider client={queryClient}>
 *       {children}
 *     </QueryProvider>
 *   );
 * }
 * ```
 */
export function QueryProvider({ client, children }: QueryProviderProps) {
  const queryClient = useMemo(() => {
    if (client) {
      setQueryClient(client);
      return client;
    }
    return getQueryClient();
  }, [client]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't destroy the client on unmount as it may be reused
      // Just clear any pending timers for this session
    };
  }, []);

  return (
    <QueryClientContext.Provider value={queryClient}>
      {children}
    </QueryClientContext.Provider>
  );
}

/**
 * useQueryClient - Access the QueryClient from context
 *
 * @example
 * ```tsx
 * const queryClient = useQueryClient();
 * queryClient.invalidateQueries('dashboard');
 * ```
 */
export function useQueryClient(): QueryClient {
  const context = useContext(QueryClientContext);

  if (!context) {
    // Fall back to singleton if not in provider
    return getQueryClient();
  }

  return context;
}

/**
 * Helper hooks for common query client operations
 */

/**
 * useInvalidateQueries - Invalidate queries by key
 *
 * @example
 * ```tsx
 * const invalidate = useInvalidateQueries();
 * invalidate('dashboard'); // Invalidate single query
 * invalidate(['dashboard', 'activity']); // Invalidate multiple
 * ```
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return React.useCallback(
    (keys: string | string[], options?: { refetch?: boolean }) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach((key) => {
        queryClient.invalidateQueries(key, options);
      });
    },
    [queryClient],
  );
}

/**
 * useSetQueryData - Manually update query data
 *
 * @example
 * ```tsx
 * const setData = useSetQueryData();
 *
 * // Set directly
 * setData('user', { name: 'John' });
 *
 * // Update based on previous
 * setData('todos', (prev) => [...prev, newTodo]);
 * ```
 */
export function useSetQueryData() {
  const queryClient = useQueryClient();

  return React.useCallback(
    <T,>(key: string, updater: T | ((old: T | null) => T)) => {
      queryClient.setQueryData(key, updater);
    },
    [queryClient],
  );
}

/**
 * usePrefetchQuery - Prefetch a query in the background
 *
 * @example
 * ```tsx
 * const prefetch = usePrefetchQuery();
 *
 * // Prefetch on hover
 * <button onMouseEnter={() => prefetch('user-details', fetchUserDetails)}>
 *   View Details
 * </button>
 * ```
 */
export function usePrefetchQuery() {
  const queryClient = useQueryClient();

  return React.useCallback(
    <T,>(
      key: string,
      queryFn: () => Promise<T>,
      options?: { staleTime?: number },
    ) => {
      queryClient.prefetchQuery(key, queryFn, options);
    },
    [queryClient],
  );
}

/**
 * useIsFetching - Check if any queries are currently fetching
 *
 * @example
 * ```tsx
 * const isFetching = useIsFetching();
 * if (isFetching) {
 *   return <GlobalLoadingIndicator />;
 * }
 * ```
 */
export function useIsFetching(key?: string): boolean {
  const queryClient = useQueryClient();
  const [isFetching, setIsFetching] = React.useState(false);

  React.useEffect(() => {
    const checkFetching = () => {
      // This is a simplified check - in a full implementation,
      // you'd track all active fetches in the QueryClient
      const state = key ? queryClient.getState(key) : null;
      setIsFetching(state?.status === "loading" || false);
    };

    checkFetching();
    const interval = setInterval(checkFetching, 100);
    return () => clearInterval(interval);
  }, [queryClient, key]);

  return isFetching;
}

export default QueryProvider;
