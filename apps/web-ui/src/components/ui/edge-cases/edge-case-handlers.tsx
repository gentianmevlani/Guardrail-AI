"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, Eye, EyeOff, MoreHorizontal, RefreshCw } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";

// Text Truncation with "Show More"
interface TruncatedTextProps {
  text: string;
  maxLength?: number;
  className?: string;
  showTooltip?: boolean;
}

export function TruncatedText({
  text,
  maxLength = 100,
  className,
  showTooltip = true
}: TruncatedTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = text.length > maxLength;

  if (!shouldTruncate) {
    return <span className={className}>{text}</span>;
  }

  const truncated = isExpanded ? text : text.slice(0, maxLength) + "...";

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span>{truncated}</span>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-blue-400 hover:text-blue-300 text-sm underline"
      >
        {isExpanded ? "Show less" : "Show more"}
      </button>
    </span>
  );
}

// Number Abbreviation (1.2M, 3.4K, etc.)
interface AbbreviatedNumberProps {
  number: number;
  precision?: number;
  className?: string;
}

export function AbbreviatedNumber({
  number,
  precision = 1,
  className
}: AbbreviatedNumberProps) {
  const formatNumber = (num: number): string => {
    if (num < 1000) return num.toString();
    if (num < 1000000) return (num / 1000).toFixed(precision) + "K";
    if (num < 1000000000) return (num / 1000000).toFixed(precision) + "M";
    if (num < 1000000000000) return (num / 1000000000).toFixed(precision) + "B";
    return (num / 1000000000000).toFixed(precision) + "T";
  };

  return <span className={className}>{formatNumber(number)}</span>;
}

// Safe Data Display (handles null/undefined)
interface SafeDataProps {
  data: any;
  fallback?: string;
  className?: string;
}

export function SafeData({
  data,
  fallback = "—",
  className
}: SafeDataProps) {
  if (data === null || data === undefined) {
    return <span className={cn("text-zinc-500 italic", className)}>{fallback}</span>;
  }

  if (typeof data === "string" && data.trim() === "") {
    return <span className={cn("text-zinc-500 italic", className)}>{fallback}</span>;
  }

  return <span className={className}>{String(data)}</span>;
}

// Special Character Handler
interface SafeTextProps {
  text: string;
  maxLength?: number;
  escapeHtml?: boolean;
  className?: string;
}

export function SafeText({
  text,
  maxLength,
  escapeHtml = true,
  className
}: SafeTextProps) {
  const processText = (input: string): string => {
    let processed = input;
    
    // Escape HTML if needed
    if (escapeHtml) {
      processed = processed
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
    }
    
    // Handle special characters
    processed = processed
      .replace(/\u2013/g, "-") // en dash
      .replace(/\u2014/g, "--") // em dash
      .replace(/\u2018/g, "'") // left single quote
      .replace(/\u2019/g, "'") // right single quote
      .replace(/\u201C/g, '"') // left double quote
      .replace(/\u201D/g, '"') // right double quote
      .replace(/\u2026/g, "...") // horizontal ellipsis
      .replace(/\u00A0/g, " "); // non-breaking space
    
    return processed;
  };

  const processedText = processText(text);
  
  if (maxLength && processedText.length > maxLength) {
    return (
      <TruncatedText
        text={processedText}
        maxLength={maxLength}
        className={className}
      />
    );
  }

  return <span className={className}>{processedText}</span>;
}

// Concurrent Update Handler
interface ConcurrentUpdateProps {
  value: any;
  onUpdate: (newValue: any) => Promise<void>;
  className?: string;
}

