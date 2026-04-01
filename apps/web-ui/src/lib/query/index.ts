/**
 * Guardrail Query System
 *
 * A lightweight, React Query-inspired data fetching layer providing:
 * - Request deduplication (multiple components = single request)
 * - Global cache with subscriptions (all components stay in sync)
 * - Stale-while-revalidate pattern
 * - Optimistic updates for mutations
 * - Automatic cache invalidation
 * - TypeScript-first design
 *
 * @example
 * ```tsx
 * // Basic query
 * const { data, isLoading } = useQuery('dashboard', fetchDashboard);
 *
 * // With options
 * const { data } = useQuery('users', fetchUsers, {
 *   staleTime: 60000,
 *   refetchInterval: 30000,
 * });
 *
 * // Mutation with optimistic update
 * const { mutate, isPending } = useMutation(updateUser, {
 *   onMutate: async (newUser) => {
 *     const previous = queryClient.getState('user')?.data;
 *     queryClient.setQueryData('user', newUser);
 *     return { previous };
 *   },
 *   onError: (err, vars, context) => {
 *     queryClient.setQueryData('user', context.previous);
 *   },
 *   invalidateOnSuccess: 'user',
 * });
 *
 * // Manual cache operations
 * const invalidate = useInvalidateQueries();
 * invalidate('dashboard');
 * ```
 */

// Core query client
export {
  QueryClient,
  getQueryClient,
  setQueryClient,
  type QueryOptions,
  type QueryState,
  type QueryStatus,
} from "./query-client";

// React hooks
export {
  useQueries,
  useQuery,
  useSuspenseQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from "./use-query";

export {
  createMutation,
  useMutation,
  type MutationStatus,
  type UseMutationOptions,
  type UseMutationResult,
} from "./use-mutation";

// Provider and utilities
export {
  QueryProvider,
  useInvalidateQueries,
  useIsFetching,
  usePrefetchQuery,
  useQueryClient,
  useSetQueryData,
} from "./query-provider";

// Infinite query for pagination
export {
  useInfiniteQuery,
  type InfiniteQueryOptions,
  type InfiniteQueryPage,
} from "./use-infinite-query";

// Optimistic update utilities
export {
  createDebouncedOptimisticUpdater,
  createOptimisticContext,
  optimisticAddItem,
  optimisticBatchUpdate,
  optimisticRemoveItem,
  optimisticUpdateCounter,
  optimisticUpdateItem,
} from "./optimistic-utils";
