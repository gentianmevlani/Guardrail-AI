"use client";

/**
 * useQuery Hook
 *
 * React hook for data fetching with automatic caching, deduplication,
 * and synchronization across components.
 */

import { useCallback, useRef, useSyncExternalStore } from "react";
import {
  getQueryClient,
  QueryClient,
  QueryOptions,
  QueryState,
} from "./query-client";

export interface UseQueryOptions<T> extends QueryOptions<T> {
  queryClient?: QueryClient;
}

export interface UseQueryResult<T> {
  data: T | null;
  error: Error | null;
  status: QueryState<T>["status"];
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isIdle: boolean;
  isFetching: boolean;
  isStale: boolean;
  dataUpdatedAt: number;
  refetch: () => Promise<T>;
}

/**
 * useQuery - Fetch and cache data with automatic synchronization
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useQuery(
 *   'dashboard-summary',
 *   fetchDashboardSummary,
 *   { staleTime: 60000 }
 * );
 * ```
 */
export function useQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: UseQueryOptions<T> = {},
): UseQueryResult<T> {
  const { queryClient = getQueryClient(), ...queryOptions } = options;

  // Use ref to track if we're fetching (for isFetching state)
  const isFetchingRef = useRef(false);

  // Subscribe to query state changes
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return queryClient.subscribe(key, queryFn, queryOptions, onStoreChange);
    },
    [queryClient, key, queryFn, queryOptions],
  );

  // Get current snapshot
  const getSnapshot = useCallback((): QueryState<T> => {
    return (
      queryClient.getState<T>(key) ?? {
        data: options.initialData ?? options.placeholderData ?? null,
        error: null,
        status: options.initialData ? "success" : "idle",
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
        isStale: true,
      }
    );
  }, [queryClient, key, options.initialData, options.placeholderData]);

  // Server snapshot (for SSR)
  const getServerSnapshot = useCallback((): QueryState<T> => {
    return {
      data: options.initialData ?? options.placeholderData ?? null,
      error: null,
      status: options.initialData ? "success" : "idle",
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      isStale: true,
    };
  }, [options.initialData, options.placeholderData]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Refetch function
  const refetch = useCallback(async (): Promise<T> => {
    isFetchingRef.current = true;
    try {
      return await queryClient.fetch<T>(key, { ...queryOptions, queryFn });
    } finally {
      isFetchingRef.current = false;
    }
  }, [queryClient, key, queryFn, queryOptions]);

  // Derived states
  const isLoading = state.status === "loading" && state.data === null;
  const isFetching = state.status === "loading";
  const isError = state.status === "error";
  const isSuccess = state.status === "success";
  const isIdle = state.status === "idle";

  return {
    data: state.data,
    error: state.error,
    status: state.status,
    isLoading,
    isError,
    isSuccess,
    isIdle,
    isFetching,
    isStale: state.isStale,
    dataUpdatedAt: state.dataUpdatedAt,
    refetch,
  };
}

/**
 * useQueries - Fetch multiple queries in parallel
 *
 * @example
 * ```tsx
 * const results = useQueries([
 *   { key: 'users', queryFn: fetchUsers },
 *   { key: 'projects', queryFn: fetchProjects },
 * ]);
 * ```
 */
export function useQueries<T extends readonly unknown[]>(queries: {
  [K in keyof T]: {
    key: string;
    queryFn: () => Promise<T[K]>;
    options?: UseQueryOptions<T[K]>;
  };
}): { [K in keyof T]: UseQueryResult<T[K]> } {
  // Use individual useQuery hooks for each query
  // This maintains proper React hooks rules
  const results = queries.map((query) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery(query.key, query.queryFn, query.options),
  );

  return results as { [K in keyof T]: UseQueryResult<T[K]> };
}

/**
 * useSuspenseQuery - Query with React Suspense support
 *
 * @example
 * ```tsx
 * // Wrap with <Suspense fallback={<Loading />}>
 * const { data } = useSuspenseQuery('dashboard', fetchDashboard);
 * // data is guaranteed to be defined here
 * ```
 */
export function useSuspenseQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: Omit<UseQueryOptions<T>, "enabled"> = {},
): Omit<UseQueryResult<T>, "data"> & { data: T } {
  const { queryClient = getQueryClient(), ...queryOptions } = options;

  // Check if we have data or an error
  const state = queryClient.getState<T>(key);

  // If no data and no error, throw promise for Suspense
  if (!state || (state.status !== "success" && state.status !== "error")) {
    throw queryClient.fetch(key, { ...queryOptions, queryFn });
  }

  // If error, throw it for error boundary
  if (state.status === "error" && state.error) {
    throw state.error;
  }

  // Use regular query hook for subscription
  const result = useQuery(key, queryFn, { ...options, enabled: true });

  return result as Omit<UseQueryResult<T>, "data"> & { data: T };
}

export default useQuery;
