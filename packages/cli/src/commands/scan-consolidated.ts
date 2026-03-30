/**
 * guardrail scan
 * 
 * Fast "Reality Sniff + Proof" on the local repo.
 * Consolidates all scanning capabilities into one command.
 */

import { Command } from 'commander';
import {
  getCloudSyncEnvFromEnv,
  redactCliScanOutputForFreeTier,
  redactProofGraphForFreeTier,
  shouldRedactIssueDetails,
  uploadRunToCloud,
  shipVerdictToApi,
} from '@guardrail/core';
import { resolve, join, basename } from 'path';
import { homedir } from 'os';
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { RealitySniffScanner } from '../scan/reality-sniff';
import { VerificationEngine } from '../scan/verification-engine';
import { ProofGraphBuilder } from '../scan/proof-graph';
import { printLogo } from '../ui';
import { styles, icons } from '../ui';
import { createSteps, withSpinner, printScanSummary, type ScanSummaryData } from '../ui/index';
import { ensureInitialized } from './auto-init';
import {
  ensureTruthPackForScan,
  type TruthPackScanContext,
} from './scan-context';
import { loadTruthPackScoringIndex } from '../scan/truth-pack-scoring';
import { recordFindings } from '../scan/learning-loop';

export interface ScanResult {
  version: string;
  timestamp: string;
  projectPath: string;
  verdict: 'PASS' | 'FAIL' | 'WARN';
  summary: {
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    totalScore: number;
  };
  topBlockers: Array<{
    id: string;
    type: string;
    file: string;
    line: number;
    severity: string;
    score: number;
    verdict: 'PASS' | 'FAIL' | 'WARN';
  }>;
  proofGraph: {
    nodes: number;
    edges: number;
    evidenceStrength: number;
  };
  findings: Array<{
    id: string;
    type: string;
    file: string;
    line: number;
    severity: string;
    score: number;
    verdict: 'PASS' | 'FAIL' | 'WARN';
    confidence: number;
    evidence: Array<{
      level: string;
      strength: number;
    }>;
    truthPack?: {
      weight: number;
      importanceNorm: number;
      routeCount: number;
      symbolCount: number;
    };
  }>;
  hotspots: Array<{
    file: string;
    score: number;
    findings: number;
  }>;
  nextActions: string[];
  /** Present when `--with-context` runs the Truth Pack (context engine) step */
  truthPackContext?: TruthPackScanContext;
  /** When `.guardrail-context` has symbol/route/importance data, Reality Sniff escalates scores */
  truthPackScoring?: {
    applied: boolean;
    filesWeighted: number;
    maxWeight: number;
    weightedFindings: number;
  };
  /** Set when output is redacted for free tier (paths / finding lists omitted). */
  issueDetailsRedacted?: boolean;
  upgradeHint?: string;
}

