/**
 * Guardrail Query Client
 *
 * A lightweight, React Query-inspired data fetching layer that provides:
 * - Request deduplication (multiple components = single request)
 * - Global cache with subscriptions (all components stay in sync)
 * - Stale-while-revalidate pattern
 * - Automatic garbage collection
 * - TypeScript-first design
 */

export type QueryStatus = "idle" | "loading" | "success" | "error";

export interface QueryState<T> {
  data: T | null;
  error: Error | null;
  status: QueryStatus;
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  isStale: boolean;
}

export interface QueryOptions<T> {
  staleTime?: number; // Time until data is considered stale (default: 0)
  cacheTime?: number; // Time to keep unused data in cache (default: 5 min)
  retry?: number; // Number of retries on failure (default: 3)
  retryDelay?: number; // Delay between retries (default: 1000ms)
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  refetchInterval?: number | false;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  onSettled?: (data: T | null, error: Error | null) => void;
  initialData?: T;
  placeholderData?: T;
}

type QueryFn<T> = () => Promise<T>;
type Listener = () => void;

interface QueryEntry<T> {
  state: QueryState<T>;
  options: QueryOptions<T>;
  fetchPromise: Promise<T> | null;
  listeners: Set<Listener>;
  gcTimeout: ReturnType<typeof setTimeout> | null;
  refetchInterval: ReturnType<typeof setInterval> | null;
  retryCount: number;
}

const DEFAULT_OPTIONS: Required<QueryOptions<unknown>> = {
  staleTime: 0,
  cacheTime: 5 * 60 * 1000, // 5 minutes
  retry: 3,
  retryDelay: 1000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchInterval: false,
  enabled: true,
  onSuccess: () => {},
  onError: () => {},
  onSettled: () => {},
  initialData: undefined,
  placeholderData: undefined,
};

function createInitialState<T>(options: QueryOptions<T>): QueryState<T> {
  return {
    data: options.initialData ?? options.placeholderData ?? null,
    error: null,
    status: options.initialData ? "success" : "idle",
    dataUpdatedAt: options.initialData ? Date.now() : 0,
    errorUpdatedAt: 0,
    isStale: !options.initialData,
  };
}

export class QueryClient {
  private queries = new Map<string, QueryEntry<any>>();
  private defaultOptions: QueryOptions<unknown> = {};
  private focusListenerAttached = false;
  private onlineListenerAttached = false;

  constructor(defaultOptions: QueryOptions<unknown> = {}) {
    this.defaultOptions = defaultOptions;
    this.setupGlobalListeners();
  }

  private setupGlobalListeners(): void {
    if (typeof window === "undefined") return;

    if (!this.focusListenerAttached) {
      window.addEventListener("focus", this.handleWindowFocus);
      this.focusListenerAttached = true;
    }

    if (!this.onlineListenerAttached) {
      window.addEventListener("online", this.handleOnline);
      this.onlineListenerAttached = true;
    }
  }

  private handleWindowFocus = (): void => {
    this.queries.forEach((entry, key) => {
      const opts = this.mergeOptions(entry.options);
      if (
        opts.refetchOnWindowFocus &&
        entry.state.isStale &&
        entry.listeners.size > 0
      ) {
        this.fetch(key, entry.options);
      }
    });
  };

  private handleOnline = (): void => {
    this.queries.forEach((entry, key) => {
      const opts = this.mergeOptions(entry.options);
      if (
        opts.refetchOnReconnect &&
        entry.state.isStale &&
        entry.listeners.size > 0
      ) {
        this.fetch(key, entry.options);
      }
    });
  };

  private mergeOptions<T>(options: QueryOptions<T>): Required<QueryOptions<T>> {
    return {
      ...DEFAULT_OPTIONS,
      ...this.defaultOptions,
      ...options,
    } as Required<QueryOptions<T>>;
  }

  private getOrCreateEntry<T>(
    key: string,
    queryFn: QueryFn<T>,
    options: QueryOptions<T>,
  ): QueryEntry<T> {
    let entry = this.queries.get(key) as QueryEntry<T> | undefined;

    if (!entry) {
      entry = {
        state: createInitialState(options),
        options: { ...options, queryFn } as QueryOptions<T> & {
          queryFn: QueryFn<T>;
        },
        fetchPromise: null,
        listeners: new Set(),
        gcTimeout: null,
        refetchInterval: null,
        retryCount: 0,
      };
      this.queries.set(key, entry);
    }

    return entry;
  }

