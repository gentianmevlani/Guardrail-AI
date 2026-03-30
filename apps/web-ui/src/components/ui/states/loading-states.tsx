"use client";

import { cn } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";

// Progressive Loading States
interface ProgressiveLoaderProps {
  steps: Array<{ label: string; completed: boolean }>;
  currentStep: number;
  className?: string;
}

export function ProgressiveLoader({ steps, currentStep, className }: ProgressiveLoaderProps) {
  return (
    <div className={cn("p-6 bg-zinc-900/50 border border-zinc-800 rounded-lg", className)}>
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-3">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                step.completed
                  ? "bg-emerald-500 text-white"
                  : index === currentStep
                    ? "bg-blue-500 text-white animate-pulse"
                    : "bg-zinc-800 text-zinc-500"
              )}
            >
              {step.completed ? "✓" : index + 1}
            </div>
            <div className="flex-1">
              <div
                className={cn(
                  "text-sm font-medium",
                  step.completed
                    ? "text-emerald-400"
                    : index === currentStep
                      ? "text-blue-400"
                      : "text-zinc-500"
                )}
              >
                {step.label}
              </div>
              {index === currentStep && (
                <div className="mt-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: "60%" }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton Loading States
interface SkeletonProps {
  className?: string;
  variant?: "default" | "circle" | "text";
  width?: string;
  height?: string;
}

export function Skeleton({ className, variant = "default", width, height }: SkeletonProps) {
  const variantClasses = {
    default: "rounded",
    circle: "rounded-full",
    text: "rounded h-4",
  };

  return (
    <div
      className={cn(
        "animate-pulse bg-zinc-800",
        variantClasses[variant],
        className
      )}
      style={{ width, height }}
      role="status"
      aria-label="Loading"
    />
  );
}

// Card Skeleton
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-zinc-800 bg-black/40 p-6 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Skeleton variant="text" width="128px" />
        <Skeleton variant="circle" width="20px" height="20px" />
      </div>
      <div className="space-y-2">
        <Skeleton variant="text" />
        <Skeleton variant="text" width="75%" />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <Skeleton variant="circle" width="32px" height="32px" />
        <Skeleton variant="text" width="96px" />
      </div>
    </div>
  );
}

// Table Skeleton
export function TableSkeleton({ 
  rows = 5, 
  columns = 4, 
  showHeader = true,
  className 
}: { 
  rows?: number; 
  columns?: number; 
  showHeader?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-zinc-800 overflow-hidden", className)}>
      {showHeader && (
        <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="flex-1 h-4" />
          ))}
        </div>
      )}
      <div className="divide-y divide-zinc-800">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="px-4 py-3 flex gap-4">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton
                key={colIdx}
                className={cn(
                  "flex-1 h-4",
                  colIdx % 3 === 0 && "max-w-[80%]",
                  colIdx % 3 === 1 && "max-w-[60%]",
                  colIdx % 3 === 2 && "max-w-[70%]"
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Stats Grid Skeleton
export function StatsGridSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 bg-black/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton variant="circle" width="32px" height="32px" />
          </div>
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

// List Skeleton
export function ListSkeleton({ items = 5, showAvatar = false, className }: { 
  items?: number; 
  showAvatar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800">
          {showAvatar && <Skeleton variant="circle" width="40px" height="40px" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

// Stale Data Indicator
interface StaleDataIndicatorProps {
  lastUpdated: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function StaleDataIndicator({ 
  lastUpdated, 
  onRefresh, 
  isRefreshing = false,
  className 
}: StaleDataIndicatorProps) {
  const timeAgo = new Date(lastUpdated).toLocaleString();
  const isStale = typeof window !== 'undefined' && Date.now() - new Date(lastUpdated).getTime() > 5 * 60 * 1000; // 5 minutes

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs",
      isStale 
        ? "bg-amber-950/30 border-amber-800/50 text-amber-400" 
        : "bg-zinc-900/50 border-zinc-800 text-zinc-400",
      className
    )}>
      <div className={cn(
        "w-2 h-2 rounded-full",
        isStale ? "bg-amber-400" : "bg-emerald-400"
      )} />
      <span>
        {isStale ? "Data may be stale" : "Data fresh"} • {timeAgo}
      </span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="ml-auto p-1 rounded hover:bg-zinc-800/50 transition-colors"
          aria-label="Refresh data"
        >
          {isRefreshing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
        </button>
      )}
    </div>
  );
}

// Smart Loading Container
interface SmartLoadingContainerProps {
  isLoading: boolean;
  error?: Error | null;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  className?: string;
}

export function SmartLoadingContainer({
  isLoading,
  error,
  children,
  fallback,
  errorFallback,
  className,
}: SmartLoadingContainerProps) {
  if (error) {
    return errorFallback || (
      <div className={cn("p-8 text-center", className)}>
        <div className="text-red-400 mb-2">Failed to load</div>
        <div className="text-sm text-zinc-500">{error.message}</div>
      </div>
    );
  }

  if (isLoading) {
    return fallback || <SectionLoader message="Loading..." className={className} />;
  }

  return <div className={className}>{children}</div>;
}

// Import SectionLoader for consistency
import { SectionLoader } from "../loaders/section-loader";
