"use client";

import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Virtualized List Component
interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemKey?: (item: T, index: number) => string;
  overscan?: number;
  className?: string;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  getItemKey,
  overscan = 5,
  className,
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / itemHeight) - overscan,
    );
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan,
    );
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (scrollElementRef.current) {
      setScrollTop(scrollElementRef.current.scrollTop);
    }
  }, []);

  // Render visible items
  const visibleItems = useMemo(() => {
    const result: React.ReactNode[] = [];
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      const item = items[i];
      const key = getItemKey ? getItemKey(item, i) : `item-${i}`;
      result.push(
        <div
          key={key}
          style={{
            position: "absolute",
            top: i * itemHeight,
            left: 0,
            right: 0,
            height: itemHeight,
          }}
        >
          {renderItem(item, i)}
        </div>,
      );
    }
    return result;
  }, [items, visibleRange, itemHeight, renderItem, getItemKey]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      style={{ height: containerHeight }}
    >
      <div
        ref={scrollElementRef}
        className="absolute inset-0 overflow-auto"
        onScroll={handleScroll}
        style={{ height: containerHeight }}
      >
        <div
          style={{ height: items.length * itemHeight, position: "relative" }}
        >
          {visibleItems}
        </div>
      </div>
    </div>
  );
}

// Memoized Virtualized List
export function MemoizedVirtualizedList<T>(props: VirtualizedListProps<T>) {
  return React.useMemo(() => <VirtualizedList {...props} />, [props]);
}

// Infinite Scroll Virtualized List
interface InfiniteVirtualizedListProps<T> extends Omit<
  VirtualizedListProps<T>,
  "items"
> {
  loadMore: () => Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
  loadingIndicator?: React.ReactNode;
  emptyIndicator?: React.ReactNode;
}

export function InfiniteVirtualizedList<T>({
  loadMore,
  hasMore,
  isLoading,
  loadingIndicator,
  emptyIndicator,
  ...props
}: InfiniteVirtualizedListProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // Load more when scrolling near bottom
  const handleScroll = useCallback(() => {
    if (!scrollElementRef.current || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollElementRef.current;
    const threshold = 100; // Load more when 100px from bottom

    if (scrollTop + clientHeight >= scrollHeight - threshold) {
      loadMore();
    }
  }, [loadMore, isLoading, hasMore]);

  // Combine items with loading indicator
  const allItems = useMemo(() => {
    const result = [...items];
    if (isLoading) {
      result.push(null as any); // Placeholder for loading indicator
    }
    return result;
  }, [items, isLoading]);

  // Custom render item
  const renderItem = useCallback(
    (item: T | null, index: number) => {
      if (item === null) {
        return (
          loadingIndicator || <div className="p-4 text-center">Loading...</div>
        );
      }
      return props.renderItem(item, index);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.renderItem, loadingIndicator],
  );

  return (
    <div className="relative">
      <VirtualizedList {...props} items={allItems} renderItem={renderItem} />
      {!isLoading && !hasMore && items.length === 0 && emptyIndicator && (
        <div className="absolute inset-0 flex items-center justify-center">
          {emptyIndicator}
        </div>
      )}
    </div>
  );
}

// Grid Virtualization
interface VirtualizedGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  gap?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemKey?: (item: T, index: number) => string;
  overscan?: number;
  className?: string;
}

