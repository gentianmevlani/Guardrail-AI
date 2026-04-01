/**
 * Advanced Lexical Reality Scan
 * 
 * Lightning-fast first-pass sweep for AI artifacts + landmines
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, resolve } from 'path';
import type { TruthPackScoringIndex } from './truth-pack-scoring';
import { normalizeRepoPath } from './truth-pack-scoring';

export interface RealityFinding {
  id: string; // GR-REALITY-001 format
  type: 'placeholder' | 'stub' | 'fake_success' | 'silent_failure' | 'auth_bypass' | 'dangerous_default';
  file: string;
  line: number;
  column?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  score: number; // For escalation system
  evidence: {
    snippet: string;
    context: string;
    pattern: string;
  };
  fixGuidance?: string;
  verifyCommand?: string;
  /** When Truth Pack indices exist, findings in hot routes/symbols get weighted scores */
  truthPack?: {
    weight: number;
    importanceNorm: number;
    routeCount: number;
    symbolCount: number;
  };
}

export interface RealityScanResult {
  findings: RealityFinding[];
  hotspots: Array<{
    file: string;
    score: number;
    findings: number;
  }>;
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    totalScore: number;
<<<<<<< HEAD
    filesScanned: number;
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  };
  /** Stats when Truth Pack weighting was applied */
  truthPackScoring?: {
    applied: boolean;
    filesWeighted: number;
    maxWeight: number;
    weightedFindings: number;
  };
}

// Placeholder patterns
const PLACEHOLDER_PATTERNS = [
  /\bplaceholder\b/i,
  /\bstub\b/i,
  /\bdummy\b/i,
  /\bfake\b/i,
  /\bsample\b/i,
  /\bprototype\b/i,
  /\bpoc\b/i,
  /\bhardcoded\b/i,
  /\bTODO\b.*(?:implement|fix|complete)/i,
  /\bWIP\b/i,
  /\bTBD\b/i,
  /\bNYI\b/i,
  /\bcoming\s+soon\b/i,
  /\bbest\s+effort\b/i,
  /\bfallback\b/i,
  /\bgracefully\b/i,
];

