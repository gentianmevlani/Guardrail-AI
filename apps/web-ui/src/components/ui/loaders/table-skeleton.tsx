"use client";

import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
  showHeader?: boolean;
}

/**
 * TableSkeleton - Table loading state with shimmer effect
 * 
 * Usage:
 * <TableSkeleton rows={5} columns={4} showHeader />
 */
export function TableSkeleton({ 
  rows = 5, 
  columns = 4, 
  className,
  showHeader = true 
}: TableSkeletonProps) {
  return (
    <div 
      className={cn(
        "rounded-lg border border-zinc-800 bg-black/40 overflow-hidden",
        className
      )}
      role="status"
      aria-busy={true}
      aria-label="Loading table data"
    >
      {/* Header */}
      {showHeader && (
        <div className="border-b border-zinc-800 p-4 flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div 
              key={`header-${i}`}
              className="h-4 flex-1 bg-zinc-800/50 rounded animate-pulse"
              style={{ 
                animationDelay: `${i * 0.1}s`,
                animationDuration: '1.5s'
              }}
            />
          ))}
        </div>
      )}
      
      {/* Rows */}
      <div className="divide-y divide-zinc-800">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div 
            key={`row-${rowIndex}`}
            className="p-4 flex gap-4"
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div 
                key={`cell-${rowIndex}-${colIndex}`}
                className="h-4 flex-1 bg-zinc-800/30 rounded animate-pulse"
                style={{ 
                  animationDelay: `${(rowIndex * columns + colIndex) * 0.05}s`,
                  animationDuration: '1.5s'
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
