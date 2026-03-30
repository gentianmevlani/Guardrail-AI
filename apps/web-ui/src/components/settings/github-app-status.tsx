"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, Clock, GitBranch, Globe, Lock, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface GitHubAppInstallation {
  id: string;
  installationId: string;
  accountLogin: string;
  accountType: string;
  repositorySelection: string;
  repositoriesCount: number;
  repositories: Array<{
    id: string;
    fullName: string;
    name: string;
    isPrivate: boolean;
    defaultBranch: string;
    lastScanAt: string | null;
  }>;
  lastWebhookAt: string | null;
  createdAt: string;
}

interface GitHubAppStatusData {
  installations: GitHubAppInstallation[];
}

export function GitHubAppStatus() {
  const [data, setData] = useState<GitHubAppStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGitHubAppStatus();
  }, []);

  const fetchGitHubAppStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/github/app/status`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch GitHub App status");
      }

      const result = await res.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card border-border glass-card">
        <CardHeader>
          <CardTitle className="text-foreground">GitHub App Status</CardTitle>
          <CardDescription className="text-muted-foreground">
            Loading...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card border-border glass-card">
        <CardHeader>
          <CardTitle className="text-foreground">GitHub App Status</CardTitle>
          <CardDescription className="text-muted-foreground">
            {error}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data || data.installations.length === 0) {
    return (
      <Card className="bg-card border-border glass-card">
        <CardHeader>
          <CardTitle className="text-foreground">GitHub App Status</CardTitle>
          <CardDescription className="text-muted-foreground">
            No GitHub App installations found. Install the guardrail GitHub App to enable
            automatic security scans on pull requests.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border glass-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-teal-400" />
          GitHub App Status
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Connected organizations and repositories with last webhook activity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.installations.map((installation) => (
          <div
            key={installation.id}
            className="border border-border rounded-lg p-4 bg-muted/30 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground">
                    {installation.accountLogin}
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {installation.accountType}
                  </Badge>
                  <Badge
                    variant={
                      installation.repositorySelection === "all"
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {installation.repositorySelection === "all"
                      ? "All Repos"
                      : "Selected"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {installation.repositoriesCount} repositories
                  </span>
                  {installation.lastWebhookAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last webhook:{" "}
                      {new Date(installation.lastWebhookAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              {installation.lastWebhookAt ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-yellow-500" />
              )}
            </div>

            {installation.repositories.length > 0 && (
              <div className="mt-3 space-y-2">
                <h5 className="text-sm font-medium text-foreground/80">
                  Repositories:
                </h5>
                <div className="space-y-1">
                  {installation.repositories.slice(0, 5).map((repo) => (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between text-sm py-1 px-2 rounded bg-background/50"
                    >
                      <div className="flex items-center gap-2">
                        {repo.isPrivate ? (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <Globe className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="text-foreground">{repo.fullName}</span>
                        <Badge variant="outline" className="text-xs">
                          {repo.defaultBranch}
                        </Badge>
                      </div>
                      {repo.lastScanAt && (
                        <span className="text-xs text-muted-foreground">
                          Scanned: {new Date(repo.lastScanAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                  {installation.repositories.length > 5 && (
                    <div className="text-xs text-muted-foreground px-2">
                      +{installation.repositories.length - 5} more repositories
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
