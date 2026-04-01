/**
 * Telemetry Ledger - Append-only event log for Context Mode
 * Tracks tool calls, hallucinations blocked, latency, etc.
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface TelemetryEvent {
  timestamp: string;
  tool: string;
  repoId: string;
  latencyMs: number;
  resultType: "hit" | "miss" | "blocked" | "error";
  category: "symbols" | "routes" | "versions" | "patterns" | "graph" | "security" | "verify" | "scope" | "architecture";
  queryHash?: string;
  blockedHallucination: boolean;
  suggestionAccepted?: boolean;
}

export interface StatsResult {
  period: string;
  totalCalls: number;
  symbolsVerified: number;
  hallucinationsBlocked: number;
  routesVerified: number;
  patternSuggestions: number;
  versionChecks: number;
  avgLatencyMs: number;
  topSavedMoments: SavedMoment[];
  byCategory: Record<string, number>;
  byTool: Record<string, number>;
}

export interface SavedMoment {
  timestamp: string;
  tool: string;
  category: string;
  description: string;
}

export class TelemetryLedger {
  private ledgerPath: string;
  private repoId: string;
  private buffer: TelemetryEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(repoPath: string) {
    const telemetryDir = path.join(repoPath, ".guardrail", "telemetry");
    if (!fs.existsSync(telemetryDir)) {
      fs.mkdirSync(telemetryDir, { recursive: true });
    }
    this.ledgerPath = path.join(telemetryDir, "context-events.ndjson");
    this.repoId = this.hashPath(repoPath);

    // Auto-flush every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  private hashPath(p: string): string {
    return crypto.createHash("sha256").update(p).digest("hex").slice(0, 16);
  }

  private hashQuery(query: string): string {
    return crypto.createHash("sha256").update(query).digest("hex").slice(0, 12);
  }

  log(
    tool: string,
    category: TelemetryEvent["category"],
    resultType: TelemetryEvent["resultType"],
    latencyMs: number,
    options: {
      query?: string;
      blockedHallucination?: boolean;
      suggestionAccepted?: boolean;
    } = {}
  ): void {
    const event: TelemetryEvent = {
      timestamp: new Date().toISOString(),
      tool,
      repoId: this.repoId,
      latencyMs: Math.round(latencyMs),
      resultType,
      category,
      queryHash: options.query ? this.hashQuery(options.query) : undefined,
      blockedHallucination: options.blockedHallucination || false,
      suggestionAccepted: options.suggestionAccepted,
    };
    this.buffer.push(event);

    // Flush immediately if buffer is large
    if (this.buffer.length >= 100) {
      this.flush();
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    const lines = this.buffer.map((e) => JSON.stringify(e)).join("\n") + "\n";
    fs.appendFileSync(this.ledgerPath, lines, "utf-8");
    this.buffer = [];
  }

  getStats(since?: string): StatsResult {
    const events = this.readEvents(since);

    const stats: StatsResult = {
      period: since || "all-time",
      totalCalls: events.length,
      symbolsVerified: 0,
      hallucinationsBlocked: 0,
      routesVerified: 0,
      patternSuggestions: 0,
      versionChecks: 0,
      avgLatencyMs: 0,
      topSavedMoments: [],
      byCategory: {},
      byTool: {},
    };

    if (events.length === 0) {
      return stats;
    }

    let totalLatency = 0;
    const savedMoments: SavedMoment[] = [];

    for (const event of events) {
      totalLatency += event.latencyMs;

      // Count by category
      stats.byCategory[event.category] = (stats.byCategory[event.category] || 0) + 1;

      // Count by tool
      stats.byTool[event.tool] = (stats.byTool[event.tool] || 0) + 1;

      // Specific counters
      if (event.category === "symbols" && event.resultType === "hit") {
        stats.symbolsVerified++;
      }
      if (event.category === "routes" && event.resultType === "hit") {
        stats.routesVerified++;
      }
      if (event.category === "patterns") {
        stats.patternSuggestions++;
      }
      if (event.category === "versions") {
        stats.versionChecks++;
      }
      if (event.blockedHallucination) {
        stats.hallucinationsBlocked++;
        savedMoments.push({
          timestamp: event.timestamp,
          tool: event.tool,
          category: event.category,
          description: this.describeSavedMoment(event),
        });
      }
    }

    stats.avgLatencyMs = Math.round(totalLatency / events.length);
    stats.topSavedMoments = savedMoments.slice(-10).reverse();

    return stats;
  }

  private describeSavedMoment(event: TelemetryEvent): string {
    switch (event.category) {
      case "symbols":
        return "Blocked usage of non-existent symbol";
      case "routes":
        return "Blocked usage of non-existent API route";
      case "versions":
        return "Blocked usage of uninstalled package";
      case "security":
        return "Blocked potential security issue";
      case "architecture":
        return "Blocked architecture boundary violation";
      default:
        return "Blocked potential hallucination";
    }
  }

  private readEvents(since?: string): TelemetryEvent[] {
    if (!fs.existsSync(this.ledgerPath)) {
      return [];
    }

    const content = fs.readFileSync(this.ledgerPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const events: TelemetryEvent[] = [];

    const sinceDate = since ? this.parseSince(since) : null;

    for (const line of lines) {
      try {
        const event = JSON.parse(line) as TelemetryEvent;
        if (sinceDate && new Date(event.timestamp) < sinceDate) {
          continue;
        }
        events.push(event);
      } catch {
        // Skip malformed lines
      }
    }

    return events;
  }

  private parseSince(since: string): Date {
    const now = new Date();
    const match = since.match(/^(\d+)(h|d|w|m)$/);
    if (!match) return new Date(0);

    const [, num, unit] = match;
    const n = parseInt(num, 10);

    switch (unit) {
      case "h":
        return new Date(now.getTime() - n * 60 * 60 * 1000);
      case "d":
        return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
      case "w":
        return new Date(now.getTime() - n * 7 * 24 * 60 * 60 * 1000);
      case "m":
        return new Date(now.getTime() - n * 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(0);
    }
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}
