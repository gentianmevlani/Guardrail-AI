"use client";

import { cn } from "@/lib/utils";

interface PageLoaderProps {
  size?: "sm" | "md" | "lg";
  message?: string;
  className?: string;
}

/**
 * PageLoader - Full page branded loading state
 * 
 * Usage:
 * <PageLoader size="lg" message="Loading dashboard..." />
 */
export function PageLoader({ 
  size = "md", 
  message = "Loading...", 
  className 
}: PageLoaderProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12", 
    lg: "w-16 h-16"
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg"
  };

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/95 backdrop-blur-sm",
        className
      )}
      role="status"
      aria-busy={true}
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-4">
        {/* guardrail branded spinner */}
        <div className={cn("relative", sizeClasses[size])}>
          <div className={cn(
            "absolute inset-0 rounded-full border-2 border-zinc-800/50",
            sizeClasses[size]
          )} />
          <div className={cn(
            "absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin",
            sizeClasses[size]
          )} />
          {/* Inner glow */}
          <div className={cn(
            "absolute inset-1 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 animate-pulse",
            sizeClasses[size]
          )} />
        </div>
        
        {message && (
          <p className={cn(
            "text-zinc-400 font-medium animate-pulse",
            textSizeClasses[size]
          )}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