export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Fast Reality Sniff + Proof on local repo')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--json', 'Output as JSON')
    .option('--plain', 'No color/unicode output')
    .option('--details', 'Show detailed output')
    .option('--strict', 'Treat top WARN as FAIL')
    .option('--runtime', 'Enable runtime witness probes/playwright')
    .option('--since <ref>', 'Change-aware scan (uses git diff + dep closure)')
    .option(
      '--with-context',
      'Index repo Truth Pack (.guardrail-context) before scan — grounds AI on real symbols, routes, deps'
    )
    .option(
      '--refresh-context',
      'With --with-context: force full Truth Pack regeneration (ignore 24h freshness)'
    )
    .option('-o, --output <file>', 'Output file path')
    .option(
      '--sync',
      'Upload results to Guardrail cloud (set GUARDRAIL_API_URL or GUARDRAIL_API_BASE_URL + GUARDRAIL_API_KEY)',
    )
    .action(async (options) => {
      const silent = Boolean(options.json);
      const startTime = performance.now();

      if (!silent) {
        printLogo();
      }

      const projectPath = resolve(options.path);

      // Auto-init if not configured yet
      await ensureInitialized(projectPath, { silent });

      const outputPath = options.output || join(projectPath, '.guardrail', 'scan.json');

      // Ensure output directory exists
      const outputDir = join(outputPath, '..');
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      if (!silent) {
        console.log(`\n${styles.brightCyan}${styles.bold}${icons.scan} REALITY SCAN${styles.reset}`);
        console.log(`  ${styles.dim}${projectPath}${styles.reset}\n`);
      }

      if (options.refreshContext && !options.withContext && !silent) {
        console.log(
          `  ${styles.brightYellow}${styles.bold}!${styles.reset} ${styles.dim}--refresh-context requires --with-context; ignoring.${styles.reset}\n`
        );
      }

      // ── Step tracking ──
      const totalSteps = options.withContext ? 4 : 3;
      const steps = createSteps(totalSteps);

      // ── Truth Pack (optional) ──
      let truthPackContext: TruthPackScanContext | undefined;
      if (options.withContext) {
        if (!silent) steps.start('Indexing Truth Pack');
        truthPackContext = await ensureTruthPackForScan(projectPath, {
          forceRefresh: Boolean(options.refreshContext),
        });
        if (!silent) {
          if (truthPackContext.error) {
            steps.fail(`Truth Pack failed: ${truthPackContext.error}`);
          } else if (truthPackContext.truthPackSkippedFresh) {
            steps.complete(`Truth Pack fresh (${truthPackContext.symbolCount} symbols, ${truthPackContext.routeCount} routes)`);
          } else {
            steps.complete(`Truth Pack generated (${truthPackContext.symbolCount} symbols, ${truthPackContext.routeCount} routes, ${truthPackContext.dependencyCount} deps)`);
          }
        }
      }

      const truthPackScoringIndex = loadTruthPackScoringIndex(projectPath);

      // ── Step 1: Reality Sniff ──
      if (!silent) steps.start('Reality Sniff');
      const scanner = new RealitySniffScanner();
      const sniffResult = await scanner.scan(projectPath, {
        exclude: ['node_modules', '.git', 'dist', 'build', '.next'],
        includeTests: false,
        truthPackScoring: truthPackScoringIndex,
      });
      if (!silent) steps.complete(`Reality Sniff — ${sniffResult.findings.length} findings`);

      // ── Step 2: Verification Engine ──
      if (!silent) steps.start('Verification Engine');
      const verifier = new VerificationEngine();
      const verifiedFindings = await Promise.all(
        sniffResult.findings.map(finding =>
          verifier.verify(finding, {
            enableStructural: true,
            enableRuntime: options.runtime,
          })
        )
      );
      if (!silent) steps.complete(`Verified ${verifiedFindings.length} findings`);

      // ── Step 3: Build Proof Graph ──
      if (!silent) steps.start('Building Proof Graph');
      const graphBuilder = new ProofGraphBuilder();
      
      // Add nodes for findings
      verifiedFindings.forEach((vf, index) => {
        graphBuilder.addNode({
          id: `finding-${vf.finding.id}`,
          type: 'handler',
          name: vf.finding.type,
          file: vf.finding.file,
          line: vf.finding.line,
        });
      });

      // Determine overall verdict
      const hasFail = verifiedFindings.some(vf => vf.verdict === 'FAIL');
      const hasWarn = verifiedFindings.some(vf => vf.verdict === 'WARN');
      let verdict: 'PASS' | 'FAIL' | 'WARN' = 'PASS';
      
      if (hasFail) {
        verdict = 'FAIL';
      } else if (hasWarn) {
        if (options.strict) {
          verdict = 'FAIL';
        } else {
          verdict = 'WARN';
        }
      }

      const proofGraph = graphBuilder.build(
        verdict,
        verifiedFindings.length > 0
          ? verifiedFindings.reduce((sum, vf) => sum + vf.confidence, 0) / verifiedFindings.length
          : 1.0,
        verifiedFindings.map(vf => vf.finding.id)
      );

      // Build result
      const result: ScanResult = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        projectPath,
        verdict,
        summary: {
          totalFindings: verifiedFindings.length,
          critical: verifiedFindings.filter(vf => vf.finding.severity === 'critical').length,
          high: verifiedFindings.filter(vf => vf.finding.severity === 'high').length,
          medium: verifiedFindings.filter(vf => vf.finding.severity === 'medium').length,
          low: verifiedFindings.filter(vf => vf.finding.severity === 'low').length,
          totalScore: sniffResult.summary.totalScore,
        },
        ...(sniffResult.truthPackScoring
          ? { truthPackScoring: sniffResult.truthPackScoring }
          : {}),
        topBlockers: verifiedFindings
          .filter(vf => vf.verdict === 'FAIL' || (options.strict && vf.verdict === 'WARN'))
          .slice(0, 10)
          .map(vf => ({
            id: vf.finding.id,
            type: vf.finding.type,
            file: vf.finding.file,
            line: vf.finding.line,
            severity: vf.finding.severity,
            score: vf.finding.score,
            verdict: vf.verdict,
          })),
        proofGraph: {
          nodes: proofGraph.nodes.length,
          edges: proofGraph.edges.length,
          evidenceStrength: proofGraph.evidenceStrength,
        },
        findings: verifiedFindings.map(vf => ({
          id: vf.finding.id,
          type: vf.finding.type,
          file: vf.finding.file,
          line: vf.finding.line,
          severity: vf.finding.severity,
          score: vf.finding.score,
          verdict: vf.verdict,
          confidence: vf.confidence,
          evidence: vf.evidence.map(e => ({
            level: e.level,
            strength: e.strength,
          })),
          ...(vf.finding.truthPack ? { truthPack: vf.finding.truthPack } : {}),
        })),
        hotspots: sniffResult.hotspots,
        nextActions: getNextActions(verdict, verifiedFindings, truthPackContext),
        ...(truthPackContext ? { truthPackContext } : {}),
      };

      if (!silent) steps.complete('Proof graph built');

      const elapsedMs = Math.round(performance.now() - startTime);

      const tier = getCliTier();
      const outputResult: ScanResult = shouldRedactIssueDetails(tier)
        ? redactCliScanOutputForFreeTier(result)
        : result;

      // Output
      if (options.json) {
        console.log(JSON.stringify(outputResult, null, 2));
      } else if (options.plain) {
        outputPlain(outputResult);
      } else {
        // ── Beautiful summary card ──
        const summaryData: ScanSummaryData = {
          verdict: outputResult.verdict,
          score: outputResult.summary.totalScore,
          findings: {
            total: outputResult.summary.totalFindings,
            critical: outputResult.summary.critical,
            high: outputResult.summary.high,
            medium: outputResult.summary.medium,
            low: outputResult.summary.low,
          },
          topFindings: outputResult.topBlockers.slice(0, 5).map(b => ({
            file: b.file,
            line: b.line,
            type: b.type,
            severity: b.severity,
          })),
          elapsedMs,
          nextActions: outputResult.nextActions,
          redacted: outputResult.issueDetailsRedacted,
          upgradeHint: outputResult.upgradeHint,
        };
        printScanSummary(summaryData);
      }

      // Write output file (tier-aware redaction)
      writeFileSync(outputPath, JSON.stringify(outputResult, null, 2));

      // Learning Loop — record findings for violation pattern tracking
      try {
        const learningFindings = (outputResult.findings || []).map((f: any) => ({
          id: f.id,
          type: f.type,
          file: f.file,
          line: f.line,
          severity: f.severity,
          description: f.type,
        }));
        const history = recordFindings(projectPath, learningFindings);
        if (!silent && history.stats.repeatOffenders > 0) {
          console.log(
            `  ${styles.brightYellow}${icons.warning}${styles.reset} ` +
            `${styles.bold}${history.stats.repeatOffenders} repeat violation(s)${styles.reset} ` +
            `tracked in .guardrail/violation-history.json`
          );
          if (history.stats.fixedThenReintroduced > 0) {
            console.log(
              `  ${styles.brightRed}${icons.error}${styles.reset} ` +
              `${history.stats.fixedThenReintroduced} violation(s) were fixed then re-introduced`
            );
          }
        }
      } catch {
        // Learning loop is non-critical — don't fail the scan
      }

      // Write proof graph
      const proofPath = join(outputDir, 'proof.json');
      const proofPayload = shouldRedactIssueDetails(tier)
        ? redactProofGraphForFreeTier(proofGraph)
        : proofGraph;
      writeFileSync(proofPath, JSON.stringify(proofPayload, null, 2));

      // Write hotspots markdown
      const hotspotsPath = join(outputDir, 'hotspots.md');
      writeFileSync(hotspotsPath, generateHotspotsMarkdown(outputResult));

      if (options.sync || process.env.GUARDRAIL_SYNC === '1') {
        const env = getCloudSyncEnvFromEnv();
        if (!env) {
          if (!options.json) {
            console.log(
              `  ${styles.dim}Cloud sync skipped: set GUARDRAIL_API_URL (or GUARDRAIL_API_BASE_URL) and GUARDRAIL_API_KEY${styles.reset}\n`,
            );
          }
        } else {
          const { verdict: apiVerdict, score: apiScore } = shipVerdictToApi(result.verdict);
          const findings = outputResult.findings.map((f) => ({
            id: f.id,
            type: f.type,
            file: f.file,
            line: f.line,
            severity: f.severity,
            score: f.score,
            verdict: f.verdict,
            ...(f.truthPack ? { truthPack: f.truthPack } : {}),
          }));
          const up = await uploadRunToCloud({
            baseUrl: env.baseUrl,
            apiKey: env.apiKey,
            payload: {
              repo: basename(projectPath),
              branch: process.env.GUARDRAIL_BRANCH || process.env.GITHUB_REF_NAME,
              commitSha: process.env.GUARDRAIL_COMMIT_SHA || process.env.GITHUB_SHA,
              verdict: apiVerdict,
              score: apiScore,
              source: 'cli',
              findings,
              guardrailResult: {
                tool: 'scan',
                scanVerdict: result.verdict,
                summary: outputResult.summary,
                truthPackContext: outputResult.truthPackContext,
                truthPackScoring: outputResult.truthPackScoring,
              },
              securityResult: {
                proofGraph: outputResult.proofGraph,
                hotspots: outputResult.hotspots.slice(0, 20),
              },
            },
          });
          if (!options.json) {
            if (up.ok) {
              console.log(
                `  ${styles.dim}Synced scan to cloud (${env.baseUrl})${styles.reset}\n`,
              );
            } else {
              console.log(
                `  ${styles.brightYellow}Cloud sync failed: ${up.error ?? 'unknown error'}${styles.reset}\n`,
              );
            }
          }
        }
      }

      // Exit code
      if (verdict === 'FAIL') {
        process.exit(1);
      } else if (verdict === 'WARN') {
        process.exit(0); // WARN doesn't fail unless --strict
      } else {
        process.exit(0);
      }
    });
}

