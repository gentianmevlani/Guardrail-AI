/**
 * guardrail stats
 * 
 * Makes value visible: "hallucinations blocked" + "saved moments" + latency + trends.
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { TruthPackGenerator } from '../truth-pack';
import { printLogo } from '../ui';
import { styles, icons } from '../ui';

interface Stats {
  hallucinationsBlocked: {
    last24h: number;
    last7d: number;
    total: number;
  };
  symbolsVerified: number;
  versionLiesBlocked: number;
  patternsEnforced: number;
  boundaryViolationsPrevented: number;
  securityFootgunsFlagged: number;
  savedMoments: Array<{
    timestamp: string;
    type: string;
    file: string;
    line: number;
    description: string;
  }>;
  latency: {
    average: number;
    p95: number;
    p99: number;
  };
  trends: {
    hallucinationsBlocked: number[]; // Last 7 days
    latency: number[]; // Last 7 days
  };
}

export function registerStatsCommand(program: Command): void {
  program
    .command('stats')
    .description('Show value metrics: hallucinations blocked, saved moments, latency, trends')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      printLogo();
      
      const projectPath = resolve(options.path);
      const statsFile = join(projectPath, '.guardrail', 'stats.json');
      const telemetryFile = join(projectPath, '.guardrail', 'telemetry.json');
      
      let stats: Stats;

      // Load stats if exists, otherwise create default
      if (existsSync(statsFile)) {
        try {
          stats = JSON.parse(readFileSync(statsFile, 'utf-8'));
        } catch {
          stats = getDefaultStats();
        }
      } else {
        stats = getDefaultStats();
      }

      // Merge telemetry data if available
      if (existsSync(telemetryFile)) {
        try {
          const telemetry = JSON.parse(readFileSync(telemetryFile, 'utf-8'));
          
          // Update stats from telemetry
          if (telemetry.hallucinationsBlocked) {
            stats.hallucinationsBlocked.total = telemetry.hallucinationsBlocked;
          }
          if (telemetry.symbolsVerified) {
            stats.symbolsVerified = telemetry.symbolsVerified;
          }
          
          // Calculate 24h/7d from tool calls
          if (telemetry.toolCalls && Array.isArray(telemetry.toolCalls)) {
            const now = Date.now();
            const last24h = telemetry.toolCalls.filter((call: any) => 
              now - new Date(call.timestamp).getTime() < 24 * 60 * 60 * 1000
            );
            const last7d = telemetry.toolCalls.filter((call: any) =>
              now - new Date(call.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000
            );
            
            stats.hallucinationsBlocked.last24h = last24h.filter((c: any) => c.blockedHallucination).length;
            stats.hallucinationsBlocked.last7d = last7d.filter((c: any) => c.blockedHallucination).length;
            
            // Calculate latency
            const latencies = telemetry.toolCalls.map((c: any) => c.latency || 0).filter((l: number) => l > 0);
            if (latencies.length > 0) {
              latencies.sort((a: number, b: number) => a - b);
              stats.latency.average = latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length;
              stats.latency.p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
              stats.latency.p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
            }
          }
        } catch {
          // Ignore telemetry errors
        }
      }

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      console.log(`\n${styles.brightCyan}${styles.bold}${icons.info} guardrail STATS${styles.reset}\n`);

      // Relationship Meter
      console.log(`  ${styles.bold}${styles.brightCyan}Relationship Meter${styles.reset}`);
      console.log(`  ${styles.dim}${'─'.repeat(50)}${styles.reset}`);
      console.log(`  ${styles.brightGreen}Hallucinations Blocked:${styles.reset}`);
      console.log(`    Last 24h: ${styles.bold}${stats.hallucinationsBlocked.last24h}${styles.reset}`);
      console.log(`    Last 7d:  ${styles.bold}${stats.hallucinationsBlocked.last7d}${styles.reset}`);
      console.log(`    Total:    ${styles.bold}${stats.hallucinationsBlocked.total}${styles.reset}`);
      console.log('');
      console.log(`  ${styles.brightGreen}Symbols Verified:${styles.reset} ${styles.bold}${stats.symbolsVerified}${styles.reset}`);
      console.log(`  ${styles.brightGreen}Version Lies Blocked:${styles.reset} ${styles.bold}${stats.versionLiesBlocked}${styles.reset}`);
      console.log(`  ${styles.brightGreen}Patterns Enforced:${styles.reset} ${styles.bold}${stats.patternsEnforced}${styles.reset}`);
      console.log(`  ${styles.brightGreen}Boundary Violations Prevented:${styles.reset} ${styles.bold}${stats.boundaryViolationsPrevented}${styles.reset}`);
      console.log(`  ${styles.brightGreen}Security Footguns Flagged:${styles.reset} ${styles.bold}${stats.securityFootgunsFlagged}${styles.reset}`);
      console.log('');

      // Saved Moments
      if (stats.savedMoments.length > 0) {
        console.log(`  ${styles.bold}${styles.brightCyan}Saved Moments (Recent)${styles.reset}`);
        console.log(`  ${styles.dim}${'─'.repeat(50)}${styles.reset}`);
        stats.savedMoments.slice(0, 5).forEach((moment, i) => {
          console.log(`  ${styles.cyan}${i + 1}.${styles.reset} ${moment.description}`);
          console.log(`     ${styles.dim}${moment.file}:${moment.line}${styles.reset}`);
        });
        console.log('');
      }

      // Latency
      console.log(`  ${styles.bold}${styles.brightCyan}Performance${styles.reset}`);
      console.log(`  ${styles.dim}${'─'.repeat(50)}${styles.reset}`);
      console.log(`  Average: ${styles.bold}${stats.latency.average}ms${styles.reset}`);
      console.log(`  P95:     ${styles.bold}${stats.latency.p95}ms${styles.reset}`);
      console.log(`  P99:     ${styles.bold}${stats.latency.p99}ms${styles.reset}`);
      console.log('');

      // Next best action
      console.log(`  ${styles.bold}Next best action:${styles.reset} ${styles.brightCyan}guardrail ship${styles.reset} to run ship check\n`);
    });
}

function getDefaultStats(): Stats {
  return {
    hallucinationsBlocked: {
      last24h: 0,
      last7d: 0,
      total: 0,
    },
    symbolsVerified: 0,
    versionLiesBlocked: 0,
    patternsEnforced: 0,
    boundaryViolationsPrevented: 0,
    securityFootgunsFlagged: 0,
    savedMoments: [],
    latency: {
      average: 0,
      p95: 0,
      p99: 0,
    },
    trends: {
      hallucinationsBlocked: [0, 0, 0, 0, 0, 0, 0],
      latency: [0, 0, 0, 0, 0, 0, 0],
    },
  };
}
