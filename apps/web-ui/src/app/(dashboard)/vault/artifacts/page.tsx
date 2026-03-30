"use client";

/**
 * Receipt Vault - Artifacts Page
 * List of report artifacts
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  FileJson,
  ExternalLink,
  Download,
  Filter
} from "lucide-react";
import { logger } from "@/lib/logger";

interface Artifact {
  id: string;
  type: "html" | "json" | "sarif" | "video";
  name: string;
  path: string;
  timestamp: string;
  size: number;
  runId?: string;
}

export default function VaultArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArtifacts() {
      try {
        const res = await fetch("/api/guardrail/artifacts");
        setArtifacts(await res.json());
      } catch (e) {
        logger.logUnknownError("Failed to fetch artifacts", e);
      } finally {
        setLoading(false);
      }
    }
    fetchArtifacts();
  }, []);

  const filteredArtifacts = filter
    ? artifacts.filter((a) => a.type === filter)
    : artifacts;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Artifacts</h1>
          <p className="text-muted-foreground">Reports and evidence</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === null ? "default" : "outline"}
            onClick={() => setFilter(null)}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "html" ? "default" : "outline"}
            onClick={() => setFilter("html")}
          >
            HTML
          </Button>
          <Button
            size="sm"
            variant={filter === "json" ? "default" : "outline"}
            onClick={() => setFilter("json")}
          >
            JSON
          </Button>
        </div>
      </div>

      {filteredArtifacts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No artifacts yet. Run <code className="bg-muted px-1 rounded">guardrail ship</code> to create reports.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredArtifacts.map((artifact) => (
            <Card key={artifact.id} className="hover:bg-muted/50 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <ArtifactIcon type={artifact.type} />
                    <div>
                      <p className="font-mono text-sm truncate max-w-[180px]">{artifact.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(artifact.timestamp)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatSize(artifact.size)}
                      </p>
                    </div>
                  </div>
                  <TypeBadge type={artifact.type} />
                </div>
                <div className="mt-3 flex gap-2">
                  {artifact.type === "html" && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={artifact.path} target="_blank">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" asChild>
                    <a href={artifact.path} download>
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ArtifactIcon({ type }: { type: string }) {
  if (type === "html") return <FileText className="h-8 w-8 text-blue-500" />;
  if (type === "json") return <FileJson className="h-8 w-8 text-yellow-500" />;
  return <FileText className="h-8 w-8 text-gray-500" />;
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    html: "bg-blue-500/10 text-blue-500",
    json: "bg-yellow-500/10 text-yellow-500",
    sarif: "bg-purple-500/10 text-purple-500",
  };
  return (
    <Badge className={colors[type] || "bg-gray-500/10 text-gray-500"}>
      {type.toUpperCase()}
    </Badge>
  );
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
