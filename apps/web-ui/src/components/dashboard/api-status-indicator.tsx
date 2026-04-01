"use client";

import { checkApiHealth } from "@/lib/api";
import { AlertCircle, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

type ApiStatus = "connected" | "degraded" | "disconnected" | "checking";

export function ApiStatusIndicator() {
  const [status, setStatus] = useState<ApiStatus>("checking");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const start = Date.now();
      const isHealthy = await checkApiHealth();
      const responseTime = Date.now() - start;

      setLatency(responseTime);

      if (!isHealthy) {
        setStatus("disconnected");
      } else if (responseTime > 1000) {
        setStatus("degraded");
      } else {
        setStatus("connected");
      }
    };

    // Initial check
    checkStatus();

    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case "connected":
        return "text-green-500 bg-green-500/10 border-green-500/30";
      case "degraded":
        return "text-yellow-500 bg-yellow-500/10 border-yellow-500/30";
      case "disconnected":
        return "text-red-500 bg-red-500/10 border-red-500/30";
      default:
        return "text-muted-foreground bg-muted/10 border-border";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "connected":
        return <Wifi className="h-3.5 w-3.5" />;
      case "degraded":
        return <AlertCircle className="h-3.5 w-3.5" />;
      case "disconnected":
        return <WifiOff className="h-3.5 w-3.5" />;
      default:
        return <Wifi className="h-3.5 w-3.5 animate-pulse" />;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case "connected":
        return "Online";
      case "degraded":
        return "Slow";
      case "disconnected":
        return "Offline";
      default:
        return "...";
    }
  };

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border cursor-default transition-colors ${getStatusColor()}`}
      title={`API ${status}${latency ? ` (${latency}ms)` : ""}`}
      role="status"
      aria-live="polite"
      aria-label={`API status: ${getStatusLabel()}${latency ? `, response time ${latency} milliseconds` : ""}`}
    >
      <span aria-hidden="true">{getStatusIcon()}</span>
      <span className="hidden sm:inline font-medium">{getStatusLabel()}</span>
      <span className="sr-only">
        API {getStatusLabel()}
        {latency ? `, ${latency}ms latency` : ""}
      </span>
    </div>
  );
}

export default ApiStatusIndicator;
