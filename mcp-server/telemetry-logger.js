/**
 * MCP Telemetry Logger
 *
 * Logs every MCP tool call with:
 * - Tool name
 * - Latency
 * - Whether it blocked a hallucination
 * - What it prevented (symbol/route/version/boundary)
 * - Minimal anonymized metadata
 *
 * Storage: .guardrail/telemetry.db (SQLite)
 * Retention: 90 days (configurable)
 *
 * @module telemetry-logger
 */

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Telemetry event structure
 * @typedef {Object} TelemetryEvent
 * @property {string} timestamp - ISO timestamp
 * @property {string} tool - Tool name (e.g., "symbols_exists")
 * @property {number} latency_ms - Execution time in ms
 * @property {boolean} blocked_hallucination - Whether this prevented a hallucination
 * @property {Object} prevented - What was prevented
 * @property {string} prevented.type - Type: symbol/route/version/boundary
 * @property {string} prevented.value - The incorrect value AI tried to use
 * @property {string} prevented.file - File location (if applicable)
 * @property {number} prevented.line - Line number (if applicable)
 * @property {Object} metadata - Anonymized metadata
 */

const TELEMETRY_DIR = ".guardrail";
const TELEMETRY_FILE = "telemetry.jsonl"; // JSON Lines format for simplicity

/**
 * Log an MCP tool invocation
 * @param {string} projectPath - Path to project root
 * @param {TelemetryEvent} event - Telemetry event
 */
export async function logTool Call(projectPath, event) {
  try {
    const telemetryPath = path.join(projectPath, TELEMETRY_DIR, TELEMETRY_FILE);
    const telemetryDir = path.dirname(telemetryPath);

    // Ensure directory exists
    try {
      await fs.access(telemetryDir);
    } catch {
      await fs.mkdir(telemetryDir, { recursive: true });
    }

    // Add timestamp if not present
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    // Append to JSONL file
    const line = JSON.stringify(event) + "\n";
    await fs.appendFile(telemetryPath, line, "utf-8");

    // Cleanup old entries (async, don't wait)
    cleanupOldEntries(telemetryPath).catch(() => {});
  } catch (error) {
    // Silent fail - don't break MCP server if telemetry fails
    console.error(`[Telemetry] Failed to log: ${error.message}`);
  }
}

/**
 * Log a tool call with timing
 * @param {string} projectPath - Project path
 * @param {string} toolName - MCP tool name
 * @param {Function} fn - Async function to execute
 * @returns {Promise<any>} - Result of fn
 */
export async function withTelemetry(projectPath, toolName, fn) {
  const startTime = Date.now();
  let blocked = false;
  let prevented = null;

  try {
    const result = await fn();

    // Check if result indicates a hallucination was blocked
    if (result && typeof result === "object") {
      if (result.verdict === "fail" || result.verdict === "index_required") {
        blocked = true;
        prevented = {
          type: result.preventedType || "unknown",
          value: result.preventedValue || "",
          file: result.file || "",
          line: result.line || 0,
        };
      }
    }

    const latency = Date.now() - startTime;

    await logToolCall(projectPath, {
      tool: toolName,
      latency_ms: latency,
      blocked_hallucination: blocked,
      prevented,
      metadata: {},
    });

    return result;
  } catch (error) {
    const latency = Date.now() - startTime;

    await logToolCall(projectPath, {
      tool: toolName,
      latency_ms: latency,
      blocked_hallucination: false,
      prevented: null,
      metadata: { error: error.message },
    });

    throw error;
  }
}

/**
 * Get telemetry stats for a time period
 * @param {string} projectPath - Project path
 * @param {number} hoursAgo - How many hours back to look
 * @returns {Promise<Object>} - Stats object
 */
export async function getTelemetryStats(projectPath, hoursAgo = 24) {
  try {
    const telemetryPath = path.join(projectPath, TELEMETRY_DIR, TELEMETRY_FILE);

    // Check if file exists
    try {
      await fs.access(telemetryPath);
    } catch {
      return {
        totalCalls: 0,
        hallucinationsBlocked: 0,
        toolCalls: {},
        avgLatency: 0,
        preventedByType: {},
      };
    }

    const content = await fs.readFile(telemetryPath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());

    const cutoff = Date.now() - hoursAgo * 60 * 60 * 1000;
    const events = [];

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        const eventTime = new Date(event.timestamp).getTime();

        if (eventTime >= cutoff) {
          events.push(event);
        }
      } catch {
        // Skip invalid lines
      }
    }

    // Calculate stats
    const stats = {
      totalCalls: events.length,
      hallucinationsBlocked: events.filter(e => e.blocked_hallucination).length,
      toolCalls: {},
      avgLatency: 0,
      preventedByType: {},
      latencyPercentiles: { p50: 0, p95: 0, p99: 0 },
    };

    // Tool call counts
    for (const event of events) {
      stats.toolCalls[event.tool] = (stats.toolCalls[event.tool] || 0) + 1;
    }

    // Average latency
    if (events.length > 0) {
      const totalLatency = events.reduce((sum, e) => sum + (e.latency_ms || 0), 0);
      stats.avgLatency = Math.round(totalLatency / events.length);

      // Latency percentiles
      const latencies = events.map(e => e.latency_ms || 0).sort((a, b) => a - b);
      stats.latencyPercentiles.p50 = latencies[Math.floor(latencies.length * 0.5)];
      stats.latencyPercentiles.p95 = latencies[Math.floor(latencies.length * 0.95)];
      stats.latencyPercentiles.p99 = latencies[Math.floor(latencies.length * 0.99)];
    }

    // Prevented by type
    for (const event of events) {
      if (event.blocked_hallucination && event.prevented) {
        const type = event.prevented.type;
        stats.preventedByType[type] = (stats.preventedByType[type] || 0) + 1;
      }
    }

    return stats;
  } catch (error) {
    console.error(`[Telemetry] Failed to get stats: ${error.message}`);
    return {
      totalCalls: 0,
      hallucinationsBlocked: 0,
      toolCalls: {},
      avgLatency: 0,
      preventedByType: {},
    };
  }
}

