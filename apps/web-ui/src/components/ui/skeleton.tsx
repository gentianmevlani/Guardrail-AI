/**
 * Enhanced Skeleton Loader Components
 * Beautiful loading states with smooth animations for dashboard pages
 */

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// =============================================================================
// BASE SKELETON COMPONENT
// =============================================================================

/** DOM drag handlers conflict with Framer Motion's drag gesture types */
type DivHTMLWithoutDomDrag = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  | "onDrag"
  | "onDragEnd"
  | "onDragStart"
  | "onDragLeave"
  | "onDragOver"
  | "onDragEnter"
  | "onDrop"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
>;

interface SkeletonProps extends DivHTMLWithoutDomDrag {
  variant?: 'pulse' | 'shimmer' | 'wave';
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  animated?: boolean;
}

export function Skeleton({
  className,
  variant = 'shimmer',
  rounded = 'md',
  animated = true,
  ...props
}: SkeletonProps) {
  const roundedClasses = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  const baseClasses =
    'bg-gradient-to-r from-charcoal-800 via-charcoal-700 to-charcoal-800 bg-[length:200%_100%]';

  if (variant === 'shimmer' && animated) {
    return (
      <motion.div
        className={cn(
          baseClasses,
          roundedClasses[rounded],
          'relative overflow-hidden',
          className
        )}
        {...props}
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-teal-500/10 to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </motion.div>
    );
  }

  if (variant === 'pulse' && animated) {
    return (
      <motion.div
        className={cn(baseClasses, roundedClasses[rounded], className)}
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        {...props}
      />
    );
  }

  if (variant === 'wave' && animated) {
    return (
      <div
        className={cn(
          baseClasses,
          roundedClasses[rounded],
          'animate-shimmer',
          className
        )}
        {...props}
      />
    );
  }

  return (
    <div
      className={cn(
        'animate-pulse bg-charcoal-800/50',
        roundedClasses[rounded],
        className
      )}
      {...props}
    />
  );
}

// =============================================================================
// SKELETON SHAPES
// =============================================================================

interface SkeletonCircleProps extends SkeletonProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function SkeletonCircle({
  size = 'md',
  className,
  ...props
}: SkeletonCircleProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <Skeleton
      className={cn(sizeClasses[size], className)}
      rounded="full"
      {...props}
    />
  );
}

interface SkeletonTextProps extends SkeletonProps {
  lines?: number;
  width?: 'full' | 'lg' | 'md' | 'sm';
  spacing?: 'tight' | 'normal' | 'loose';
}

export function SkeletonText({
  lines = 1,
  width = 'full',
  spacing = 'normal',
  className,
  ...props
}: SkeletonTextProps) {
  const widthClasses = {
    full: 'w-full',
    lg: 'w-3/4',
    md: 'w-1/2',
    sm: 'w-1/4',
  };

  const spacingClasses = {
    tight: 'space-y-1',
    normal: 'space-y-2',
    loose: 'space-y-3',
  };

  if (lines === 1) {
    return (
      <Skeleton
        className={cn('h-4', widthClasses[width], className)}
        {...props}
      />
    );
  }

  return (
    <div className={cn(spacingClasses[spacing], className)}>
      {Array.from({ length: lines }).map((_, i) => {
        const isLast = i === lines - 1;
        const lineWidth = isLast && lines > 1 ? 'w-2/3' : widthClasses[width];

        return <Skeleton key={i} className={cn('h-4', lineWidth)} {...props} />;
      })}
    </div>
  );
}

// =============================================================================
// CARD SKELETON
// =============================================================================

interface SkeletonCardProps {
  className?: string;
  showImage?: boolean;
  imageHeight?: string;
  lines?: number;
}

