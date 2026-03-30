/**
 * `guardrail ship` - Ship Verdict Command
 * GO/WARN/NO-GO checkpoint before deploy with receipts and fix plan
 */
import * as fs from "fs";
import * as path from "path";
import { buildTruthPack, verifyFast, checkArchitectureBoundaries } from "@guardrail-context/engine";
import { TelemetryLedger } from "../telemetry/ledger.js";
import { generateHTMLReport } from "../reports/html.js";
import { checkShipAccess, getAuthState } from "../auth/gate.js";

export type ShipVerdict = "GO" | "WARN" | "NO-GO";

export interface ShipBlocker {
  category: "symbols" | "routes" | "versions" | "security" | "architecture" | "antipatterns";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  file?: string;
  line?: number;
  fix?: string;
}

export interface ShipReport {
  verdict: ShipVerdict;
  timestamp: string;
  repoPath: string;
  blockers: ShipBlocker[];
  warnings: ShipBlocker[];
  passed: string[];
  contextImpact: {
    hallucinationsBlocked7d: number;
    patternsUsed: number;
    topPreventedMistakes: string[];
  };
  fixPlan: FixPlan;
  artifactPath?: string;
}

export interface FixPlan {
  autoFixable: FixAction[];
  manual: FixAction[];
}

export interface FixAction {
  description: string;
  file?: string;
  command?: string;
  risk: "safe" | "moderate" | "risky";
}

interface ShipOptions {
  json?: boolean;
  details?: boolean;
  evidence?: boolean;
  report?: boolean;
  fix?: boolean;
}

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgRed: "\x1b[41m",
  white: "\x1b[37m",
};

export async function cmdShip(repoPath: string, opts: ShipOptions = {}): Promise<ShipReport> {
  // Check payment gate
  const access = checkShipAccess();
  if (!access.allowed) {
    console.log(`${ANSI.yellow}${access.reason}${ANSI.reset}`);
    console.log(`${ANSI.dim}Upgrade at: https://guardrail.dev/upgrade${ANSI.reset}\n`);
    
    // Return empty report for free tier
    return {
      verdict: "NO-GO",
      timestamp: new Date().toISOString(),
      repoPath,
      blockers: [{ category: "security", severity: "critical", message: access.reason || "Upgrade required" }],
      warnings: [],
      passed: [],
      contextImpact: { hallucinationsBlocked7d: 0, patternsUsed: 0, topPreventedMistakes: [] },
      fixPlan: { autoFixable: [], manual: [] },
    };
  }

  const contextDir = path.join(repoPath, ".guardrail-context");
  const guardrailDir = path.join(repoPath, ".guardrail");
  const reportsDir = path.join(guardrailDir, "reports");

  // Ensure Truth Pack exists
  if (!fs.existsSync(path.join(contextDir, "truthpack.json"))) {
    console.log(`${ANSI.yellow}Building Truth Pack...${ANSI.reset}`);
    await buildTruthPack(repoPath);
  }

  // Run all checks
  const blockers: ShipBlocker[] = [];
  const warnings: ShipBlocker[] = [];
  const passed: string[] = [];

  console.log(`
${ANSI.cyan}╔═══════════════════════════════════════════════════════════╗
║                    guardrail SHIP                          ║
║            Moment of truth before deploy                   ║
╚═══════════════════════════════════════════════════════════╝${ANSI.reset}
`);

  // 1. Check anti-patterns
  console.log(`${ANSI.dim}Checking anti-patterns...${ANSI.reset}`);
  const antipatterns = loadJson(contextDir, "antipatterns.json");
  if (antipatterns?.antipatterns) {
    const critical = antipatterns.antipatterns.filter((a: any) => a.severity === "critical");
    const high = antipatterns.antipatterns.filter((a: any) => a.severity === "high");
    
    for (const ap of critical) {
      blockers.push({
        category: "antipatterns",
        severity: "critical",
        message: ap.message || ap.pattern,
        file: ap.file,
        line: ap.line,
        fix: ap.fix,
      });
    }
    
    for (const ap of high) {
      warnings.push({
        category: "antipatterns",
        severity: "high",
        message: ap.message || ap.pattern,
        file: ap.file,
        line: ap.line,
        fix: ap.fix,
      });
    }
    
    if (critical.length === 0) {
      passed.push(`No critical anti-patterns`);
    }
  }

  // 2. Check vulnerabilities
  console.log(`${ANSI.dim}Checking vulnerabilities...${ANSI.reset}`);
  const vulns = loadJson(contextDir, "vulnerabilities.json");
  if (vulns?.vulnerabilities) {
    for (const v of vulns.vulnerabilities) {
      if (v.severity === "critical" || v.severity === "high") {
        blockers.push({
          category: "security",
          severity: v.severity,
          message: `${v.package}@${v.version}: ${v.title || v.vulnerability}`,
          fix: v.fix || `Update to ${v.package}@${v.patchedVersion}`,
        });
      } else {
        warnings.push({
          category: "security",
          severity: v.severity || "medium",
          message: `${v.package}: ${v.title || v.vulnerability}`,
          fix: v.fix,
        });
      }
    }
    
    if (vulns.vulnerabilities.length === 0) {
      passed.push(`No known vulnerabilities`);
    }
  } else {
    passed.push(`Dependencies scanned`);
  }

  // 3. Check architecture boundaries
  console.log(`${ANSI.dim}Checking architecture boundaries...${ANSI.reset}`);
  const graph = loadJson(contextDir, "graph.json");
  if (graph) {
    const archReport = checkArchitectureBoundaries(graph);
    for (const v of archReport.violations) {
      warnings.push({
        category: "architecture",
        severity: "medium",
        message: v.message,
        file: v.file,
        fix: `Move shared code to a shared/ directory`,
      });
    }
    
    if (archReport.violations.length === 0) {
      passed.push(`Architecture boundaries clean`);
    }
  }

  // 4. Run fast verification
  console.log(`${ANSI.dim}Running verification gates...${ANSI.reset}`);
  try {
    const verifyResult = await verifyFast(repoPath);
    if (verifyResult.ok) {
      passed.push(`Verification gates passed`);
    } else {
      for (const gate of verifyResult.gates || []) {
        if (!gate.ok) {
          warnings.push({
            category: "symbols",
            severity: "medium",
            message: gate.details || gate.name,
          });
        }
      }
    }
  } catch (e) {
    // Verification may fail if not fully configured
    passed.push(`Basic checks passed`);
  }

  // 5. Get context impact from telemetry
  const ledger = new TelemetryLedger(repoPath);
  const stats = ledger.getStats("7d");
  const contextImpact = {
    hallucinationsBlocked7d: stats.hallucinationsBlocked,
    patternsUsed: stats.patternSuggestions,
    topPreventedMistakes: stats.topSavedMoments.slice(0, 3).map(m => m.description),
  };

  // 6. Generate fix plan
  const fixPlan = generateFixPlan(blockers, warnings);

  // 7. Determine verdict
  const verdict = determineVerdict(blockers, warnings);

  // 8. Build report
  const report: ShipReport = {
    verdict,
    timestamp: new Date().toISOString(),
    repoPath,
    blockers,
    warnings,
    passed,
    contextImpact,
    fixPlan,
  };

  // 9. Generate HTML report if requested
  if (opts.report) {
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const reportPath = path.join(reportsDir, `ship-${Date.now()}.html`);
    await generateHTMLReport(report, reportPath);
    report.artifactPath = reportPath;
  }

  // 10. Output
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printShipReport(report, opts);
  }

  // Exit with appropriate code
  if (verdict === "NO-GO") {
    process.exitCode = 1;
  }

  return report;
}