export function VirtualizedGrid<T>({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  gap = 0,
  renderItem,
  getItemKey,
  overscan = 2,
  className,
}: VirtualizedGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // Calculate columns
  const columns = useMemo(() => {
    return Math.floor((containerWidth + gap) / (itemWidth + gap));
  }, [containerWidth, itemWidth, gap]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startRow = Math.max(
      0,
      Math.floor(scrollTop / (itemHeight + gap)) - overscan,
    );
    const endRow = Math.min(
      Math.ceil(items.length / columns) - 1,
      Math.ceil((scrollTop + containerHeight) / (itemHeight + gap)) + overscan,
    );
    return { startRow, endRow };
  }, [
    scrollTop,
    itemHeight,
    gap,
    containerHeight,
    items.length,
    columns,
    overscan,
  ]);

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (scrollElementRef.current) {
      setScrollTop(scrollElementRef.current.scrollTop);
    }
  }, []);

  // Render visible items
  const visibleItems = useMemo(() => {
    const result: React.ReactNode[] = [];
    for (let row = visibleRange.startRow; row <= visibleRange.endRow; row++) {
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        if (index >= items.length) break;

        const item = items[index];
        const key = getItemKey ? getItemKey(item, index) : `item-${index}`;

        result.push(
          <div
            key={key}
            style={{
              position: "absolute",
              top: row * (itemHeight + gap),
              left: col * (itemWidth + gap),
              width: itemWidth,
              height: itemHeight,
            }}
          >
            {renderItem(item, index)}
          </div>,
        );
      }
    }
    return result;
  }, [
    items,
    visibleRange,
    columns,
    itemWidth,
    itemHeight,
    gap,
    renderItem,
    getItemKey,
  ]);

  const totalHeight =
    Math.ceil(items.length / columns) * (itemHeight + gap) - gap;

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      style={{ height: containerHeight }}
    >
      <div
        ref={scrollElementRef}
        className="absolute inset-0 overflow-auto"
        onScroll={handleScroll}
        style={{ height: containerHeight }}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          {visibleItems}
        </div>
      </div>
    </div>
  );
}

// Performance Monitoring Hook
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const renderTimes = useRef<number[]>([]);
  const lastRenderTime = useRef<number>(0);

  useEffect(() => {
    renderCount.current++;
    const now = performance.now();

    if (lastRenderTime.current > 0) {
      const renderTime = now - lastRenderTime.current;
      renderTimes.current.push(renderTime);

      // Keep only last 100 renders
      if (renderTimes.current.length > 100) {
        renderTimes.current = renderTimes.current.slice(-100);
      }

      // Log performance warnings
      if (renderTime > 16) {
        // 60fps = 16ms per frame
        logger.warn(
          `Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`,
        );
      }
    }

    lastRenderTime.current = now;
  });

  const getStats = useCallback(() => {
    const times = renderTimes.current;
    if (times.length === 0) return null;

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    return {
      renderCount: renderCount.current,
      averageRenderTime: avg,
      minRenderTime: min,
      maxRenderTime: max,
      totalRenders: times.length,
    };
  }, []);

  return { getStats };
}

// Image Lazy Loading Component
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
}

export function LazyImage({
  src,
  alt,
  placeholder,
  className,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    setError(false);
  };

  const handleError = () => {
    setError(true);
    setIsLoaded(true);
  };

  return (
    <div ref={imgRef} className={cn("relative", className)}>
      {!isLoaded && placeholder && (
        <div className="absolute inset-0 bg-zinc-800 animate-pulse rounded" />
      )}
      {isInView && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            className,
          )}
          {...props}
        />
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 rounded">
          <span className="text-zinc-400 text-sm">Failed to load image</span>
        </div>
      )}
    </div>
  );
}

// Debounced Search Hook
export function useDebouncedSearch<T>(
  searchFn: (query: string) => Promise<T[]>,
  delay: number = 300,
) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const debouncedSearch = useMemo(
    () =>
      debounce(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
          setResults([]);
          return;
        }

        setIsLoading(true);
        setError(null);

        try {
          const searchResults = await searchFn(searchQuery);
          setResults(searchResults);
        } catch (err) {
          setError(err instanceof Error ? err : new Error("Search failed"));
          setResults([]);
        } finally {
          setIsLoading(false);
        }
      }, delay),
    [searchFn, delay],
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
  };
}

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Memoized Component Wrapper
export function memoize<P extends object>(
  Component: React.ComponentType<P>,
  areEqual?: (prevProps: P, nextProps: P) => boolean,
) {
  return React.memo(Component, areEqual);
}

// Performance Stats Display
export function PerformanceStats({ componentName }: { componentName: string }) {
  const { getStats } = usePerformanceMonitor(componentName);
  const [stats, setStats] = useState(getStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, [getStats]);

  if (!stats) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-zinc-900/90 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-300">
      <div>{componentName}</div>
      <div>Renders: {stats.renderCount}</div>
      <div>Avg: {stats.averageRenderTime.toFixed(2)}ms</div>
      <div>Max: {stats.maxRenderTime.toFixed(2)}ms</div>
    </div>
  );
}
