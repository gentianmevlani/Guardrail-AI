"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

interface UseApiOptions<T> {
  initialData?: T;
  cacheKey?: string;
  cacheTTL?: number; // Time to live in ms
  refetchInterval?: number; // Auto-refetch interval in ms
  refetchOnFocus?: boolean;
  refetchOnReconnect?: boolean;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseApiReturn<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  refetch: () => Promise<void>;
  mutate: (data: T | ((prev: T | null) => T)) => void;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  options: UseApiOptions<T> = {},
): UseApiReturn<T> {
  const {
    initialData,
    cacheKey,
    cacheTTL = 60000, // 1 minute default
    refetchInterval,
    refetchOnFocus = true,
    refetchOnReconnect = true,
    enabled = true,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(() => {
    if (cacheKey) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
      }
    }
    return initialData ?? null;
  });
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(!data && enabled);
  const [isValidating, setIsValidating] = useState(false);

  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const updateCache = useCallback(
    (newData: T) => {
      if (cacheKey) {
        cache.set(cacheKey, {
          data: newData,
          timestamp: Date.now(),
          expiresAt: Date.now() + cacheTTL,
        });
      }
    },
    [cacheKey, cacheTTL],
  );

  const fetchData = useCallback(
    async (isInitial = false) => {
      if (!enabled) return;

      if (isInitial) {
        setIsLoading(true);
      } else {
        setIsValidating(true);
      }

      try {
        const result = await fetcherRef.current();

        if (!mountedRef.current) return;

        setData(result);
        setError(null);
        updateCache(result);
        onSuccess?.(result);
      } catch (err) {
        if (!mountedRef.current) return;

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
          setIsValidating(false);
        }
      }
    },
    [enabled, updateCache, onSuccess, onError],
  );

  const refetch = useCallback(async () => {
    await fetchData(false);
  }, [fetchData]);

  const mutate = useCallback(
    (newData: T | ((prev: T | null) => T)) => {
      setData((prev) => {
        const updated =
          typeof newData === "function"
            ? (newData as (prev: T | null) => T)(prev)
            : newData;
        updateCache(updated);
        return updated;
      });
    },
    [updateCache],
  );

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      // Check cache first
      if (cacheKey) {
        const cached = cache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
          setData(cached.data);
          setIsLoading(false);
          // Still revalidate in background
          fetchData(false);
          return;
        }
      }
      fetchData(true);
    }

    return () => {
      mountedRef.current = false;
    };
  }, [enabled, cacheKey, fetchData]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const intervalId = setInterval(() => {
      fetchData(false);
    }, refetchInterval);

    return () => clearInterval(intervalId);
  }, [refetchInterval, enabled, fetchData]);

  // Refetch on focus
  useEffect(() => {
    if (!refetchOnFocus || !enabled || typeof window === "undefined") return;

    const handleFocus = () => {
      fetchData(false);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchOnFocus, enabled, fetchData]);

  // Refetch on reconnect
  useEffect(() => {
    if (!refetchOnReconnect || !enabled || typeof window === "undefined")
      return;

    const handleOnline = () => {
      fetchData(false);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [refetchOnReconnect, enabled, fetchData]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    refetch,
    mutate,
  };
}

export function clearApiCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

export function getApiCacheEntry<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data;
  }
  return null;
}

export default useApi;