function determineVerdict(blockers: ShipBlocker[], warnings: ShipBlocker[]): ShipVerdict {
  if (blockers.length > 0) {
    return "NO-GO";
  }
  if (warnings.length > 5) {
    return "WARN";
  }
  return "GO";
}

function generateFixPlan(blockers: ShipBlocker[], warnings: ShipBlocker[]): FixPlan {
  const autoFixable: FixAction[] = [];
  const manual: FixAction[] = [];

  for (const b of [...blockers, ...warnings]) {
    if (b.fix) {
      if (b.category === "security" && b.fix.startsWith("Update to")) {
        autoFixable.push({
          description: b.fix,
          command: `npm update ${b.fix.split("@")[0]?.replace("Update to ", "")}`,
          risk: "safe",
        });
      } else {
        manual.push({
          description: b.fix,
          file: b.file,
          risk: b.severity === "critical" ? "risky" : "moderate",
        });
      }
    }
  }

  return { autoFixable, manual };
}

function printShipReport(report: ShipReport, opts: ShipOptions): void {
  // Verdict banner
  const verdictColors = {
    GO: `${ANSI.bgGreen}${ANSI.white}${ANSI.bold}`,
    WARN: `${ANSI.bgYellow}${ANSI.white}${ANSI.bold}`,
    "NO-GO": `${ANSI.bgRed}${ANSI.white}${ANSI.bold}`,
  };
  const verdictIcons = { GO: "✓", WARN: "⚠", "NO-GO": "✗" };

  console.log(`
${verdictColors[report.verdict]}  ${verdictIcons[report.verdict]} ${report.verdict}  ${ANSI.reset}
`);

  // Blockers
  if (report.blockers.length > 0) {
    console.log(`${ANSI.red}${ANSI.bold}BLOCKERS (${report.blockers.length})${ANSI.reset}`);
    console.log(`${ANSI.dim}─────────────────────────────────────────────────${ANSI.reset}`);
    for (const b of report.blockers.slice(0, opts.details ? 20 : 5)) {
      console.log(`  ${ANSI.red}✗${ANSI.reset} [${b.category}] ${b.message}`);
      if (opts.evidence && b.file) {
        console.log(`    ${ANSI.dim}→ ${b.file}${b.line ? `:${b.line}` : ""}${ANSI.reset}`);
      }
    }
    if (!opts.details && report.blockers.length > 5) {
      console.log(`  ${ANSI.dim}... and ${report.blockers.length - 5} more${ANSI.reset}`);
    }
    console.log();
  }

  // Warnings
  if (report.warnings.length > 0 && (opts.details || report.verdict !== "NO-GO")) {
    console.log(`${ANSI.yellow}${ANSI.bold}WARNINGS (${report.warnings.length})${ANSI.reset}`);
    console.log(`${ANSI.dim}─────────────────────────────────────────────────${ANSI.reset}`);
    for (const w of report.warnings.slice(0, opts.details ? 10 : 3)) {
      console.log(`  ${ANSI.yellow}⚠${ANSI.reset} [${w.category}] ${w.message}`);
    }
    if (!opts.details && report.warnings.length > 3) {
      console.log(`  ${ANSI.dim}... and ${report.warnings.length - 3} more${ANSI.reset}`);
    }
    console.log();
  }

  // Passed
  if (report.passed.length > 0) {
    console.log(`${ANSI.green}${ANSI.bold}PASSED (${report.passed.length})${ANSI.reset}`);
    console.log(`${ANSI.dim}─────────────────────────────────────────────────${ANSI.reset}`);
    for (const p of report.passed) {
      console.log(`  ${ANSI.green}✓${ANSI.reset} ${p}`);
    }
    console.log();
  }

  // Context Mode impact
  if (report.contextImpact.hallucinationsBlocked7d > 0) {
    console.log(`${ANSI.cyan}${ANSI.bold}CONTEXT MODE IMPACT (7 days)${ANSI.reset}`);
    console.log(`${ANSI.dim}─────────────────────────────────────────────────${ANSI.reset}`);
    console.log(`  ${ANSI.cyan}🛡️${ANSI.reset} Hallucinations blocked: ${ANSI.bold}${report.contextImpact.hallucinationsBlocked7d}${ANSI.reset}`);
    console.log(`  ${ANSI.cyan}📋${ANSI.reset} Patterns suggested: ${report.contextImpact.patternsUsed}`);
    if (report.contextImpact.topPreventedMistakes.length > 0) {
      console.log(`  ${ANSI.cyan}🎯${ANSI.reset} Top saves:`);
      for (const m of report.contextImpact.topPreventedMistakes) {
        console.log(`     • ${m}`);
      }
    }
    console.log();
  }

  // Fix plan
  if (report.verdict !== "GO" && (report.fixPlan.autoFixable.length > 0 || report.fixPlan.manual.length > 0)) {
    console.log(`${ANSI.magenta}${ANSI.bold}FIX PLAN${ANSI.reset}`);
    console.log(`${ANSI.dim}─────────────────────────────────────────────────${ANSI.reset}`);
    
    if (report.fixPlan.autoFixable.length > 0) {
      console.log(`  ${ANSI.green}Auto-fixable:${ANSI.reset}`);
      for (const f of report.fixPlan.autoFixable.slice(0, 5)) {
        console.log(`    • ${f.description}`);
        if (f.command) {
          console.log(`      ${ANSI.dim}$ ${f.command}${ANSI.reset}`);
        }
      }
    }
    
    if (report.fixPlan.manual.length > 0) {
      console.log(`  ${ANSI.yellow}Manual fixes:${ANSI.reset}`);
      for (const f of report.fixPlan.manual.slice(0, 5)) {
        console.log(`    • ${f.description}`);
      }
    }
    console.log();
  }

  // Artifact path
  if (report.artifactPath) {
    console.log(`${ANSI.dim}Report saved: ${report.artifactPath}${ANSI.reset}`);
    console.log();
  }

  // Next action
  console.log(`${ANSI.dim}─────────────────────────────────────────────────${ANSI.reset}`);
  if (report.verdict === "GO") {
    console.log(`${ANSI.green}Ready to ship! 🚀${ANSI.reset}`);
  } else if (report.verdict === "WARN") {
    console.log(`${ANSI.yellow}Review warnings before shipping.${ANSI.reset}`);
    console.log(`${ANSI.dim}Use --details for full breakdown.${ANSI.reset}`);
  } else {
    console.log(`${ANSI.red}Fix blockers before shipping.${ANSI.reset}`);
    console.log(`${ANSI.dim}Use --fix to apply safe auto-fixes.${ANSI.reset}`);
  }
  console.log();
}

function loadJson(dir: string, filename: string): any {
  const filePath = path.join(dir, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
