"use client";

import { cn } from "@/lib/utils";

interface CardSkeletonProps {
  showAvatar?: boolean;
  showTitle?: boolean;
  showSubtitle?: boolean;
  showActions?: boolean;
  lines?: number;
  className?: string;
}

/**
 * CardSkeleton - Card loading state with shimmer effect
 * 
 * Usage:
 * <CardSkeleton showAvatar showTitle lines={3} />
 */
export function CardSkeleton({ 
  showAvatar = false,
  showTitle = true,
  showSubtitle = false,
  showActions = false,
  lines = 2,
  className 
}: CardSkeletonProps) {
  return (
    <div 
      className={cn(
        "rounded-lg border border-zinc-800 bg-black/40 p-4",
        className
      )}
      role="status"
      aria-busy={true}
      aria-label="Loading card content"
    >
      {/* Header with avatar and actions */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {showAvatar && (
            <div className="w-10 h-10 rounded-full bg-zinc-800/50 animate-pulse" />
          )}
          <div className="space-y-2">
            {showTitle && (
              <div className="h-4 w-32 bg-zinc-800/50 rounded animate-pulse" />
            )}
            {showSubtitle && (
              <div className="h-3 w-24 bg-zinc-800/30 rounded animate-pulse" 
                   style={{ animationDelay: '0.1s' }} />
            )}
          </div>
        </div>
        {showActions && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded bg-zinc-800/50 animate-pulse" />
            <div className="w-8 h-8 rounded bg-zinc-800/50 animate-pulse" 
                 style={{ animationDelay: '0.1s' }} />
          </div>
        )}
      </div>
      
      {/* Content lines */}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 bg-zinc-800/30 rounded animate-pulse"
            style={{ 
              animationDelay: `${i * 0.1}s`,
              width: i === lines - 1 ? '75%' : '100%'
            }}
          />
        ))}
      </div>
      
      {/* Footer */}
      {showActions && (
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-zinc-800">
          <div className="h-3 w-20 bg-zinc-800/30 rounded animate-pulse" />
          <div className="h-8 w-20 bg-zinc-800/50 rounded animate-pulse" />
        </div>
      )}
    </div>
  );
}
