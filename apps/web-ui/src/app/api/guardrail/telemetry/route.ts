/**
 * API Route: Telemetry Stats
 * Reads from .guardrail/telemetry/context-events.ndjson
 */
import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get("period") || "24h";
  
  // Get repo path from env or use current working directory
  const repoPath = process.env.GUARDRAIL_REPO_PATH || process.cwd();
  const ledgerPath = path.join(repoPath, ".guardrail", "telemetry", "context-events.ndjson");

  if (!fs.existsSync(ledgerPath)) {
    return NextResponse.json({
      period,
      totalCalls: 0,
      hallucinationsBlocked: 0,
      symbolsVerified: 0,
      routesVerified: 0,
      patternsUsed: 0,
      versionChecks: 0,
      avgLatencyMs: 0,
      byTool: {},
      byCategory: {},
      savedMoments: [],
    });
  }

  try {
    const raw = fs.readFileSync(ledgerPath, "utf-8");
    const lines = raw.split("\n").filter(l => l.trim());
    
    const cutoff = getCutoff(period);
    const events = lines
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(e => e && new Date(e.timestamp).getTime() >= cutoff);

    // Calculate stats
    const stats = {
      period,
      totalCalls: events.length,
      hallucinationsBlocked: events.filter(e => e.blockedHallucination || e.resultType === "blocked").length,
      symbolsVerified: events.filter(e => e.category === "symbols").length,
      routesVerified: events.filter(e => e.category === "routes").length,
      patternsUsed: events.filter(e => e.category === "patterns").length,
      versionChecks: events.filter(e => e.category === "versions").length,
      avgLatencyMs: events.length > 0 
        ? Math.round(events.reduce((sum, e) => sum + (e.latencyMs || 0), 0) / events.length)
        : 0,
      byTool: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      savedMoments: events
        .filter(e => e.blockedHallucination || e.resultType === "blocked")
        .slice(-10)
        .map(e => ({
          timestamp: e.timestamp,
          tool: e.tool,
          category: e.category,
          description: getSavedMomentDescription(e),
        })),
    };

    // Count by tool and category
    for (const e of events) {
      stats.byTool[e.tool] = (stats.byTool[e.tool] || 0) + 1;
      stats.byCategory[e.category] = (stats.byCategory[e.category] || 0) + 1;
    }

    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getCutoff(period: string): number {
  const now = Date.now();
  switch (period) {
    case "1h": return now - 60 * 60 * 1000;
    case "24h": return now - 24 * 60 * 60 * 1000;
    case "7d": return now - 7 * 24 * 60 * 60 * 1000;
    case "30d": return now - 30 * 24 * 60 * 60 * 1000;
    default: return now - 24 * 60 * 60 * 1000;
  }
}

function getSavedMomentDescription(event: any): string {
  if (event.tool === "symbols_exists" && event.resultType === "blocked") {
    return `Blocked non-existent symbol`;
  }
  if (event.tool === "routes_exists" && event.resultType === "blocked") {
    return `Prevented hallucinated route`;
  }
  if (event.tool === "versions_allowed" && event.resultType === "blocked") {
    return `Blocked invalid package version`;
  }
  return `${event.tool} blocked hallucination`;
}
