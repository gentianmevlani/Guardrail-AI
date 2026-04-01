/**
 * guardrail stats - Value Visibility Dashboard
 *
 * Shows the value Guardrail provides by displaying:
 * - Hallucinations blocked
 * - Symbols verified
 * - Version lies blocked
 * - Patterns enforced
 * - Boundary violations prevented
 * - Security footguns flagged
 * - Latency metrics
 * - Trends
 *
 * @module runStats
 */

const fs = require("fs");
const path = require("path");

// ANSI colors
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};

function parseArgs(args) {
  const opts = {
    path: ".",
    period: "24h", // 24h, 7d, 30d
    json: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--path=")) opts.path = a.split("=")[1];
    if (a === "--path" || a === "-p") opts.path = args[++i];
    if (a.startsWith("--period=")) opts.period = a.split("=")[1];
    if (a === "--json") opts.json = true;
    if (a === "--verbose" || a === "-v") opts.verbose = true;
  }

  return opts;
}

async function runStats(args) {
  const opts = parseArgs(args);
  const projectPath = path.resolve(opts.path);

  // Parse period
  const hours = parsePeriod(opts.period);

  // Load telemetry data
  const stats = await loadTelemetryStats(projectPath, hours);

  if (opts.json) {
    console.log(JSON.stringify(stats, null, 2));
    return 0;
  }

  // Display stats
  displayStats(stats, opts);

  return 0;
}

