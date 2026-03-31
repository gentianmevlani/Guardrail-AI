"use client";

/**
 * useInfiniteQuery Hook
 *
 * A hook for fetching paginated data with automatic page management.
 * Supports cursor-based and offset-based pagination.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";

export interface InfiniteQueryPage<TData> {
  data: TData;
  nextCursor?: string | number;
  hasMore: boolean;
}

export interface InfiniteQueryOptions<TData, TPageParam = string | number> {
  getNextPageParam: (
    lastPage: InfiniteQueryPage<TData>,
  ) => TPageParam | undefined;
  initialPageParam?: TPageParam;
  staleTime?: number;
  enabled?: boolean;
  onSuccess?: (data: InfiniteQueryPage<TData>[]) => void;
  onError?: (error: Error) => void;
}

interface InfiniteQueryState<TData> {
  pages: InfiniteQueryPage<TData>[];
  pageParams: (string | number | undefined)[];
  status: "idle" | "loading" | "success" | "error";
  error: Error | null;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
}

type InfiniteQueryAction<TData> =
  | { type: "FETCH_START" }
  | { type: "FETCH_NEXT_START" }
  | {
      type: "FETCH_SUCCESS";
      page: InfiniteQueryPage<TData>;
      pageParam: string | number | undefined;
    }
  | {
      type: "FETCH_NEXT_SUCCESS";
      page: InfiniteQueryPage<TData>;
      pageParam: string | number | undefined;
    }
  | { type: "FETCH_ERROR"; error: Error }
  | { type: "RESET" };

function createReducer<TData>() {
  return function reducer(
    state: InfiniteQueryState<TData>,
    action: InfiniteQueryAction<TData>,
  ): InfiniteQueryState<TData> {
    switch (action.type) {
      case "FETCH_START":
        return { ...state, status: "loading", error: null };
      case "FETCH_NEXT_START":
        return { ...state, isFetchingNextPage: true, error: null };
      case "FETCH_SUCCESS":
        return {
          ...state,
          status: "success",
          pages: [action.page],
          pageParams: [action.pageParam],
          hasNextPage: action.page.hasMore,
          error: null,
        };
      case "FETCH_NEXT_SUCCESS":
        return {
          ...state,
          isFetchingNextPage: false,
          pages: [...state.pages, action.page],
          pageParams: [...state.pageParams, action.pageParam],
          hasNextPage: action.page.hasMore,
          error: null,
        };
      case "FETCH_ERROR":
        return {
          ...state,
          status: "error",
          isFetchingNextPage: false,
          error: action.error,
        };
      case "RESET":
        return createInitialState();
      default:
        return state;
    }
  };
}

function createInitialState<TData>(): InfiniteQueryState<TData> {
  return {
    pages: [],
    pageParams: [],
    status: "idle",
    error: null,
    isFetchingNextPage: false,
    hasNextPage: false,
  };
}

export function useInfiniteQuery<TData, TPageParam = string | number>(
  queryKey: string,
  queryFn: (pageParam?: TPageParam) => Promise<InfiniteQueryPage<TData>>,
  options: InfiniteQueryOptions<TData, TPageParam>,
) {
  const {
    getNextPageParam,
    initialPageParam,
    staleTime = 30000,
    enabled = true,
    onSuccess,
    onError,
  } = options;

  const [state, dispatch] = useReducer(
    createReducer<TData>(),
    createInitialState<TData>(),
  );

  const isMountedRef = useRef(true);
  const fetchingRef = useRef(false);

  // Fetch initial page
  const fetchFirstPage = useCallback(async () => {
    if (fetchingRef.current || !enabled) return;
    fetchingRef.current = true;

    dispatch({ type: "FETCH_START" });

    try {
      const page = await queryFn(initialPageParam as TPageParam);
      if (isMountedRef.current) {
        dispatch({
          type: "FETCH_SUCCESS",
          page,
          pageParam: initialPageParam as string | number | undefined,
        });
        onSuccess?.([page]);
      }
    } catch (error) {
      if (isMountedRef.current) {
        const err = error instanceof Error ? error : new Error(String(error));
        dispatch({ type: "FETCH_ERROR", error: err });
        onError?.(err);
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [queryFn, initialPageParam, enabled, onSuccess, onError]);

  // Fetch next page
  const fetchNextPage = useCallback(async () => {
    if (fetchingRef.current || !state.hasNextPage || state.pages.length === 0)
      return;

    const lastPage = state.pages[state.pages.length - 1];
    const nextPageParam = getNextPageParam(lastPage);

    if (nextPageParam === undefined) return;

    fetchingRef.current = true;
    dispatch({ type: "FETCH_NEXT_START" });

    try {
      const page = await queryFn(nextPageParam as TPageParam);
      if (isMountedRef.current) {
        dispatch({
          type: "FETCH_NEXT_SUCCESS",
          page,
          pageParam: nextPageParam as string | number | undefined,
        });
        onSuccess?.([...state.pages, page]);
      }
    } catch (error) {
      if (isMountedRef.current) {
        const err = error instanceof Error ? error : new Error(String(error));
        dispatch({ type: "FETCH_ERROR", error: err });
        onError?.(err);
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [
    state.pages,
    state.hasNextPage,
    getNextPageParam,
    queryFn,
    onSuccess,
    onError,
  ]);

  // Refetch all pages
  const refetch = useCallback(async () => {
    dispatch({ type: "RESET" });
    await fetchFirstPage();
  }, [fetchFirstPage]);

  // Initial fetch
  useEffect(() => {
    if (enabled && state.status === "idle") {
      fetchFirstPage();
    }
  }, [enabled, state.status, fetchFirstPage]);

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Flatten all page data
  const allData = state.pages.flatMap((page) =>
    Array.isArray(page.data) ? page.data : [page.data],
  );

  return {
    data: allData,
    pages: state.pages,
    pageParams: state.pageParams,
    status: state.status,
    isLoading: state.status === "loading",
    isSuccess: state.status === "success",
    isError: state.status === "error",
    error: state.error,
    isFetchingNextPage: state.isFetchingNextPage,
    hasNextPage: state.hasNextPage,
    fetchNextPage,
    refetch,
  };
}
