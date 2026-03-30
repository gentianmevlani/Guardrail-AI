"use client";

import { cn } from "@/lib/utils";

interface InlineLoaderProps {
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "spinner" | "dots" | "pulse";
  className?: string;
  label?: string;
}

/**
 * InlineLoader - Small inline loading states for buttons/forms
 * 
 * Usage:
 * <InlineLoader size="sm" variant="spinner" />
 * <InlineLoader size="xs" variant="dots" label="Loading" />
 */
export function InlineLoader({ 
  size = "sm", 
  variant = "spinner",
  className,
  label
}: InlineLoaderProps) {
  const sizeClasses = {
    xs: "w-3 h-3",
    sm: "w-4 h-4", 
    md: "w-5 h-5",
    lg: "w-6 h-6"
  };

  const dotSizeClasses = {
    xs: "w-1 h-1",
    sm: "w-1.5 h-1.5", 
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5"
  };

  const renderSpinner = () => (
    <div className={cn("relative", sizeClasses[size])}>
      <div className={cn(
        "absolute inset-0 rounded-full border border-zinc-700/30",
        sizeClasses[size]
      )} />
      <div className={cn(
        "absolute inset-0 rounded-full border border-transparent border-t-blue-500 animate-spin",
        sizeClasses[size]
      )} />
    </div>
  );

  const renderDots = () => (
    <div className="flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "rounded-full bg-blue-500 animate-pulse",
            dotSizeClasses[size]
          )}
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );

  const renderPulse = () => (
    <div className={cn(
      "rounded bg-zinc-700/50 animate-pulse",
      sizeClasses[size]
    )} />
  );

  return (
    <div 
      className={cn("flex items-center gap-2", className)}
      role="status"
      aria-busy={true}
      aria-label={label || "Loading"}
    >
      {variant === "spinner" && renderSpinner()}
      {variant === "dots" && renderDots()}
      {variant === "pulse" && renderPulse()}
      
      {label && (
        <span className="text-zinc-400 text-sm animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
}