  private notifyListeners(key: string): void {
    const entry = this.queries.get(key);
    if (entry) {
      entry.listeners.forEach((listener) => listener());
    }
  }

  private updateState<T>(
    key: string,
    updater: (state: QueryState<T>) => Partial<QueryState<T>>,
  ): void {
    const entry = this.queries.get(key) as QueryEntry<T> | undefined;
    if (entry) {
      const updates = updater(entry.state);
      entry.state = { ...entry.state, ...updates };
      this.notifyListeners(key);
    }
  }

  private scheduleGC(key: string): void {
    const entry = this.queries.get(key);
    if (!entry) return;

    const opts = this.mergeOptions(entry.options);

    // Clear existing timeout
    if (entry.gcTimeout) {
      clearTimeout(entry.gcTimeout);
    }

    // Schedule new GC
    entry.gcTimeout = setTimeout(() => {
      const currentEntry = this.queries.get(key);
      if (currentEntry && currentEntry.listeners.size === 0) {
        this.queries.delete(key);
      }
    }, opts.cacheTime);
  }

  private setupRefetchInterval(key: string, queryFn: QueryFn<any>): void {
    const entry = this.queries.get(key);
    if (!entry) return;

    const opts = this.mergeOptions(entry.options);

    // Clear existing interval
    if (entry.refetchInterval) {
      clearInterval(entry.refetchInterval);
      entry.refetchInterval = null;
    }

    // Setup new interval if configured
    if (opts.refetchInterval && opts.refetchInterval > 0) {
      entry.refetchInterval = setInterval(() => {
        if (entry.listeners.size > 0) {
          this.fetch(key, { ...entry.options, queryFn });
        }
      }, opts.refetchInterval);
    }
  }

  /**
   * Fetch data for a query key
   */
  async fetch<T>(
    key: string,
    options: QueryOptions<T> & { queryFn?: QueryFn<T> } = {},
  ): Promise<T> {
    const entry = this.queries.get(key) as QueryEntry<T> | undefined;
    const queryFn = options.queryFn || (entry?.options as any)?.queryFn;

    if (!queryFn) {
      throw new Error(`No query function found for key: ${key}`);
    }

    const opts = this.mergeOptions(options);

    // Return existing promise if there's an in-flight request (deduplication)
    if (entry?.fetchPromise) {
      return entry.fetchPromise;
    }

    // Update status to loading
    this.updateState<T>(key, () => ({
      status: "loading",
    }));

    const fetchWithRetry = async (retryCount: number): Promise<T> => {
      try {
        const data = await queryFn();

        this.updateState<T>(key, () => ({
          data,
          error: null,
          status: "success",
          dataUpdatedAt: Date.now(),
          isStale: false,
        }));

        // Schedule staleness
        if (opts.staleTime > 0) {
          setTimeout(() => {
            this.updateState<T>(key, () => ({ isStale: true }));
          }, opts.staleTime);
        } else {
          this.updateState<T>(key, () => ({ isStale: true }));
        }

        opts.onSuccess(data);
        opts.onSettled(data, null);

        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        // Retry logic
        if (retryCount < opts.retry) {
          await new Promise((resolve) =>
            setTimeout(resolve, opts.retryDelay * Math.pow(2, retryCount)),
          );
          return fetchWithRetry(retryCount + 1);
        }

        this.updateState<T>(key, () => ({
          error,
          status: "error",
          errorUpdatedAt: Date.now(),
        }));

        opts.onError(error);
        opts.onSettled(null, error);

        throw error;
      }
    };

    const currentEntry = this.queries.get(key) as QueryEntry<T>;
    currentEntry.fetchPromise = fetchWithRetry(0).finally(() => {
      const e = this.queries.get(key);
      if (e) {
        e.fetchPromise = null;
      }
    });

    return currentEntry.fetchPromise;
  }

