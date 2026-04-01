"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { InlineLoader, SectionLoader } from "@/components/ui/loaders";
import { useGitHub } from "@/context/github-context";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Github,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  Trash2,
  Unlock,
} from "lucide-react";
import { useState } from "react";

interface GitHubIntegrationCardProps {
  variant?: "full" | "compact" | "minimal";
  showRepos?: boolean;
  maxRepos?: number;
  onRepoSelect?: (repoFullName: string) => void;
  selectedRepo?: string | null;
}

export function GitHubIntegrationCard({
  variant = "full",
  showRepos = true,
  maxRepos = 5,
  onRepoSelect,
  selectedRepo,
}: GitHubIntegrationCardProps) {
  const {
    connected,
    loading,
    syncing,
    error,
    user,
    repositories,
    connect,
    disconnect,
    sync,
    clearError,
  } = useGitHub();

  const [disconnecting, setDisconnecting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect your GitHub account?")) {
      return;
    }
    setDisconnecting(true);
    await disconnect();
    setDisconnecting(false);
  };

  const handleSync = async () => {
    await sync();
  };

  const displayedRepos = expanded
    ? repositories
    : repositories.slice(0, maxRepos);
  const hasMoreRepos = repositories.length > maxRepos;

  // Minimal variant - just a status badge
  if (variant === "minimal") {
    return (
      <div className="flex items-center gap-2">
        {loading ? (
          <Badge variant="outline" className="border text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Checking...
          </Badge>
        ) : connected ? (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
            <Github className="h-3 w-3 mr-1" />@{user?.login}
          </Badge>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={connect}
            className="border text-foreground/80 hover:bg-muted"
            aria-label="Connect your GitHub account"
          >
            <Github className="h-3 w-3 mr-1" aria-hidden="true" />
            Connect GitHub
          </Button>
        )}
      </div>
    );
  }

  // Compact variant - inline status with quick actions
  if (variant === "compact") {
    return (
      <div className="flex items-center justify-between p-4 rounded-lg glass border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-full">
            <Github className="h-5 w-5 text-white" />
          </div>
          <div>
            {loading ? (
              <p className="text-muted-foreground">Checking connection...</p>
            ) : connected ? (
              <>
                <p className="font-medium text-white">@{user?.login}</p>
                <p className="text-sm text-muted-foreground">
                  {repositories.length} repositories
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">GitHub not connected</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
                className="text-muted-foreground hover:text-foreground"
                aria-label={
                  syncing ? "Syncing repositories..." : "Sync repositories"
                }
              >
                {syncing ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="sr-only">
                  {syncing ? "Syncing..." : "Sync"}
                </span>
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={connect}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              Connect
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Full variant - complete card with all details
  return (
    <Card className="dashboard-card glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="dashboard-card-title">
            <Github className="dashboard-card-title-icon text-white" />
            GitHub Integration
          </div>
          {connected && (
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              Connected
            </Badge>
          )}
        </div>
        <CardDescription className="text-muted-foreground">
          Connect your repositories to enable automated security scanning.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div
            className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm">{error}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="text-red-400 hover:text-red-300"
              aria-label="Dismiss error message"
            >
              Dismiss
            </Button>
          </div>
        )}

        {loading ? (
          <SectionLoader size="md" message="Checking GitHub connection..." />
        ) : connected ? (
          <div className="space-y-4">
            {/* Connected Account Info */}
            <div className="flex items-center justify-between p-4 rounded-lg glass border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-full">
                  <Github className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-white">@{user?.login}</p>
                  <p className="text-sm text-muted-foreground">
                    {repositories.length} repositories connected
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="border-border/50 hover:border-teal-500/30 transition-smooth"
                >
                  {syncing ? (
                    <>
                      <InlineLoader size="sm" variant="spinner" />
                      <span className="ml-2">Syncing...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  aria-label={
                    disconnecting
                      ? "Disconnecting GitHub..."
                      : "Disconnect GitHub account"
                  }
                >
                  {disconnecting ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="sr-only">
                    {disconnecting ? "Disconnecting..." : "Disconnect"}
                  </span>
                </Button>
              </div>
            </div>

            {/* Repository List */}
            {showRepos && repositories.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground/90">
                  Repositories
                </h3>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {displayedRepos.map((repo) => (
                    <div
                      key={repo.id}
                      onClick={() => onRepoSelect?.(repo.fullName)}
                      onKeyDown={(e) => {
                        if (
                          (e.key === "Enter" || e.key === " ") &&
                          onRepoSelect
                        ) {
                          e.preventDefault();
                          onRepoSelect(repo.fullName);
                        }
                      }}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-smooth ${
                        selectedRepo === repo.fullName
                          ? "bg-teal-500/10 border-teal-500/30 glow-teal-sm"
                          : "glass border-border/50 hover:border-teal-500/30"
                      } ${onRepoSelect ? "cursor-pointer focus-premium" : ""}`}
                      role={onRepoSelect ? "button" : undefined}
                      tabIndex={onRepoSelect ? 0 : undefined}
                      aria-label={
                        onRepoSelect
                          ? `Select repository ${repo.fullName}${repo.isPrivate ? " (private)" : " (public)"}${selectedRepo === repo.fullName ? ", currently selected" : ""}`
                          : undefined
                      }
                      aria-pressed={
                        onRepoSelect
                          ? selectedRepo === repo.fullName
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-muted rounded">
                          {repo.isPrivate ? (
                            <Lock className="h-3.5 w-3.5 text-amber-400" />
                          ) : (
                            <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">
                            {repo.fullName}
                          </p>
                          {repo.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-xs">
                              {repo.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {repo.language && (
                          <Badge
                            variant="outline"
                            className="border text-muted-foreground text-xs"
                          >
                            {repo.language}
                          </Badge>
                        )}
                        {repo.lastScan ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                            <Shield className="mr-1 h-3 w-3" />
                            Scanned
                          </Badge>
                        ) : null}
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded"
                          aria-label={`Open ${repo.fullName} on GitHub (opens in new tab)`}
                        >
                          <ExternalLink
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
                {hasMoreRepos && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(!expanded)}
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    {expanded ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-1" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Show {repositories.length - maxRepos} more
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4 py-8 border-2 border-dashed border-border rounded-lg">
            <div className="p-4 bg-card rounded-full">
              <Github className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-medium text-white">
                Connect to GitHub
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Grant guardrail access to your repositories to start protecting
                your code.
              </p>
            </div>
            <Button onClick={connect} className="btn-teal">
              <Github className="mr-2 h-4 w-4" />
              Connect GitHub Account
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default GitHubIntegrationCard;