export function ConcurrentUpdate({
  value,
  onUpdate,
  className
}: ConcurrentUpdateProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setLocalValue(value);
    setHasConflict(false);
  }, [value]);

  const handleUpdate = async (newValue: any) => {
    setLocalValue(newValue);
    setHasConflict(false);
    
    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // Set new timeout for debounced update
    updateTimeoutRef.current = setTimeout(async () => {
      setIsUpdating(true);
      try {
        await onUpdate(newValue);
        setHasConflict(false);
      } catch (error) {
        logger.error("Update failed", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          component: 'ConcurrentUpdate'
        });
        setHasConflict(true);
      } finally {
        setIsUpdating(false);
      }
    }, 500);
  };

  return (
    <div className={cn("relative", className)}>
      <div className={cn(
        "transition-colors",
        hasConflict && "bg-red-950/30 border-red-800/50",
        isUpdating && "opacity-70"
      )}>
        {/* Your input component here */}
        <input
          type="text"
          value={localValue}
          onChange={(e) => handleUpdate(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      
      {hasConflict && (
        <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-red-950/90 border border-red-800/50 rounded-lg text-xs text-red-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3 h-3" />
            Update conflict detected
          </div>
        </div>
      )}
      
      {isUpdating && (
        <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-blue-950/90 border border-blue-800/50 rounded-lg text-xs text-blue-400">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Updating...
          </div>
        </div>
      )}
    </div>
  );
}

// Offline Mode Detector
export function OfflineModeDetector({
  onOnlineChange,
  onOfflineChange,
  className
}: {
  onOnlineChange?: (isOnline: boolean) => void;
  onOfflineChange?: (isOnline: boolean) => void;
  className?: string;
}) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      onOnlineChange?.(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      onOfflineChange?.(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [onOnlineChange, onOfflineChange]);

  if (isOnline) {
    return null;
  }

  return (
    <div className={cn(
      "fixed top-4 left-4 right-4 bg-amber-950/90 border border-amber-800/50 rounded-lg p-4 z-50",
      className
    )}>
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        <div>
          <div className="text-amber-400 font-medium">You're offline</div>
          <div className="text-amber-300 text-sm">
            Some features may not be available until you reconnect.
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// Error Boundary with Fallback
interface EdgeCaseErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class EdgeCaseErrorBoundary extends React.Component<
  React.PropsWithChildren<{
    fallback?: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  }>,
  EdgeCaseErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): EdgeCaseErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("Edge case error caught", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      component: 'EdgeCaseErrorBoundary'
    });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-zinc-400 mb-4">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              Refresh Page
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Long Text Handler with Read More
interface LongTextProps {
  text: string;
  maxLines?: number;
  className?: string;
}

export function LongText({ text, maxLines = 3, className }: LongTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (textRef.current) {
      const element = textRef.current;
      const isOverflowing = element.scrollHeight > element.clientHeight;
      setIsOverflowing(isOverflowing);
    }
  }, [text]);

  return (
    <div className={className}>
      <div
        ref={textRef}
        className={cn(
          "text-zinc-300",
          !isExpanded && {
            display: "-webkit-box",
            WebkitLineClamp: maxLines,
            WebkitBoxOrient: "vertical",
            overflow: "hidden"
          }
        )}
      >
        {text}
      </div>
      {isOverflowing && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-400 hover:text-blue-300 text-sm underline mt-2"
        >
          {isExpanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

// Sensitive Data Mask
interface SensitiveDataProps {
  data: string;
  type?: "email" | "phone" | "credit-card" | "ssn" | "custom";
  maskChar?: string;
  showOriginal?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function SensitiveData({
  data,
  type = "custom",
  maskChar = "*",
  showOriginal = false,
  onToggle,
  className
}: SensitiveDataProps) {
  const [isVisible, setIsVisible] = useState(showOriginal);

  const maskData = (input: string, dataType: string): string => {
    if (dataType === "email") {
      const [username, domain] = input.split("@");
      const maskedUsername = username.slice(0, 2) + maskChar.repeat(Math.max(0, username.length - 2));
      return `${maskedUsername}@${domain}`;
    }

    if (dataType === "phone") {
      return input.slice(0, -4) + maskChar.repeat(4);
    }

    if (dataType === "credit-card") {
      const cleaned = input.replace(/\D/g, "");
      if (cleaned.length >= 4) {
        return cleaned.slice(0, 4) + maskChar.repeat(cleaned.length - 8) + cleaned.slice(-4);
      }
      return maskChar.repeat(cleaned.length);
    }

    if (dataType === "ssn") {
      return input.slice(0, 3) + maskChar.repeat(6);
    }

    // Custom masking
    if (input.length > 8) {
      return input.slice(0, 3) + maskChar.repeat(input.length - 6) + input.slice(-3);
    }

    return input;
  };

  const handleToggle = () => {
    const newValue = !isVisible;
    setIsVisible(newValue);
    onToggle?.();
  };

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className="font-mono">
        {isVisible ? data : maskData(data, type)}
      </span>
      <button
        onClick={handleToggle}
        className="text-zinc-500 hover:text-zinc-300"
        aria-label={isVisible ? "Hide sensitive data" : "Show sensitive data"}
      >
        {isVisible ? (
          <EyeOff className="w-4 h-4" />
        ) : (
          <Eye className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

// Empty State Handler
interface EmptyStateHandlerProps {
  data: any[];
  children: React.ReactNode;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  className?: string;
}

export function EmptyStateHandler({
  data,
  children,
  emptyMessage = "No data available",
  emptyIcon,
  className
}: EmptyStateHandlerProps) {
  if (!data || data.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        {emptyIcon || <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center">
          <MoreHorizontal className="w-6 h-6 text-zinc-600" />
        </div>}
        <p className="text-zinc-400 mt-4">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Loading State Handler
interface LoadingStateHandlerProps {
  isLoading: boolean;
  loadingMessage?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export function LoadingStateHandler({
  isLoading,
  loadingMessage = "Loading...",
  children,
  fallback,
  className
}: LoadingStateHandlerProps) {
  if (isLoading) {
    return (
      fallback || (
        <div className={cn("flex items-center justify-center py-12", className)}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400">{loadingMessage}</p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}

// Combined Edge Case Handler
interface EdgeCaseHandlerProps {
  data?: any[];
  isLoading?: boolean;
  error?: Error | null;
  children: React.ReactNode;
  emptyMessage?: string;
  errorMessage?: string;
  loadingMessage?: string;
  className?: string;
}

export function EdgeCaseHandler({
  data,
  isLoading = false,
  error = null,
  children,
  emptyMessage,
  errorMessage = "Something went wrong",
  loadingMessage,
  className
}: EdgeCaseHandlerProps) {
  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-red-400 font-medium mb-2">Error</p>
        <p className="text-zinc-400 text-sm">{errorMessage}</p>
        <p className="text-zinc-500 text-xs mt-2">{error.message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center">
          <MoreHorizontal className="w-6 h-6 text-zinc-600" />
        </div>
        <p className="text-zinc-400 mt-4">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}
