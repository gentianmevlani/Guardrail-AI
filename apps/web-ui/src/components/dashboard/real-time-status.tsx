"use client";

import { useDashboardContext } from "@/context/dashboard-context";
import { cn } from "@/lib/utils";
import { AlertCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";

interface RealTimeStatusProps {
  className?: string;
  showLabel?: boolean;
}

export function RealTimeStatus({
  className,
  showLabel = false,
}: RealTimeStatusProps) {
  const { wsConnected, isLoading, error, lastUpdated, refresh } =
    useDashboardContext();
  const [showTooltip, setShowTooltip] = useState(false);

  const getStatusColor = () => {
    if (error) return "text-destructive";
    if (wsConnected) return "text-success";
    return "text-warning";
  };

  const getStatusText = () => {
    if (error) return "Connection error";
    if (wsConnected) return "Live";
    return "Connecting...";
  };

  const getLastUpdatedText = () => {
    if (!lastUpdated) return "Never";
    const date = new Date(lastUpdated);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) return "Just now";
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => refresh()}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors",
          "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-background",
          isLoading && "opacity-50 cursor-not-allowed",
          className,
        )}
        title={`${getStatusText()} - Last updated: ${getLastUpdatedText()}`}
        aria-label={`Connection status: ${getStatusText()}. Last updated: ${getLastUpdatedText()}. Click to refresh`}
        aria-live="polite"
      >
        {isLoading ? (
          <RefreshCw
            className="h-3 w-3 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : error ? (
          <AlertCircle
            className={cn("h-3 w-3", getStatusColor())}
            aria-hidden="true"
          />
        ) : wsConnected ? (
          <Wifi
            className={cn("h-3 w-3", getStatusColor())}
            aria-hidden="true"
          />
        ) : (
          <WifiOff
            className={cn("h-3 w-3", getStatusColor())}
            aria-hidden="true"
          />
        )}
        <span className="sr-only">
          {isLoading ? "Refreshing..." : getStatusText()}
        </span>

        {showLabel && (
          <span className={cn("font-medium", getStatusColor())}>
            {getStatusText()}
          </span>
        )}

        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full animate-pulse",
            wsConnected
              ? "bg-success"
              : error
                ? "bg-destructive"
                : "bg-warning",
          )}
        />
      </button>

      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 px-3 py-2 bg-popover border rounded-md shadow-md text-xs whitespace-nowrap">
          <p className="font-medium">{getStatusText()}</p>
          <p className="text-muted-foreground">
            Last updated: {getLastUpdatedText()}
          </p>
          <p className="text-muted-foreground text-[10px]">Click to refresh</p>
        </div>
      )}
    </div>
  );
}

export function ConnectionIndicator({ className }: { className?: string }) {
  const { wsConnected } = useDashboardContext();

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${wsConnected ? "Connected" : "Reconnecting"}`}
    >
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          wsConnected ? "bg-success" : "bg-warning",
          "animate-pulse",
        )}
        aria-hidden="true"
      />
      <span className="text-xs text-muted-foreground">
        {wsConnected ? "Connected" : "Reconnecting..."}
      </span>
    </div>
  );
}

export default RealTimeStatus;
