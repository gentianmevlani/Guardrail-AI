"use client";

/**
 * Receipt Vault - Runs Page
 * List of ship runs with verdicts
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  ExternalLink,
  Download,
  Clock
} from "lucide-react";

interface ShipRun {
  id: string;
  timestamp: string;
  verdict: "GO" | "WARN" | "NO-GO";
  blockersCount: number;
  warningsCount: number;
  passedCount: number;
  reportPath?: string;
}

export default function VaultRunsPage() {
  const [runs, setRuns] = useState<ShipRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRuns() {
      try {
        const res = await fetch("/api/guardrail/runs");
        setRuns(await res.json());
      } catch (e) {
        logger.logUnknownError("Failed to fetch runs", e);
      } finally {
        setLoading(false);
      }
    }
    fetchRuns();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ship Runs</h1>
        <p className="text-muted-foreground">History of GO/WARN/NO-GO verdicts</p>
      </div>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No ship runs yet. Run <code className="bg-muted px-1 rounded">guardrail ship</code> to create one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <Card 
              key={run.id} 
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedRun === run.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setSelectedRun(selectedRun === run.id ? null : run.id)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <VerdictBadge verdict={run.verdict} />
                    <div>
                      <p className="font-mono text-sm">{run.id}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(run.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {run.blockersCount > 0 && (
                      <span className="text-red-500">{run.blockersCount} blockers</span>
                    )}
                    {run.warningsCount > 0 && (
                      <span className="text-yellow-500">{run.warningsCount} warnings</span>
                    )}
                    <span className="text-green-500">{run.passedCount} passed</span>
                  </div>
                </div>

                {selectedRun === run.id && (
                  <div className="mt-4 pt-4 border-t flex gap-2">
                    {run.reportPath && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/api/guardrail/artifacts/${run.reportPath}`} target="_blank">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Open Report
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <a href={`/api/guardrail/artifacts/${run.id}.json`} download>
                        <Download className="h-4 w-4 mr-1" />
                        Download JSON
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: "GO" | "WARN" | "NO-GO" }) {
  if (verdict === "GO") {
    return (
      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
        <CheckCircle className="h-3 w-3 mr-1" />
        GO
      </Badge>
    );
  }
  if (verdict === "WARN") {
    return (
      <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
        <AlertTriangle className="h-3 w-3 mr-1" />
        WARN
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
      <XCircle className="h-3 w-3 mr-1" />
      NO-GO
    </Badge>
  );
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}