function getCliTier(): string {
  const fromEnv = process.env.GUARDRAIL_TIER?.trim();
  if (fromEnv) {
    return fromEnv.toLowerCase();
  }
  try {
    const credPath = join(homedir(), ".guardrail", "credentials.json");
    if (existsSync(credPath)) {
      const raw = JSON.parse(readFileSync(credPath, "utf8")) as { tier?: string };
      if (raw.tier && typeof raw.tier === "string") {
        return raw.tier.toLowerCase();
      }
    }
  } catch {
    // ignore
  }
  return "free";
}

function getNextActions(
  verdict: 'PASS' | 'FAIL' | 'WARN',
  findings: unknown[],
  truthPackContext?: TruthPackScanContext
): string[] {
  const actions: string[] = [];

  if (truthPackContext?.error) {
    actions.push('Fix Truth Pack generation (see error above), then re-run scan --with-context');
  }

  if (verdict === 'FAIL') {
    actions.push('guardrail fix --id <finding-id>');
    actions.push('guardrail explain <finding-id>');
  } else if (verdict === 'WARN') {
    actions.push('guardrail ship (to run full checks)');
    actions.push('guardrail explain <finding-id>');
  } else {
    actions.push('guardrail ship (to run deployment gate)');
  }

  if (truthPackContext && !truthPackContext.error) {
    actions.push(
      'Serve Truth Pack to your IDE: guardrail-context serve (same .guardrail-context directory)'
    );
  }

  return actions;
}

