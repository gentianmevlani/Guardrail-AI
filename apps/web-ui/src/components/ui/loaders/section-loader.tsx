"use client";

import { cn } from "@/lib/utils";

interface SectionLoaderProps {
  size?: "sm" | "md" | "lg";
  message?: string;
  className?: string;
}

/**
 * SectionLoader - Card/section level loading state
 * 
 * Usage:
 * <SectionLoader size="md" message="Loading data..." />
 */
export function SectionLoader({ 
  size = "md", 
  message, 
  className 
}: SectionLoaderProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8", 
    lg: "w-10 h-10"
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };

  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-8 rounded-lg border border-zinc-800/50 bg-zinc-900/50 min-h-[200px]",
        className
      )}
      role="status"
      aria-busy={true}
      aria-label={message || "Loading section"}
    >
      {/* Branded spinner */}
      <div className={cn("relative", sizeClasses[size])}>
        <div className={cn(
          "absolute inset-0 rounded-full border-2 border-zinc-800/30",
          sizeClasses[size]
        )} />
        <div className={cn(
          "absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin",
          sizeClasses[size]
        )} />
        <div className={cn(
          "absolute inset-1 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 animate-pulse",
          sizeClasses[size]
        )} />
      </div>
      
      {message && (
        <p className={cn(
          "text-zinc-400 font-medium animate-pulse text-center",
          textSizeClasses[size]
        )}>
          {message}
        </p>
      )}
    </div>
  );
}
