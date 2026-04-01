/**
 * Scan Command — runs all 20 engines against target files
 * Powered by VibeCheck engines + Guardrail exclusive engines.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DeltaContext, Finding } from '@guardrail/engines';
import {
  createGuardrailRegistry,
  type GuardrailScanResult,
} from '../lib/guardrail-scan-adapter.js';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '\x1b[31m',  // red
  high: '\x1b[33m',      // yellow
  medium: '\x1b[36m',    // cyan
  low: '\x1b[90m',       // gray
  info: '\x1b[90m',      // gray
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

export class ScanCommand {
  private adapter = createGuardrailRegistry();

  async execute(
    targetPath: string,
    options: Record<string, string | boolean> = {}
  ): Promise<GuardrailScanResult[]> {
    const startTime = Date.now();
    const files = this.collectFiles(targetPath);

    if (files.length === 0) {
      console.log('No scannable files found.');
      return [];
    }

    if (!options['quiet']) {
      console.log(`\n${BOLD}┌─────────────────────────────────────────────┐${RESET}`);
      console.log(`${BOLD}│  GUARDRAIL SCAN — Powered by VibeCheck      │${RESET}`);
      console.log(`${BOLD}└─────────────────────────────────────────────┘${RESET}\n`);
      console.log(`${DIM}Scanning ${files.length} file(s) with ${this.adapter.getEngineStats().length} engines...${RESET}\n`);
    }

    await this.adapter.activate();

    const results: GuardrailScanResult[] = [];
    const engineIds = typeof options['engines'] === 'string'
      ? options['engines'].split(',')
      : undefined;

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath);
      const languageId = this.extToLanguage(ext);

      const delta: DeltaContext = {
        documentUri: filePath,
        documentLanguage: languageId,
        fullText: content,
        changedRanges: [{ start: 0, end: content.length }],
        changedText: content,
      };

      const result = await this.adapter.scan(delta, {
        engines: engineIds ?? null,
        minSeverity: (options['min-severity'] as string) || undefined,
        initiatedBy: 'cli',
      });

      results.push(result);

      if (!options['quiet'] && result.findings.length > 0) {
        this.printFileFindings(filePath, result.findings);
      }
    }

    const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
    const totalBlocked = results.filter(r => r.blocked).length;
    const elapsed = Date.now() - startTime;

    if (!options['quiet']) {
      this.printSummary(files.length, totalFindings, totalBlocked, elapsed, results);
    }

    if (options['format'] === 'json') {
      console.log(JSON.stringify(results, null, 2));
    }

    if (options['scoreOnly']) {
      this.printTrustScore(results);
    }

    this.adapter.dispose();
    return results;
  }

  showStatus(): void {
    console.log(`\n${BOLD}Engine Status${RESET}\n`);
    const stats = this.adapter.getEngineStats();
    for (const engine of stats) {
      const status = engine.enabled ? '\x1b[32m● enabled\x1b[0m' : '\x1b[31m○ disabled\x1b[0m';
      console.log(`  ${engine.id.padEnd(30)} ${status}`);
    }
    console.log(`\n  Total: ${stats.length} engines (${stats.filter(e => e.enabled).length} active)\n`);
  }

  showAuditLog(): void {
    const log = this.adapter.getAuditLog();
    if (log.length === 0) {
      console.log('No audit entries yet.');
      return;
    }
    console.log(`\n${BOLD}Audit Log${RESET} (${log.length} entries)\n`);
    for (const entry of log.slice(-20)) {
      const status = entry.blocked ? '\x1b[31mBLOCKED\x1b[0m' : '\x1b[32mPASSED\x1b[0m';
      console.log(`  ${entry.timestamp.toISOString()} | ${status} | ${entry.findingCount} findings | ${entry.documentUri}`);
    }
  }

  private printFileFindings(filePath: string, findings: Finding[]): void {
    const rel = path.relative(process.cwd(), filePath);
    console.log(`${BOLD}${rel}${RESET}`);
    for (const f of findings) {
      const color = SEVERITY_COLORS[f.severity] || '';
      console.log(`  ${color}${f.severity.toUpperCase().padEnd(9)}${RESET} L${f.line}  ${f.message}`);
      if (f.suggestion) {
        console.log(`${DIM}           ↳ ${f.suggestion}${RESET}`);
      }
    }
    console.log('');
  }

  private printSummary(
    fileCount: number,
    totalFindings: number,
    blocked: number,
    elapsedMs: number,
    results: GuardrailScanResult[]
  ): void {
    const bySeverity: Record<string, number> = {};
    for (const r of results) {
      for (const f of r.findings) {
        bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
      }
    }

    console.log(`${BOLD}─── Summary ───${RESET}`);
    console.log(`  Files scanned:  ${fileCount}`);
    console.log(`  Total findings: ${totalFindings}`);
    if (bySeverity['critical']) console.log(`  ${SEVERITY_COLORS['critical']}Critical: ${bySeverity['critical']}${RESET}`);
    if (bySeverity['high']) console.log(`  ${SEVERITY_COLORS['high']}High:     ${bySeverity['high']}${RESET}`);
    if (bySeverity['medium']) console.log(`  ${SEVERITY_COLORS['medium']}Medium:   ${bySeverity['medium']}${RESET}`);
    if (bySeverity['low']) console.log(`  ${SEVERITY_COLORS['low']}Low:      ${bySeverity['low']}${RESET}`);
    console.log(`  Blocked files:  ${blocked}`);
    console.log(`  Duration:       ${elapsedMs}ms`);

    const violations = results.flatMap(r => r.policyViolations);
    if (violations.length > 0) {
      console.log(`\n${BOLD}Policy Violations:${RESET}`);
      for (const v of violations) {
        console.log(`  ${SEVERITY_COLORS[v.severity] || ''}[${v.ruleId}]${RESET} ${v.message}`);
      }
    }
    console.log('');
  }

  private printTrustScore(results: GuardrailScanResult[]): void {
    const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
    const critical = results.reduce((sum, r) => sum + r.findings.filter(f => f.severity === 'critical').length, 0);
    const high = results.reduce((sum, r) => sum + r.findings.filter(f => f.severity === 'high').length, 0);

    // Simple trust score calculation
    let score = 100;
    score -= critical * 15;
    score -= high * 5;
    score -= (totalFindings - critical - high) * 1;
    score = Math.max(0, Math.min(100, score));

    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
    const decision = score >= 80 ? 'SHIP' : score >= 60 ? 'REVIEW' : 'NO_SHIP';

    console.log(`\n${BOLD}Trust Score: ${score}/100 (${grade}) — ${decision}${RESET}\n`);
  }

  private collectFiles(targetPath: string): string[] {
    const resolved = path.resolve(targetPath);
    const stat = fs.statSync(resolved, { throwIfNoEntry: false });
    if (!stat) return [];
    if (stat.isFile()) return [resolved];

    const files: string[] = [];
    const SCAN_EXTENSIONS = new Set([
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.py', '.go', '.rs', '.java', '.rb',
    ]);
    const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__']);

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name))) {
          files.push(full);
        }
      }
    };

    walk(resolved);
    return files;
  }

  private extToLanguage(ext: string): string {
    const map: Record<string, string> = {
      '.ts': 'typescript', '.tsx': 'typescriptreact',
      '.js': 'javascript', '.jsx': 'javascriptreact',
      '.mjs': 'javascript', '.cjs': 'javascript',
      '.py': 'python', '.go': 'go', '.rs': 'rust',
      '.java': 'java', '.rb': 'ruby',
    };
    return map[ext] || 'plaintext';
  }
}