export function SkeletonCard({
  className,
  showImage = false,
  imageHeight = '200px',
  lines = 2,
}: SkeletonCardProps) {
  return (
    <motion.div
      className={cn(
        'rounded-lg border border-charcoal-700 bg-charcoal-800/50 overflow-hidden',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {showImage && (
        <Skeleton className="w-full" style={{ height: imageHeight }} rounded="none" />
      )}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>
        <Skeleton className="h-8 w-16 mb-2" />
        <SkeletonText lines={lines} spacing="tight" />
      </div>
    </motion.div>
  );
}

// =============================================================================
// TABLE SKELETON
// =============================================================================

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export function SkeletonTable({ rows = 5, columns = 5 }: SkeletonTableProps) {
  return (
    <div className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 overflow-hidden">
      {/* Header */}
      <div className="border-b border-charcoal-700 p-4 flex gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          className="border-b border-charcoal-700 last:border-0 p-4 flex gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
        >
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </motion.div>
      ))}
    </div>
  );
}

// =============================================================================
// STATS SKELETON
// =============================================================================

export function SkeletonStats() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.3 }}
        >
          <div className="flex items-start justify-between mb-4">
            <SkeletonText width="md" />
            <Skeleton className="h-10 w-10" rounded="lg" />
          </div>
          <Skeleton className="h-10 w-32 mb-2" />
          <SkeletonText width="sm" />
        </motion.div>
      ))}
    </div>
  );
}

// =============================================================================
// PAGE SKELETON
// =============================================================================

export function SkeletonPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32" />
      </motion.div>
      {/* Stats */}
      <SkeletonStats />
      {/* Table */}
      <SkeletonTable />
    </div>
  );
}

// =============================================================================
// CHART SKELETON
// =============================================================================

interface SkeletonChartProps {
  height?: string;
  type?: 'bar' | 'line' | 'pie';
}

export function SkeletonChart({
  height = '300px',
  type = 'bar',
}: SkeletonChartProps) {
  return (
    <motion.div
      className="rounded-lg border border-charcoal-700 bg-charcoal-800/50 p-6"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-between items-center mb-6">
        <SkeletonText width="md" />
        <Skeleton className="h-8 w-24" />
      </div>

      {type === 'bar' && (
        <div
          className="flex items-end justify-between gap-4"
          style={{ height }}
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <motion.div
              key={i}
              className="flex-1"
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height: `${Math.random() * 60 + 40}%`,
                opacity: 1,
              }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <Skeleton className="w-full h-full" />
            </motion.div>
          ))}
        </div>
      )}

      {type === 'line' && (
        <div className="relative" style={{ height }}>
          <Skeleton className="w-full h-full" />
        </div>
      )}

      {type === 'pie' && (
        <div className="flex items-center justify-center" style={{ height }}>
          <SkeletonCircle size="xl" className="w-48 h-48" />
        </div>
      )}

      <div className="flex gap-4 mt-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-sm" />
            <SkeletonText width="sm" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// =============================================================================
// LIST ITEM SKELETON
// =============================================================================

interface SkeletonListItemProps {
  showAvatar?: boolean;
  showIcon?: boolean;
}

export function SkeletonListItem({
  showAvatar = true,
  showIcon = false,
}: SkeletonListItemProps) {
  return (
    <motion.div
      className="flex items-center gap-4 p-4"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {showAvatar && <SkeletonCircle size="md" />}
      {showIcon && <Skeleton className="h-5 w-5" />}
      <div className="flex-1 space-y-2">
        <SkeletonText width="lg" />
        <SkeletonText width="md" />
      </div>
      <Skeleton className="h-8 w-8" rounded="md" />
    </motion.div>
  );
}

// =============================================================================
// ACTIVITY FEED SKELETON
// =============================================================================

export function SkeletonActivity() {
  return (
    <motion.div
      className="flex gap-4 p-4 border-l-2 border-charcoal-700"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <SkeletonText width="md" />
          <SkeletonText width="sm" />
        </div>
        <SkeletonText lines={2} spacing="tight" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// DASHBOARD SPECIFIC SKELETONS
// =============================================================================

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Skeleton className="h-10 w-64 mb-2" />
        <SkeletonText width="lg" />
      </motion.div>

      <SkeletonStats />

      <div className="grid gap-6 md:grid-cols-2">
        <SkeletonChart type="bar" />
        <SkeletonChart type="line" />
      </div>

      <SkeletonTable rows={8} />
    </div>
  );
}
