"use client";

import { useState, useEffect, useCallback } from "react";
import { resilientFetch, checkApiHealth } from "@/lib/api";

export type FetchStatus = "idle" | "loading" | "success" | "error" | "offline";

export interface UseApiDataOptions<T> {
  initialData?: T;
  enabled?: boolean;
  refetchInterval?: number;
  retries?: number;
  timeout?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
}

export interface UseApiDataResult<T> {
  data: T | null;
  status: FetchStatus;
  error: string | null;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isOffline: boolean;
  refetch: () => Promise<void>;
  reset: () => void;
}

export function useApiData<T>(
  url: string | null,
  options: UseApiDataOptions<T> = {}
): UseApiDataResult<T> {
  const {
    initialData = null,
    enabled = true,
    refetchInterval,
    retries = 2,
    timeout = 10000,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(initialData as T | null);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url || !enabled) return;

    // Check if API is available first
    const isOnline = await checkApiHealth();
    if (!isOnline) {
      setStatus("offline");
      setError("API is currently unavailable");
      onError?.("API is currently unavailable");
      return;
    }

    setStatus("loading");
    setError(null);

    const result = await resilientFetch<T>(url, { credentials: "include" }, {
      retries,
      timeout,
    });

    if (result.error) {
      setStatus("error");
      setError(result.error);
      onError?.(result.error);
    } else if (result.data) {
      setData(result.data);
      setStatus("success");
      onSuccess?.(result.data);
    }
  }, [url, enabled, retries, timeout, onSuccess, onError]);

  // Initial fetch
  useEffect(() => {
    if (enabled && url) {
      fetchData();
    }
  }, [enabled, url, fetchData]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled || !url) return;

    const interval = setInterval(fetchData, refetchInterval);
    return () => clearInterval(interval);
  }, [refetchInterval, enabled, url, fetchData]);

  const reset = useCallback(() => {
    setData(initialData as T | null);
    setStatus("idle");
    setError(null);
  }, [initialData]);

  return {
    data,
    status,
    error,
    isLoading: status === "loading",
    isError: status === "error",
    isSuccess: status === "success",
    isOffline: status === "offline",
    refetch: fetchData,
    reset,
  };
}

/**
 * Hook for fetching multiple API endpoints in parallel
 */
export function useMultipleApiData<T extends Record<string, any>>(
  endpoints: Record<keyof T, string | null>,
  options: Omit<UseApiDataOptions<any>, "initialData"> = {}
): {
  data: Partial<T>;
  isLoading: boolean;
  isError: boolean;
  errors: Partial<Record<keyof T, string>>;
  refetchAll: () => Promise<void>;
} {
  const [data, setData] = useState<Partial<T>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const results: Partial<T> = {};
    const newErrors: Partial<Record<keyof T, string>> = {};

    await Promise.all(
      Object.entries(endpoints).map(async ([key, url]) => {
        if (!url) return;

        const result = await resilientFetch<any>(
          url,
          { credentials: "include" },
          { retries: options.retries || 2, timeout: options.timeout || 10000 }
        );

        if (result.data) {
          results[key as keyof T] = result.data;
        } else if (result.error) {
          newErrors[key as keyof T] = result.error;
        }
      })
    );

    setData(results);
    setErrors(newErrors);
    setLoading(false);
  }, [endpoints, options.retries, options.timeout]);

  useEffect(() => {
    if (options.enabled !== false) {
      fetchAll();
    }
  }, [fetchAll, options.enabled]);

  return {
    data,
    isLoading: loading,
    isError: Object.keys(errors).length > 0,
    errors,
    refetchAll: fetchAll,
  };
}

export default useApiData;