function outputHumanReadable(result: ScanResult, details: boolean = false): void {
  console.log(`  ${styles.bold}Verdict:${styles.reset} ${getVerdictColor(result.verdict)}${result.verdict}${styles.reset}\n`);

  if (result.issueDetailsRedacted) {
    console.log(
      `  ${styles.brightYellow}${styles.bold}!${styles.reset} ${styles.dim}Free plan: severity counts only. Upgrade for file paths and full findings.${styles.reset}`,
    );
    console.log(`  ${styles.dim}${result.upgradeHint ?? ""}${styles.reset}\n`);
  }

  if (result.truthPackScoring?.applied) {
    const s = result.truthPackScoring;
    if (s.weightedFindings > 0) {
      console.log(
        `  ${styles.bold}Truth Pack scoring:${styles.reset} ${s.weightedFindings} findings weighted (max ×${s.maxWeight.toFixed(2)}, ${s.filesWeighted} files)`
      );
    } else {
      console.log(
        `  ${styles.bold}Truth Pack scoring:${styles.reset} ${styles.dim}active — no findings in hot routes/symbols this run${styles.reset}`
      );
    }
    console.log(
      `  ${styles.dim}Same .guardrail-context index as guardrail-context (guardrail-context index) or guardrail scan --with-context${styles.reset}\n`
    );
  }

  if (result.truthPackContext && !result.truthPackContext.error) {
    const tp = result.truthPackContext;
    console.log(`  ${styles.bold}Truth Pack:${styles.reset} ${tp.symbolCount} symbols, ${tp.routeCount} routes, ${tp.dependencyCount} deps`);
    if (tp.truthPackSkippedFresh) {
      console.log(`  ${styles.dim}(index was already fresh; skipped full regen)${styles.reset}`);
    }
    console.log('');
  }

  if (result.summary.totalFindings > 0) {
    console.log(`  ${styles.bold}Summary:${styles.reset}`);
    console.log(`    Total:    ${styles.bold}${result.summary.totalFindings}${styles.reset}`);
    console.log(`    Critical: ${styles.brightRed}${result.summary.critical}${styles.reset}`);
    console.log(`    High:     ${styles.brightYellow}${result.summary.high}${styles.reset}`);
    console.log(`    Medium:   ${styles.brightBlue}${result.summary.medium}${styles.reset}`);
    console.log(`    Low:      ${styles.dim}${result.summary.low}${styles.reset}`);
    console.log('');
  }

  if (result.topBlockers.length > 0) {
    console.log(`  ${styles.bold}Top Blockers:${styles.reset}`);
    result.topBlockers.slice(0, 5).forEach((blocker, i) => {
      console.log(`    ${i + 1}. ${styles.bold}${blocker.id}${styles.reset} - ${blocker.type}`);
      console.log(`       ${styles.dim}${blocker.file}:${blocker.line}${styles.reset}`);
    });
    console.log('');
  }

  console.log(`  ${styles.bold}Next best action:${styles.reset} ${styles.bold}${result.nextActions[0] || 'guardrail ship'}${styles.reset}`);
  
  if (details && result.nextActions.length > 1) {
    console.log(`\n  ${styles.bold}All actions:${styles.reset}`);
    result.nextActions.forEach(action => {
      console.log(`    ${styles.cyan}${icons.bullet}${styles.reset} ${styles.bold}${action}${styles.reset}`);
    });
  }
  console.log('');
}

