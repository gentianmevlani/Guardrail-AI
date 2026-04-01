"use client";

/**
 * useMutation Hook
 *
 * React hook for data mutations with optimistic updates,
 * error handling, and automatic cache invalidation.
 */

import { useCallback, useRef, useState } from "react";
import { getQueryClient, QueryClient } from "./query-client";

export type MutationStatus = "idle" | "pending" | "success" | "error";

export interface MutationContext<TData, TVariables> {
  previousData?: TData;
  variables: TVariables;
}

export interface UseMutationOptions<
  TData,
  TError,
  TVariables,
  TContext = unknown,
> {
  queryClient?: QueryClient;
  onMutate?: (
    variables: TVariables,
  ) => Promise<TContext | void> | TContext | void;
  onSuccess?: (
    data: TData,
    variables: TVariables,
    context: TContext | undefined,
  ) => void | Promise<void>;
  onError?: (
    error: TError,
    variables: TVariables,
    context: TContext | undefined,
  ) => void | Promise<void>;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    context: TContext | undefined,
  ) => void | Promise<void>;
  retry?: number;
  retryDelay?: number;
  invalidateOnSuccess?:
    | string
    | string[]
    | ((data: TData) => string | string[]);
}

export interface UseMutationResult<TData, TError, TVariables> {
  data: TData | null;
  error: TError | null;
  status: MutationStatus;
  isIdle: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  variables: TVariables | null;
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  reset: () => void;
}

/**
 * useMutation - Handle data mutations with optimistic updates
 *
 * @example
 * ```tsx
 * const { mutate, isPending, error } = useMutation(
 *   (data: UpdateData) => updateSettings(data),
 *   {
 *     onSuccess: () => {
 *       toast.success('Settings updated!');
 *     },
 *     invalidateOnSuccess: 'settings',
 *   }
 * );
 *
 * // With optimistic update
 * const { mutate } = useMutation(
 *   (newTodo: Todo) => createTodo(newTodo),
 *   {
 *     onMutate: async (newTodo) => {
 *       // Cancel outgoing refetches
 *       await queryClient.cancelQueries('todos');
 *
 *       // Snapshot previous value
 *       const previousTodos = queryClient.getState('todos')?.data;
 *
 *       // Optimistically update
 *       queryClient.setQueryData('todos', (old) => [...old, newTodo]);
 *
 *       // Return context with snapshot
 *       return { previousTodos };
 *     },
 *     onError: (err, newTodo, context) => {
 *       // Rollback on error
 *       queryClient.setQueryData('todos', context.previousTodos);
 *     },
 *   }
 * );
 * ```
 */
export function useMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: UseMutationOptions<TData, TError, TVariables, TContext> = {},
): UseMutationResult<TData, TError, TVariables> {
  const {
    queryClient = getQueryClient(),
    onMutate,
    onSuccess,
    onError,
    onSettled,
    retry = 0,
    retryDelay = 1000,
    invalidateOnSuccess,
  } = options;

  const [state, setState] = useState<{
    data: TData | null;
    error: TError | null;
    status: MutationStatus;
    variables: TVariables | null;
  }>({
    data: null,
    error: null,
    status: "idle",
    variables: null,
  });

  const mutationFnRef = useRef(mutationFn);
  mutationFnRef.current = mutationFn;

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setState((s) => ({
        ...s,
        status: "pending",
        variables,
        error: null,
      }));

      let context: TContext | undefined;

      try {
        // Call onMutate for optimistic updates
        if (onMutate) {
          context = (await onMutate(variables)) as TContext | undefined;
        }

        // Execute mutation with retry logic
        let lastError: TError | null = null;
        let data: TData | undefined;

        for (let attempt = 0; attempt <= retry; attempt++) {
          try {
            data = await mutationFnRef.current(variables);
            break;
          } catch (err) {
            lastError = err as TError;
            if (attempt < retry) {
              await new Promise((resolve) =>
                setTimeout(resolve, retryDelay * Math.pow(2, attempt)),
              );
            }
          }
        }

        if (data === undefined) {
          throw lastError;
        }

        setState((s) => ({
          ...s,
          data,
          status: "success",
        }));

        // Invalidate queries on success
        if (invalidateOnSuccess) {
          const keysToInvalidate =
            typeof invalidateOnSuccess === "function"
              ? invalidateOnSuccess(data)
              : invalidateOnSuccess;

          const keys = Array.isArray(keysToInvalidate)
            ? keysToInvalidate
            : [keysToInvalidate];

          keys.forEach((key) => queryClient.invalidateQueries(key));
        }

        // Call onSuccess callback
        await onSuccess?.(data, variables, context);
        await onSettled?.(data, null, variables, context);

        return data;
      } catch (err) {
        const error = err as TError;

        setState((s) => ({
          ...s,
          error,
          status: "error",
        }));

        // Call onError callback (for rollback in optimistic updates)
        await onError?.(error, variables, context);
        await onSettled?.(undefined, error, variables, context);

        throw error;
      }
    },
    [
      onMutate,
      onSuccess,
      onError,
      onSettled,
      queryClient,
      invalidateOnSuccess,
      retry,
      retryDelay,
    ],
  );

  const mutate = useCallback(
    (variables: TVariables): void => {
      mutateAsync(variables).catch(() => {
        // Error is already handled in mutateAsync
      });
    },
    [mutateAsync],
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      status: "idle",
      variables: null,
    });
  }, []);

  return {
    data: state.data,
    error: state.error,
    status: state.status,
    isIdle: state.status === "idle",
    isPending: state.status === "pending",
    isSuccess: state.status === "success",
    isError: state.status === "error",
    variables: state.variables,
    mutate,
    mutateAsync,
    reset,
  };
}

/**
 * Helper to create a mutation with type inference
 *
 * @example
 * ```tsx
 * const updateUserMutation = createMutation({
 *   mutationFn: (data: UserUpdate) => api.updateUser(data),
 *   invalidateOnSuccess: 'user',
 * });
 *
 * // In component
 * const mutation = useMutation(
 *   updateUserMutation.mutationFn,
 *   updateUserMutation.options
 * );
 * ```
 */
export function createMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(config: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  options?: UseMutationOptions<TData, TError, TVariables, TContext>;
}) {
  return {
    mutationFn: config.mutationFn,
    options: config.options ?? {},
  };
}

export default useMutation;
