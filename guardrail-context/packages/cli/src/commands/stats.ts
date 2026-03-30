/**
 * `guardrail stats` - Show Context Mode value metrics
 * THE VIRAL LOOP: Make this so satisfying people screenshot and share it
 */
import { TelemetryLedger, StatsResult } from "../telemetry/ledger.js";
import { brandHeader, bold, dim, success, warning, error, badge, link } from "../ui/brand.js";
import { panel, divider } from "../ui/box.js";
import { getCaps } from "../ui/terminal.js";

interface StatsOptions {
  since?: string;
  json?: boolean;
  details?: boolean;
}

export async function cmdStats(repoPath: string, opts: StatsOptions = {}): Promise<void> {
  const ledger = new TelemetryLedger(repoPath);
  const currentStats = ledger.getStats(opts.since || "24h");
  const previousStats = ledger.getStats(getPreviousPeriod(opts.since || "24h"));

  if (opts.json) {
    console.log(JSON.stringify({ current: currentStats, previous: previousStats }, null, 2));
    return;
  }

  printStatsReport(currentStats, previousStats, opts);
}

function getPreviousPeriod(period: string): string {
  if (period === "24h") return "48h";
  if (period === "7d") return "14d";
  if (period === "30d") return "60d";
  return "48h";
}

function trend(current: number, previous: number): string {
  const { unicode } = getCaps();
  const diff = current - Math.floor(previous / 2); // Compare to half of previous period
  
  if (diff > 0) {
    const arrow = unicode ? "▲" : "+";
    return success(`${arrow} +${diff}`);
  } else if (diff < 0) {
    const arrow = unicode ? "▼" : "-";
    return warning(`${arrow} ${diff}`);
  }
  return dim("—");
}

function printStatsReport(stats: StatsResult, prevStats: StatsResult, opts: StatsOptions): void {
  const { unicode } = getCaps();
  const shield = unicode ? "🧠" : "[GR]";
  
  console.log("");
  console.log(`${shield} ${bold("guardrail CONTEXT")} ${dim(`(${stats.period})`)}`);
  console.log(divider(50));

  if (stats.totalCalls === 0) {
    console.log("");
    console.log(warning("No tool calls recorded yet."));
    console.log(dim("Run 'guardrail on' to start Context Mode."));
    console.log("");
    return;
  }

  // THE BIG NUMBER - This is what people screenshot
  console.log("");
  if (stats.hallucinationsBlocked > 0) {
    const shieldIcon = unicode ? "🛡️" : "[!]";
    console.log(`  ${shieldIcon}  ${bold("Hallucinations blocked:")}    ${error(bold(stats.hallucinationsBlocked.toString().padStart(4)))}  ${trend(stats.hallucinationsBlocked, prevStats.hallucinationsBlocked)}`);
  } else {
    const checkIcon = unicode ? "✅" : "[OK]";
    console.log(`  ${checkIcon}  ${bold("Hallucinations blocked:")}    ${success("   0")}  ${dim("(AI is truthful!)")}`);
  }
  
  console.log("");
  
  // Core metrics with trends
  const metrics = [
    { label: "Symbols verified", value: stats.symbolsVerified, prev: prevStats.symbolsVerified, icon: unicode ? "🔍" : ">" },
    { label: "Routes validated", value: stats.routesVerified, prev: prevStats.routesVerified, icon: unicode ? "🛤️" : ">" },
    { label: "Version checks", value: stats.versionChecks, prev: prevStats.versionChecks, icon: unicode ? "📦" : ">" },
    { label: "Patterns suggested", value: stats.patternSuggestions, prev: prevStats.patternSuggestions, icon: unicode ? "📋" : ">" },
  ];

  for (const m of metrics) {
    const val = m.value.toString().padStart(4);
    console.log(`  ${m.icon}  ${m.label.padEnd(22)} ${bold(val)}  ${trend(m.value, m.prev)}`);
  }

  // Latency
  console.log("");
  const latencyIcon = unicode ? "⚡" : ">";
  console.log(`  ${latencyIcon}  ${"Avg latency".padEnd(22)} ${bold(stats.avgLatencyMs.toString() + "ms")}`);

  // TOP SAVED MOMENTS - This is the story that sells
  if (stats.topSavedMoments.length > 0) {
    console.log("");
    console.log(divider(50));
    console.log("");
    const targetIcon = unicode ? "🎯" : ">";
    console.log(`${targetIcon} ${bold("Top saved moments")} ${dim("(AI mistakes we caught)")}`);
    console.log("");
    
    for (const moment of stats.topSavedMoments.slice(0, 5)) {
      const bulletIcon = unicode ? "•" : "-";
      console.log(`  ${bulletIcon} ${moment.description}`);
    }
  }

  // THE PUNCHLINE - This is what makes people share
  console.log("");
  console.log(divider(50));
  console.log("");
  
  if (stats.hallucinationsBlocked > 0) {
    console.log(bold(`Your AI made ${stats.hallucinationsBlocked} fewer mistakes.`));
  } else if (stats.totalCalls > 0) {
    console.log(bold(`Your AI verified ${stats.totalCalls} facts before acting.`));
  }
  
  console.log(dim("That's what guardrail does."));
  console.log("");

  // Next action
  console.log(`${dim("Next:")} ${link("guardrail ship")} ${dim("(GO/NO-GO verdict)")}`);
  console.log("");
}