function outputPlain(result: ScanResult): void {
  console.log(`Verdict: ${result.verdict}`);
  if (result.issueDetailsRedacted) {
    console.log(`Note: Free plan — ${result.upgradeHint ?? "upgrade for full finding details"}`);
  }
  console.log(`Total Findings: ${result.summary.totalFindings}`);
  console.log(`Critical: ${result.summary.critical}, High: ${result.summary.high}, Medium: ${result.summary.medium}, Low: ${result.summary.low}`);
  
  if (result.topBlockers.length > 0) {
    console.log('\nTop Blockers:');
    result.topBlockers.forEach(blocker => {
      console.log(`  ${blocker.id}: ${blocker.type} - ${blocker.file}:${blocker.line}`);
    });
  }
  
  console.log(`\nNext best action: ${result.nextActions[0] || 'guardrail ship'}`);
}

function getVerdictColor(verdict: 'PASS' | 'FAIL' | 'WARN'): string {
  switch (verdict) {
    case 'PASS':
      return styles.brightGreen;
    case 'FAIL':
      return styles.brightRed;
    case 'WARN':
      return styles.brightYellow;
  }
}

function generateHotspotsMarkdown(result: ScanResult): string {
  let md = '# guardrail Hotspots\n\n';
  md += `Generated: ${result.timestamp}\n\n`;
  if (result.issueDetailsRedacted) {
    md += `## Top Risk Files\n\n`;
    md += `_File paths hidden on Free plan. Upgrade for per-file hotspots._\n\n`;
    md += `Severity counts are in the main scan summary.\n`;
    return md;
  }
  md += `## Top Risk Files\n\n`;

  result.hotspots.forEach((hotspot, i) => {
    md += `${i + 1}. **${hotspot.file}**\n`;
    md += `   - Score: ${hotspot.score}\n`;
    md += `   - Findings: ${hotspot.findings}\n\n`;
  });

  return md;
}

// Export for use in other files
export { getNextActions, outputHumanReadable, generateHotspotsMarkdown };