/**
 * Get detailed prevented hallucinations (for "Saved Moments" feed)
 * @param {string} projectPath - Project path
 * @param {number} limit - Max number to return
 * @returns {Promise<Array>} - Array of prevented events
 */
export async function getPreventedHallucinations(projectPath, limit = 50) {
  try {
    const telemetryPath = path.join(projectPath, TELEMETRY_DIR, TELEMETRY_FILE);

    try {
      await fs.access(telemetryPath);
    } catch {
      return [];
    }

    const content = await fs.readFile(telemetryPath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());

    const prevented = [];

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.blocked_hallucination && event.prevented) {
          prevented.push({
            timestamp: event.timestamp,
            tool: event.tool,
            type: event.prevented.type,
            value: event.prevented.value,
            file: event.prevented.file,
            line: event.prevented.line,
          });
        }
      } catch {
        // Skip invalid lines
      }
    }

    // Return most recent
    return prevented.reverse().slice(0, limit);
  } catch (error) {
    console.error(`[Telemetry] Failed to get prevented: ${error.message}`);
    return [];
  }
}

/**
 * Get telemetry trend (compare current period to previous)
 * @param {string} projectPath - Project path
 * @param {number} hours - Period length in hours
 * @returns {Promise<Object>} - Trend object with current/previous/change
 */
export async function getTelemetryTrend(projectPath, hours = 24) {
  try {
    const current = await getTelemetryStats(projectPath, hours);
    const previous = await getTelemetryStatsPeriod(projectPath, hours * 2, hours);

    const change = {
      totalCalls: calculateChange(previous.totalCalls, current.totalCalls),
      hallucinationsBlocked: calculateChange(previous.hallucinationsBlocked, current.hallucinationsBlocked),
      avgLatency: calculateChange(previous.avgLatency, current.avgLatency),
    };

    return {
      current,
      previous,
      change,
    };
  } catch (error) {
    console.error(`[Telemetry] Failed to get trend: ${error.message}`);
    return null;
  }
}

/**
 * Get stats for a specific time period
 */
async function getTelemetryStatsPeriod(projectPath, hoursAgo, duration) {
  try {
    const telemetryPath = path.join(projectPath, TELEMETRY_DIR, TELEMETRY_FILE);

    try {
      await fs.access(telemetryPath);
    } catch {
      return { totalCalls: 0, hallucinationsBlocked: 0, avgLatency: 0 };
    }

    const content = await fs.readFile(telemetryPath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());

    const endTime = Date.now() - hoursAgo * 60 * 60 * 1000;
    const startTime = endTime - duration * 60 * 60 * 1000;
    const events = [];

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        const eventTime = new Date(event.timestamp).getTime();

        if (eventTime >= startTime && eventTime < endTime) {
          events.push(event);
        }
      } catch {
        // Skip
      }
    }

    const stats = {
      totalCalls: events.length,
      hallucinationsBlocked: events.filter(e => e.blocked_hallucination).length,
      avgLatency: 0,
    };

    if (events.length > 0) {
      const totalLatency = events.reduce((sum, e) => sum + (e.latency_ms || 0), 0);
      stats.avgLatency = Math.round(totalLatency / events.length);
    }

    return stats;
  } catch (error) {
    return { totalCalls: 0, hallucinationsBlocked: 0, avgLatency: 0 };
  }
}

/**
 * Calculate percentage change
 */
function calculateChange(oldVal, newVal) {
  if (oldVal === 0) return newVal > 0 ? 100 : 0;
  return Math.round(((newVal - oldVal) / oldVal) * 100);
}

/**
 * Cleanup entries older than retention period
 */
async function cleanupOldEntries(telemetryPath) {
  try {
    // Read config for retention days
    const configPath = path.join(path.dirname(telemetryPath), "telemetry.json");
    let retentionDays = 90;

    try {
      const config = JSON.parse(await fs.readFile(configPath, "utf-8"));
      retentionDays = config.retentionDays || 90;
    } catch {
      // Use default
    }

    const content = await fs.readFile(telemetryPath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());

    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const kept = [];

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        const eventTime = new Date(event.timestamp).getTime();

        if (eventTime >= cutoff) {
          kept.push(line);
        }
      } catch {
        // Keep if we can't parse (safer)
        kept.push(line);
      }
    }

    // Only rewrite if we removed something
    if (kept.length < lines.length) {
      await fs.writeFile(telemetryPath, kept.join("\n") + "\n", "utf-8");
    }
  } catch (error) {
    // Silent fail
  }
}

/**
 * Export all telemetry data (for debugging or analysis)
 * @param {string} projectPath - Project path
 * @returns {Promise<Array>} - All telemetry events
 */
export async function exportTelemetry(projectPath) {
  try {
    const telemetryPath = path.join(projectPath, TELEMETRY_DIR, TELEMETRY_FILE);
    const content = await fs.readFile(telemetryPath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());

    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(e => e !== null);
  } catch (error) {
    return [];
  }
}
