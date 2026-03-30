/**
 * MCP Telemetry Logger
 * 
 * Logs every tool call:
 * - tool name
 * - latency
 * - blocked hallucination yes/no
 * - what it prevented (symbol/route/version/boundary)
 * - minimal anonymized metadata (no code)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface TelemetryEntry {
  timestamp: string;
  tool: string;
  latency: number;
  blockedHallucination: boolean;
  prevented?: {
    type: 'symbol' | 'route' | 'version' | 'boundary';
    value: string;
  };
  metadata?: Record<string, any>;
}

export class TelemetryLogger {
  private projectPath: string;
  private telemetryFile: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.telemetryFile = join(projectPath, '.guardrail', 'telemetry.json');
  }

  /**
   * Log tool call
   */
  async logToolCall(entry: TelemetryEntry): Promise<void> {
    // Ensure directory exists
    const telemetryDir = join(this.projectPath, '.guardrail');
    if (!existsSync(telemetryDir)) {
      mkdirSync(telemetryDir, { recursive: true });
    }

    // Load existing telemetry
    let telemetry: { toolCalls: TelemetryEntry[]; hallucinationsBlocked: number; symbolsVerified: number } = {
      toolCalls: [],
      hallucinationsBlocked: 0,
      symbolsVerified: 0,
    };

    if (existsSync(this.telemetryFile)) {
      try {
        telemetry = JSON.parse(readFileSync(this.telemetryFile, 'utf-8'));
      } catch {
        // Reset on error
      }
    }

    // Add new entry
    telemetry.toolCalls.push(entry);

    // Update counters
    if (entry.blockedHallucination) {
      telemetry.hallucinationsBlocked = (telemetry.hallucinationsBlocked || 0) + 1;
    }

    if (entry.prevented?.type === 'symbol') {
      telemetry.symbolsVerified = (telemetry.symbolsVerified || 0) + 1;
    }

    // Keep only last 1000 entries
    if (telemetry.toolCalls.length > 1000) {
      telemetry.toolCalls = telemetry.toolCalls.slice(-1000);
    }

    // Write back
    writeFileSync(this.telemetryFile, JSON.stringify(telemetry, null, 2));
  }

  /**
   * Get stats for last N hours
   */
  getStats(hours: number = 24): {
    totalCalls: number;
    hallucinationsBlocked: number;
    symbolsVerified: number;
    averageLatency: number;
  } {
    if (!existsSync(this.telemetryFile)) {
      return {
        totalCalls: 0,
        hallucinationsBlocked: 0,
        symbolsVerified: 0,
        averageLatency: 0,
      };
    }

    try {
      const telemetry = JSON.parse(readFileSync(this.telemetryFile, 'utf-8'));
      const cutoff = Date.now() - hours * 60 * 60 * 1000;

      const recentCalls = telemetry.toolCalls.filter((call: TelemetryEntry) =>
        new Date(call.timestamp).getTime() > cutoff
      );

      const latencies = recentCalls.map((c: TelemetryEntry) => c.latency || 0).filter((l: number) => l > 0);
      const averageLatency = latencies.length > 0
        ? latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length
        : 0;

      return {
        totalCalls: recentCalls.length,
        hallucinationsBlocked: recentCalls.filter((c: TelemetryEntry) => c.blockedHallucination).length,
        symbolsVerified: recentCalls.filter((c: TelemetryEntry) => c.prevented?.type === 'symbol').length,
        averageLatency,
      };
    } catch {
      return {
        totalCalls: 0,
        hallucinationsBlocked: 0,
        symbolsVerified: 0,
        averageLatency: 0,
      };
    }
  }
}