function displayStats(stats, opts) {
  console.log(`\n${c.cyan}╔════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}║${c.reset}  🛡️  GUARDRAIL STATS - ${opts.period.toUpperCase()} Dashboard      ${c.cyan}║${c.reset}`);
  console.log(`${c.cyan}╚════════════════════════════════════════════════════════╝${c.reset}\n`);

  // Main Metrics
  console.log(`${c.cyan}══ VALUE DELIVERED ══${c.reset}\n`);

  // Hallucinations blocked (the hero metric)
  const hallucinationColor = stats.hallucinationsBlocked > 0 ? c.green : c.dim;
  const hallucinationTrend = getTrendArrow(stats.trends.hallucinationsBlocked);
  console.log(`  ${c.bold}🚫 Hallucinations Blocked:${c.reset} ${hallucinationColor}${stats.hallucinationsBlocked}${c.reset} ${hallucinationTrend}`);

  // Symbols verified
  const symbolsColor = stats.symbolsVerified > 0 ? c.green : c.dim;
  const symbolsTrend = getTrendArrow(stats.trends.symbolsVerified);
  console.log(`  ${c.bold}✓ Symbols Verified:${c.reset}        ${symbolsColor}${stats.symbolsVerified}${c.reset} ${symbolsTrend}`);

  // Version lies blocked
  const versionsColor = stats.versionLiesBlocked > 0 ? c.green : c.dim;
  const versionsTrend = getTrendArrow(stats.trends.versionLiesBlocked);
  console.log(`  ${c.bold}📦 Version Lies Blocked:${c.reset}   ${versionsColor}${stats.versionLiesBlocked}${c.reset} ${versionsTrend}`);

  // Patterns enforced
  const patternsColor = stats.patternsEnforced > 0 ? c.green : c.dim;
  const patternsTrend = getTrendArrow(stats.trends.patternsEnforced);
  console.log(`  ${c.bold}✨ Patterns Enforced:${c.reset}      ${patternsColor}${stats.patternsEnforced}${c.reset} ${patternsTrend}`);

  // Boundary violations
  const boundariesColor = stats.boundaryViolationsPrevented > 0 ? c.green : c.dim;
  const boundariesTrend = getTrendArrow(stats.trends.boundaryViolationsPrevented);
  console.log(`  ${c.bold}🚧 Boundaries Protected:${c.reset}   ${boundariesColor}${stats.boundaryViolationsPrevented}${c.reset} ${boundariesTrend}`);

  // Security footguns
  const securityColor = stats.securityFootgunsFlagged > 0 ? c.green : c.dim;
  const securityTrend = getTrendArrow(stats.trends.securityFootgunsFlagged);
  console.log(`  ${c.bold}🔒 Security Footguns:${c.reset}      ${securityColor}${stats.securityFootgunsFlagged}${c.reset} ${securityTrend}`);

  // Performance Metrics
  console.log(`\n${c.cyan}══ PERFORMANCE ══${c.reset}\n`);

  const latencyColor = stats.latency.p95 < 100 ? c.green : stats.latency.p95 < 200 ? c.yellow : c.red;
  console.log(`  ${c.bold}Latency (p95):${c.reset}   ${latencyColor}${stats.latency.p95}ms${c.reset}`);
  console.log(`  ${c.dim}   p50: ${stats.latency.p50}ms  |  p99: ${stats.latency.p99}ms${c.reset}`);

  console.log(`\n  ${c.bold}Total Tool Calls:${c.reset}  ${stats.totalCalls}`);
  console.log(`  ${c.bold}Avg Call Time:${c.reset}    ${stats.latency.avg}ms`);

  // Saved Moments (if verbose)
  if (opts.verbose && stats.savedMoments && stats.savedMoments.length > 0) {
    console.log(`\n${c.cyan}══ SAVED MOMENTS (Recent) ══${c.reset}\n`);

    const recentMoments = stats.savedMoments.slice(0, 5);
    for (const moment of recentMoments) {
      console.log(`  ${c.green}✓${c.reset} ${moment.type}: ${c.dim}${moment.value}${c.reset}`);
      if (moment.file) {
        console.log(`    ${c.dim}${moment.file}${moment.line ? `:${moment.line}` : ""}${c.reset}`);
      }
      console.log(`    ${c.dim}${formatTimeAgo(moment.timestamp)}${c.reset}\n`);
    }

    if (stats.savedMoments.length > 5) {
      console.log(`  ${c.dim}... and ${stats.savedMoments.length - 5} more${c.reset}\n`);
    }
  }

  // Top Tools Used
  if (opts.verbose && stats.topTools && stats.topTools.length > 0) {
    console.log(`${c.cyan}══ TOP TOOLS USED ══${c.reset}\n`);

    for (const tool of stats.topTools.slice(0, 5)) {
      const bar = createBar(tool.count, stats.topTools[0].count, 20);
      console.log(`  ${tool.name.padEnd(25)} ${bar} ${c.dim}${tool.count}${c.reset}`);
    }
    console.log();
  }

  // Context Mode Status
  console.log(`${c.cyan}══ CONTEXT MODE ══${c.reset}\n`);

  const contextStatus = stats.contextMode.active ? `${c.green}Active${c.reset}` : `${c.dim}Inactive${c.reset}`;
  console.log(`  Status: ${contextStatus}`);

  if (stats.contextMode.active) {
    console.log(`  ${c.dim}Uptime: ${formatDuration(stats.contextMode.uptime)}${c.reset}`);

    const freshness = stats.truthPack.fresh ? `${c.green}Fresh${c.reset}` : `${c.yellow}Stale${c.reset}`;
    console.log(`  Truth Pack: ${freshness} ${c.dim}(${formatTimeAgo(stats.truthPack.lastUpdate)})${c.reset}`);
  }

  // Next best action
  console.log(`\n${c.cyan}═══════════════════════════════════════════════════════${c.reset}\n`);
  console.log(`${c.cyan}Next best action:${c.reset}`);

  if (!stats.contextMode.active) {
    console.log(`  Run ${c.cyan}guardrail on${c.reset} to activate context mode and start tracking metrics`);
  } else if (stats.hallucinationsBlocked === 0) {
    console.log(`  ${c.dim}Keep coding! Guardrail is watching and protecting your codebase.${c.reset}`);
  } else {
    console.log(`  Great work! Review saved moments with ${c.cyan}guardrail stats --verbose${c.reset}`);
  }

  console.log();
}

