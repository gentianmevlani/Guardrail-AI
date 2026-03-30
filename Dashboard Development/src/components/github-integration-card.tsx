import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Github, CheckCircle, AlertCircle } from "lucide-react";
import { useGitHub } from "@/context/github-context";

interface GitHubIntegrationCardProps {
  variant?: "default" | "minimal";
}

export function GitHubIntegrationCard({ variant = "default" }: GitHubIntegrationCardProps) {
  const { connected, connect, loading } = useGitHub();

  if (variant === "minimal") {
    return (
      <div className="flex items-center gap-2">
        {connected ? (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            GitHub Connected
          </Badge>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={connect}
            disabled={loading}
            className="border-zinc-700 hover:bg-zinc-800 text-zinc-400"
          >
            <Github className="w-4 h-4 mr-2" />
            Connect GitHub
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
      <div className={`p-2 rounded-lg ${connected ? "bg-emerald-500/20" : "bg-zinc-800"}`}>
        <Github className={`w-5 h-5 ${connected ? "text-emerald-400" : "text-zinc-500"}`} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">GitHub</span>
          {connected ? (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-yellow-400" />
          )}
        </div>
        <p className="text-xs text-zinc-500">
          {connected ? "Connected" : "Not connected"}
        </p>
      </div>
      {!connected && (
        <Button size="sm" onClick={connect} disabled={loading}>
          Connect
        </Button>
      )}
    </div>
  );
}
