"use client";

import { Button } from "@/components/ui/button";
import { useGitHub } from "@/context/github-context";
import { checkApiHealth } from "@/lib/api";
import { AlertCircle, Github, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

type ConnectionStatus = "connected" | "degraded" | "disconnected" | "checking";

export function ConnectionStatusBar() {
  const [apiStatus, setApiStatus] = useState<ConnectionStatus>("checking");
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    connected: githubConnected,
    loading: githubLoading,
    user: githubUser,
    sync: syncGitHub,
    syncing: githubSyncing,
  } = useGitHub();

  const checkStatus = async () => {
    const start = Date.now();
    const isHealthy = await checkApiHealth();
    const latency = Date.now() - start;

    setApiLatency(latency);

    if (!isHealthy) {
      setApiStatus("disconnected");
    } else if (latency > 1000) {
      setApiStatus("degraded");
    } else {
      setApiStatus("connected");
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkStatus();
    if (githubConnected) {
      await syncGitHub();
    }
    setIsRefreshing(false);
  };

  // Don't show if everything is fine
  if (apiStatus === "connected" && !githubLoading) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-card/80 border-b text-sm">
      <div className="flex items-center gap-4">
        {/* API Status */}
        <div className="flex items-center gap-2">
          {apiStatus === "checking" ? (
            <Wifi className="h-4 w-4 text-muted-foreground animate-pulse" />
          ) : apiStatus === "connected" ? (
            <Wifi className="h-4 w-4 text-success" />
          ) : apiStatus === "degraded" ? (
            <AlertCircle className="h-4 w-4 text-warning" />
          ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
          <span
            className={
              apiStatus === "connected"
                ? "text-success"
                : apiStatus === "degraded"
                  ? "text-warning"
                  : apiStatus === "disconnected"
                    ? "text-destructive"
                    : "text-muted-foreground"
            }
          >
            {apiStatus === "checking"
              ? "Checking API..."
              : apiStatus === "connected"
                ? `API Online${apiLatency ? ` (${apiLatency}ms)` : ""}`
                : apiStatus === "degraded"
                  ? `API Slow (${apiLatency}ms)`
                  : "API Offline"}
          </span>
        </div>

        {/* GitHub Status */}
        <div className="flex items-center gap-2 border-l pl-4">
          <Github
            className={`h-4 w-4 ${
              githubLoading
                ? "text-muted-foreground animate-pulse"
                : githubConnected
                  ? "text-success"
                  : "text-muted-foreground/70"
            }`}
          />
          <span
            className={
              githubLoading
                ? "text-muted-foreground"
                : githubConnected
                  ? "text-success"
                  : "text-muted-foreground/70"
            }
          >
            {githubLoading
              ? "Checking GitHub..."
              : githubConnected
                ? `@${githubUser?.login || "connected"}`
                : "GitHub not connected"}
          </span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={isRefreshing || githubSyncing}
        className="text-muted-foreground hover:text-foreground h-7 px-2"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 mr-1 ${
            isRefreshing || githubSyncing ? "animate-spin" : ""
          }`}
        />
        Refresh
      </Button>
    </div>
  );
}

export default ConnectionStatusBar;