async function loadTelemetryStats(projectPath, hours) {
  const telemetryPath = path.join(projectPath, ".guardrail", "telemetry.jsonl");
  const statePath = path.join(projectPath, ".guardrail", "state.json");

  // Default stats structure
  const stats = {
    period: `${hours}h`,
    hallucinationsBlocked: 0,
    symbolsVerified: 0,
    versionLiesBlocked: 0,
    patternsEnforced: 0,
    boundaryViolationsPrevented: 0,
    securityFootgunsFlagged: 0,
    latency: {
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    },
    totalCalls: 0,
    trends: {
      hallucinationsBlocked: 0,
      symbolsVerified: 0,
      versionLiesBlocked: 0,
      patternsEnforced: 0,
      boundaryViolationsPrevented: 0,
      securityFootgunsFlagged: 0,
    },
    savedMoments: [],
    topTools: [],
    contextMode: {
      active: false,
      uptime: 0,
    },
    truthPack: {
      fresh: false,
      lastUpdate: null,
    },
  };

  // Load telemetry file
  if (fs.existsSync(telemetryPath)) {
    try {
      const content = fs.readFileSync(telemetryPath, "utf-8");
      const lines = content.split("\n").filter(l => l.trim());

      const cutoff = Date.now() - hours * 60 * 60 * 1000;
      const events = [];
      const toolCounts = {};

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          const eventTime = new Date(event.timestamp).getTime();

          if (eventTime >= cutoff) {
            events.push(event);

            // Count tool usage
            toolCounts[event.tool] = (toolCounts[event.tool] || 0) + 1;

            // Count by type
            if (event.blocked_hallucination) {
              stats.hallucinationsBlocked++;

              if (event.prevented) {
                stats.savedMoments.push({
                  timestamp: event.timestamp,
                  type: event.prevented.type,
                  value: event.prevented.value,
                  file: event.prevented.file,
                  line: event.prevented.line,
                });

                // Categorize
                switch (event.prevented.type) {
                  case "symbol":
                    stats.symbolsVerified++;
                    break;
                  case "version":
                    stats.versionLiesBlocked++;
                    break;
                  case "pattern":
                    stats.patternsEnforced++;
                    break;
                  case "boundary":
                    stats.boundaryViolationsPrevented++;
                    break;
                  case "security":
                    stats.securityFootgunsFlagged++;
                    break;
                }
              }
            }
          }
        } catch (e) {
          // Skip invalid lines
        }
      }

      stats.totalCalls = events.length;

      // Calculate latency stats
      if (events.length > 0) {
        const latencies = events.map(e => e.latency_ms || 0).sort((a, b) => a - b);
        const totalLatency = latencies.reduce((sum, l) => sum + l, 0);

        stats.latency.avg = Math.round(totalLatency / latencies.length);
        stats.latency.p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
        stats.latency.p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
        stats.latency.p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
      }

      // Top tools
      stats.topTools = Object.entries(toolCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      // Calculate trends (simplified - compare to previous period)
      // TODO: Implement proper trend calculation
      stats.trends.hallucinationsBlocked = 0;
    } catch (error) {
      // Silent fail - return zeros
    }
  }

  // Load context mode state
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));

      stats.contextMode.active = state.contextMode === "active";

      if (state.startedAt) {
        const startTime = new Date(state.startedAt).getTime();
        stats.contextMode.uptime = Date.now() - startTime;
      }

      if (state.truthPack) {
        stats.truthPack.fresh = state.truthPack.fresh || false;
        stats.truthPack.lastUpdate = state.truthPack.lastUpdate;
      }
    } catch (e) {
      // Silent fail
    }
  }

  return stats;
}

function parsePeriod(period) {
  const match = period.match(/^(\d+)([hd])$/);
  if (!match) return 24; // default

  const value = parseInt(match[1]);
  const unit = match[2];

  if (unit === "h") return value;
  if (unit === "d") return value * 24;

  return 24;
}

function getTrendArrow(change) {
  if (change > 10) return `${c.green}↑${c.reset}`;
  if (change < -10) return `${c.red}↓${c.reset}`;
  return `${c.dim}→${c.reset}`;
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return "unknown";

  const ms = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function createBar(value, max, width) {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  return `${c.cyan}${"█".repeat(filled)}${c.dim}${"░".repeat(empty)}${c.reset}`;
}

module.exports = { runStats };
