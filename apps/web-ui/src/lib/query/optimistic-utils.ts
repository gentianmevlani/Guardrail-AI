"use client";

/**
 * Optimistic Update Utilities
 *
 * Helper functions for implementing optimistic updates with the query system.
 * These utilities make it easy to update the cache optimistically and rollback on error.
 */

import { getQueryClient } from "./query-client";

/**
 * Creates an optimistic update context for use in mutations.
 * Captures the previous state and provides rollback functionality.
 */
export function createOptimisticContext<T>(queryKey: string) {
  const queryClient = getQueryClient();
  const previousData = queryClient.getState<T>(queryKey)?.data ?? null;

  return {
    previousData,
    rollback: () => {
      if (previousData !== null) {
        queryClient.setQueryData<T>(queryKey, previousData);
      }
    },
  };
}

/**
 * Optimistically updates a single item in a list.
 * Useful for updating a specific item without refetching the entire list.
 */
export function optimisticUpdateItem<T extends { id: string }>(
  queryKey: string,
  itemId: string,
  updater: (item: T) => T,
): { previousData: T[] | null; rollback: () => void } {
  const queryClient = getQueryClient();
  const previousData = queryClient.getState<T[]>(queryKey)?.data ?? null;

  if (previousData) {
    const updatedData = previousData.map((item) =>
      item.id === itemId ? updater(item) : item,
    );
    queryClient.setQueryData<T[]>(queryKey, updatedData);
  }

  return {
    previousData,
    rollback: () => {
      if (previousData !== null) {
        queryClient.setQueryData<T[]>(queryKey, previousData);
      }
    },
  };
}

/**
 * Optimistically adds an item to a list.
 * Useful for adding new items without waiting for server response.
 */
export function optimisticAddItem<T>(
  queryKey: string,
  newItem: T,
  position: "start" | "end" = "start",
): { previousData: T[] | null; rollback: () => void } {
  const queryClient = getQueryClient();
  const previousData = queryClient.getState<T[]>(queryKey)?.data ?? null;

  if (previousData) {
    const updatedData =
      position === "start"
        ? [newItem, ...previousData]
        : [...previousData, newItem];
    queryClient.setQueryData<T[]>(queryKey, updatedData);
  } else {
    queryClient.setQueryData<T[]>(queryKey, [newItem]);
  }

  return {
    previousData,
    rollback: () => {
      if (previousData !== null) {
        queryClient.setQueryData<T[]>(queryKey, previousData);
      }
    },
  };
}

/**
 * Optimistically removes an item from a list.
 * Useful for deleting items without waiting for server response.
 */
export function optimisticRemoveItem<T extends { id: string }>(
  queryKey: string,
  itemId: string,
): { previousData: T[] | null; removedItem: T | null; rollback: () => void } {
  const queryClient = getQueryClient();
  const previousData = queryClient.getState<T[]>(queryKey)?.data ?? null;
  let removedItem: T | null = null;

  if (previousData) {
    removedItem = previousData.find((item) => item.id === itemId) ?? null;
    const updatedData = previousData.filter((item) => item.id !== itemId);
    queryClient.setQueryData<T[]>(queryKey, updatedData);
  }

  return {
    previousData,
    removedItem,
    rollback: () => {
      if (previousData !== null) {
        queryClient.setQueryData<T[]>(queryKey, previousData);
      }
    },
  };
}

/**
 * Optimistically updates a counter or numeric value.
 * Useful for like counts, unread counts, etc.
 */
export function optimisticUpdateCounter<T extends Record<string, unknown>>(
  queryKey: string,
  counterKey: keyof T,
  delta: number,
): { previousData: T | null; rollback: () => void } {
  const queryClient = getQueryClient();
  const previousData = queryClient.getState<T>(queryKey)?.data ?? null;

  if (previousData && typeof previousData[counterKey] === "number") {
    const updatedData = {
      ...previousData,
      [counterKey]: (previousData[counterKey] as number) + delta,
    };
    queryClient.setQueryData<T>(queryKey, updatedData);
  }

  return {
    previousData,
    rollback: () => {
      if (previousData !== null) {
        queryClient.setQueryData<T>(queryKey, previousData);
      }
    },
  };
}

/**
 * Batch optimistic update for multiple queries.
 * Useful when a single action affects multiple cached queries.
 */
export function optimisticBatchUpdate<T>(
  updates: Array<{ queryKey: string; updater: (data: T | null) => T }>,
): { rollbackAll: () => void } {
  const queryClient = getQueryClient();
  const rollbacks: Array<() => void> = [];

  for (const { queryKey, updater } of updates) {
    const previousData = queryClient.getState<T>(queryKey)?.data ?? null;
    const newData = updater(previousData);
    queryClient.setQueryData<T>(queryKey, newData);

    rollbacks.push(() => {
      if (previousData !== null) {
        queryClient.setQueryData<T>(queryKey, previousData);
      }
    });
  }

  return {
    rollbackAll: () => {
      rollbacks.forEach((rollback) => rollback());
    },
  };
}

/**
 * Creates a debounced optimistic updater.
 * Useful for rapid updates like typing in a search field.
 */
export function createDebouncedOptimisticUpdater<T>(
  queryKey: string,
  delay: number = 300,
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let previousData: T | null = null;
  const queryClient = getQueryClient();

  return {
    update: (newData: T) => {
      if (previousData === null) {
        previousData = queryClient.getState<T>(queryKey)?.data ?? null;
      }

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      queryClient.setQueryData<T>(queryKey, newData);

      timeoutId = setTimeout(() => {
        previousData = null;
        timeoutId = null;
      }, delay);
    },
    rollback: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (previousData !== null) {
        queryClient.setQueryData<T>(queryKey, previousData);
        previousData = null;
      }
    },
    commit: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      previousData = null;
    },
  };
}