// Fake success patterns
const FAKE_SUCCESS_PATTERNS = [
  /return\s+(?:true|"ok"|"success"|{[\s\S]*?success:\s*true)/i,
  /status:\s*["']ok["']/i,
  /ok:\s*true/i,
  /success:\s*true/i,
];

// Silent failure patterns
const SILENT_FAILURE_PATTERNS = [
  /catch\s*\(\s*\)\s*{\s*}/, // empty catch {}
  /catch\s*\(\s*e\s*\)\s*{\s*}/, // empty catch (e) {}
  /catch\s*\([^)]*\)\s*{\s*return\s*;?\s*}/, // catch that just returns
  /catch\s*\([^)]*\)\s*{\s*console\.(log|error|warn)/, // catch that only logs
];

// Auth bypass patterns
const AUTH_BYPASS_PATTERNS = [
  /\bowner\s*mode\b/i,
  /\badmin\s*mode\b/i,
  /\bskipAuth\b/i,
  /\bdisableAuth\b/i,
  /\bbypassAuth\b/i,
  /\bisAdmin\s*=\s*true\b/i,
  /\bALLOW_ALL\b/i,
  /\bUI-only\s*gating\b/i,
];

// Dangerous defaults
const DANGEROUS_DEFAULT_PATTERNS = [
  /process\.env\.\w+\s*\|\|\s*["'](?:test|localhost|example\.com|CHANGEME|REPLACE_ME|YOUR_API_KEY)["']/i,
  /process\.env\.\w+\s*\|\|\s*["']\s*["']/, // empty string default
  /\bCHANGEME\b/i,
  /\bREPLACE_ME\b/i,
  /\bYOUR_API_KEY\b/i,
  /\bexample\.com\b/i,
  /localhost.*(?:auth|billing|webhook|secret)/i,
];

export class RealitySniffScanner {
  private findings: RealityFinding[] = [];
  private fileScores: Map<string, number> = new Map();
  private findingCounter = 1;
  private projectRoot = '';
  private truthPackScoring: TruthPackScoringIndex | null = null;
<<<<<<< HEAD
  private scannedFileCount = 0;
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

  /**
   * Scan project for reality issues
   */
  async scan(projectPath: string, options: {
    exclude?: string[];
    includeTests?: boolean;
    /** Optional: weight findings using `.guardrail-context` symbol/route/importance data */
    truthPackScoring?: TruthPackScoringIndex | null;
  } = {}): Promise<RealityScanResult> {
    this.findings = [];
    this.fileScores.clear();
    this.findingCounter = 1;
<<<<<<< HEAD
    this.scannedFileCount = 0;
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    this.projectRoot = resolve(projectPath);
    this.truthPackScoring = options.truthPackScoring ?? null;

    const exclude = options.exclude || ['node_modules', '.git', 'dist', 'build', '.next'];
    const includeTests = options.includeTests || false;

    // Scan all code files
    await this.scanDirectory(projectPath, exclude, includeTests);

    // Calculate hotspots
    const hotspots = Array.from(this.fileScores.entries())
      .map(([file, score]) => ({
        file,
        score,
        findings: this.findings.filter(f => f.file === file).length,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Calculate summary
    const summary = {
      total: this.findings.length,
      critical: this.findings.filter(f => f.severity === 'critical').length,
      high: this.findings.filter(f => f.severity === 'high').length,
      medium: this.findings.filter(f => f.severity === 'medium').length,
      low: this.findings.filter(f => f.severity === 'low').length,
      totalScore: this.findings.reduce((sum, f) => sum + f.score, 0),
<<<<<<< HEAD
      filesScanned: this.scannedFileCount,
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    };

    const truthPackScoring = this.buildTruthPackScoringStats();

    return {
      findings: this.findings.sort((a, b) => b.score - a.score),
      hotspots,
      summary,
      ...(truthPackScoring ? { truthPackScoring } : {}),
    };
  }

  private buildTruthPackScoringStats(): RealityScanResult['truthPackScoring'] {
    if (!this.truthPackScoring) {
      return undefined;
    }
    const weighted = this.findings.filter(f => f.truthPack && f.truthPack.weight > 1.001);
    if (weighted.length === 0) {
      return {
        applied: true,
        filesWeighted: 0,
        maxWeight: 1,
        weightedFindings: 0,
      };
    }
    const files = new Set(weighted.map(f => f.file));
    const wts = weighted.map(f => f.truthPack!.weight);
    const maxWeight = wts.length > 0 ? Math.max(...wts) : 1;
    return {
      applied: true,
      filesWeighted: files.size,
      maxWeight,
      weightedFindings: weighted.length,
    };
  }

  private computeTruthPackWeight(relativePath: string): {
    weight: number;
    importanceNorm: number;
    routeCount: number;
    symbolCount: number;
  } {
    if (!this.truthPackScoring) {
      return { weight: 1, importanceNorm: 0, routeCount: 0, symbolCount: 0 };
    }
    const { importanceNorm, routeCountByFile, symbolCountByFile } = this.truthPackScoring;
    const imp = importanceNorm.get(relativePath) ?? 0;
    const routeCount = routeCountByFile.get(relativePath) ?? 0;
    const symbolCount = symbolCountByFile.get(relativePath) ?? 0;
    const routeFactor = Math.min(routeCount / 8, 0.65);
    const symFactor = Math.min(symbolCount / 150, 0.45);
    const w = 1 + imp * 1.6 + routeFactor + symFactor;
    const weight = Math.min(Math.max(w, 1), 3);
    return { weight, importanceNorm: imp, routeCount, symbolCount };
  }

  private async scanDirectory(dir: string, exclude: string[], includeTests: boolean): Promise<void> {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      // Skip excluded directories
      if (stat.isDirectory()) {
        if (exclude.some(e => entry.includes(e))) continue;
        if (!includeTests && (entry.includes('test') || entry.includes('spec'))) continue;
        await this.scanDirectory(fullPath, exclude, includeTests);
        continue;
      }

      // Only scan code files
      const ext = extname(entry);
      if (!['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs'].includes(ext)) {
        continue;
      }

      await this.scanFile(fullPath);
    }
  }

  private async scanFile(filePath: string): Promise<void> {
    try {
<<<<<<< HEAD
      this.scannedFileCount += 1;
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Check each line for patterns
      lines.forEach((line, index) => {
        const lineNum = index + 1;

        // Placeholder detection
        this.checkPatterns(line, lineNum, filePath, PLACEHOLDER_PATTERNS, 'placeholder', 1, 'medium');

        // Fake success detection (higher score in catch/error handlers)
        const inErrorContext = this.isInErrorContext(content, index);
        this.checkPatterns(line, lineNum, filePath, FAKE_SUCCESS_PATTERNS, 'fake_success', inErrorContext ? 5 : 3, inErrorContext ? 'high' : 'medium');

        // Silent failure detection
        this.checkPatterns(line, lineNum, filePath, SILENT_FAILURE_PATTERNS, 'silent_failure', 5, 'high');

        // Auth bypass detection
        this.checkPatterns(line, lineNum, filePath, AUTH_BYPASS_PATTERNS, 'auth_bypass', 10, 'critical');

        // Dangerous defaults
        this.checkPatterns(line, lineNum, filePath, DANGEROUS_DEFAULT_PATTERNS, 'dangerous_default', 3, 'high');
      });
    } catch (error) {
      // Ignore files we can't read
    }
  }

  private checkPatterns(
    line: string,
    lineNum: number,
    filePath: string,
    patterns: RegExp[],
    type: RealityFinding['type'],
    baseScore: number,
    severity: RealityFinding['severity']
  ): void {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const rel = normalizeRepoPath(this.projectRoot, filePath);
        const tp = this.computeTruthPackWeight(rel);
        const weightedScore = Math.round(baseScore * tp.weight);

        const finding: RealityFinding = {
          id: `GR-REALITY-${String(this.findingCounter++).padStart(3, '0')}`,
          type,
          file: filePath,
          line: lineNum,
          severity,
          score: weightedScore,
          evidence: {
            snippet: line.trim(),
            context: this.getContext(line, filePath),
            pattern: pattern.source,
          },
          fixGuidance: this.getFixGuidance(type),
          verifyCommand: `guardrail verify --id GR-REALITY-${String(this.findingCounter - 1).padStart(3, '0')}`,
          ...(this.truthPackScoring && tp.weight > 1
            ? {
                truthPack: {
                  weight: Math.round(tp.weight * 100) / 100,
                  importanceNorm: Math.round(tp.importanceNorm * 1000) / 1000,
                  routeCount: tp.routeCount,
                  symbolCount: tp.symbolCount,
                },
              }
            : {}),
        };

        this.findings.push(finding);

        // Update file score
        const currentScore = this.fileScores.get(filePath) || 0;
        this.fileScores.set(filePath, currentScore + weightedScore);
      }
    }
  }

  private isInErrorContext(content: string, lineIndex: number): boolean {
    const lines = content.split('\n');
    const beforeContext = lines.slice(Math.max(0, lineIndex - 5), lineIndex).join('\n');
    return /catch|onError|fallback|error|exception/i.test(beforeContext);
  }

  private getContext(line: string, filePath: string): string {
    // Return surrounding context (simplified)
    return line.trim();
  }

  private getFixGuidance(type: RealityFinding['type']): string {
    const guidance: Record<RealityFinding['type'], string> = {
      placeholder: 'Replace placeholder with actual implementation',
      stub: 'Implement stub function with real logic',
      fake_success: 'Return actual error status instead of always true',
      silent_failure: 'Add proper error handling and propagation',
      auth_bypass: 'Remove auth bypass or add proper permission checks',
      dangerous_default: 'Use secure defaults or require explicit configuration',
    };
    return guidance[type] || 'Review and fix';
  }
}
