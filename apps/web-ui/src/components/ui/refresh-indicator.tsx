"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface RefreshIndicatorProps {
  lastUpdated?: Date;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function RefreshIndicator({
  lastUpdated,
  onRefresh,
  isRefreshing = false,
  className,
}: RefreshIndicatorProps) {
  const [timeAgo, setTimeAgo] = useState("");

  useEffect(() => {
    if (!lastUpdated) return;

    const updateTimeAgo = () => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);

      if (diff < 10) {
        setTimeAgo("just now");
      } else if (diff < 60) {
        setTimeAgo(`${diff}s ago`);
      } else if (diff < 3600) {
        setTimeAgo(`${Math.floor(diff / 60)}m ago`);
      } else {
        setTimeAgo(`${Math.floor(diff / 3600)}h ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 10000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  return (
    <div className={cn("flex items-center gap-2 text-xs text-zinc-500", className)}>
      <span>Updated {timeAgo || "—"}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1 rounded hover:bg-zinc-800 hover:text-zinc-300 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={cn("w-3 h-3", isRefreshing && "animate-spin")} />
        </button>
      )}
    </div>
  );
}