  /**
   * Subscribe to a query
   */
  subscribe<T>(
    key: string,
    queryFn: QueryFn<T>,
    options: QueryOptions<T>,
    listener: Listener,
  ): () => void {
    const entry = this.getOrCreateEntry(key, queryFn, options);

    // Cancel GC
    if (entry.gcTimeout) {
      clearTimeout(entry.gcTimeout);
      entry.gcTimeout = null;
    }

    // Add listener
    entry.listeners.add(listener);

    // Setup refetch interval
    this.setupRefetchInterval(key, queryFn);

    const opts = this.mergeOptions(options);

    // Fetch if enabled and (no data or stale)
    if (
      opts.enabled &&
      (entry.state.status === "idle" || entry.state.isStale)
    ) {
      this.fetch(key, { ...options, queryFn });
    }

    // Return unsubscribe function
    return () => {
      entry.listeners.delete(listener);

      // Clear refetch interval if no listeners
      if (entry.listeners.size === 0) {
        if (entry.refetchInterval) {
          clearInterval(entry.refetchInterval);
          entry.refetchInterval = null;
        }
        this.scheduleGC(key);
      }
    };
  }

  /**
   * Get current state for a query
   */
  getState<T>(key: string): QueryState<T> | undefined {
    const entry = this.queries.get(key) as QueryEntry<T> | undefined;
    return entry?.state;
  }

  /**
   * Manually set query data (for optimistic updates)
   */
  setQueryData<T>(key: string, updater: T | ((old: T | null) => T)): void {
    const entry = this.queries.get(key);
    if (!entry) return;

    const newData =
      typeof updater === "function"
        ? (updater as (old: T | null) => T)(entry.state.data)
        : updater;

    this.updateState<T>(key, () => ({
      data: newData,
      dataUpdatedAt: Date.now(),
    }));
  }

  /**
   * Invalidate queries (mark as stale and optionally refetch)
   */
  invalidateQueries(
    keyOrPredicate: string | ((key: string) => boolean),
    options: { refetch?: boolean } = { refetch: true },
  ): void {
    const predicate =
      typeof keyOrPredicate === "function"
        ? keyOrPredicate
        : (k: string) =>
            k === keyOrPredicate || k.startsWith(`${keyOrPredicate}:`);

    this.queries.forEach((entry, key) => {
      if (predicate(key)) {
        this.updateState(key, () => ({ isStale: true }));

        if (options.refetch && entry.listeners.size > 0) {
          this.fetch(key, entry.options);
        }
      }
    });
  }

  /**
   * Remove queries from cache
   */
  removeQueries(keyOrPredicate: string | ((key: string) => boolean)): void {
    const predicate =
      typeof keyOrPredicate === "function"
        ? keyOrPredicate
        : (k: string) =>
            k === keyOrPredicate || k.startsWith(`${keyOrPredicate}:`);

    this.queries.forEach((entry, key) => {
      if (predicate(key)) {
        if (entry.gcTimeout) clearTimeout(entry.gcTimeout);
        if (entry.refetchInterval) clearInterval(entry.refetchInterval);
        this.queries.delete(key);
      }
    });
  }

  /**
   * Prefetch a query
   */
  async prefetchQuery<T>(
    key: string,
    queryFn: QueryFn<T>,
    options: QueryOptions<T> = {},
  ): Promise<void> {
    this.getOrCreateEntry(key, queryFn, options);
    await this.fetch(key, { ...options, queryFn });
  }

  /**
   * Get all query keys
   */
  getAllKeys(): string[] {
    return Array.from(this.queries.keys());
  }

  /**
   * Clear all queries
   */
  clear(): void {
    this.queries.forEach((entry) => {
      if (entry.gcTimeout) clearTimeout(entry.gcTimeout);
      if (entry.refetchInterval) clearInterval(entry.refetchInterval);
    });
    this.queries.clear();
  }

  /**
   * Cleanup (call on app unmount)
   */
  destroy(): void {
    this.clear();
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", this.handleWindowFocus);
      window.removeEventListener("online", this.handleOnline);
    }
  }
}

// Default singleton instance
let defaultClient: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!defaultClient) {
    defaultClient = new QueryClient({
      staleTime: 30000, // 30 seconds default for Guardrail
      refetchOnWindowFocus: true,
    });
  }
  return defaultClient;
}

export function setQueryClient(client: QueryClient): void {
  defaultClient = client;
}
