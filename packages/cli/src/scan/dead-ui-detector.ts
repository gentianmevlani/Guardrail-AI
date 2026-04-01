/**
 * No Dead UI Static Gate
 * 
 * Fast pre-test gate that blocks obvious deadness:
 * - href="#"
 * - noop onClick={() => {}}
 * - "coming soon" UI in prod surfaces
 * - disabled buttons without reason text
 * - raw fetch("/api/...") in components
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

export interface DeadUIFinding {
  id: string; // GR-UI-001 format
  type: 'dead_link' | 'noop_handler' | 'coming_soon' | 'disabled_no_reason' | 'raw_fetch';
  file: string;
  line: number;
  column?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  issue: string;
  suggestion: string;
}

export interface DeadUIScanResult {
  findings: DeadUIFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// Dead link patterns
const DEAD_LINK_PATTERNS = [
  /href=["']#["']/g,
  /href=["']javascript:void\(0\)["']/g,
  /href=["']#!["']/g,
  /href=["']\/#["']/g,
];

// Noop handler patterns
const NOOP_HANDLER_PATTERNS = [
  /onClick\s*=\s*{\s*\(\)\s*=>\s*\{\s*\}\s*\}/g,
  /onClick\s*=\s*{\s*\(\)\s*=>\s*\{\s*return\s*;?\s*\}\s*\}/g,
  /onClick\s*=\s*{\s*\(\)\s*=>\s*undefined\s*}/g,
  /onClick\s*=\s*{\s*\(\)\s*=>\s*null\s*}/g,
  /onClick\s*=\s*{\s*\(\)\s*=>\s*void\s*0\s*}/g,
];

// Coming soon patterns
const COMING_SOON_PATTERNS = [
  /coming\s+soon/gi,
  /coming\s+later/gi,
  /not\s+available/gi,
  /under\s+construction/gi,
  /work\s+in\s+progress/gi,
  /wip/gi,
];

// Disabled button without reason
const DISABLED_NO_REASON_PATTERNS = [
  /disabled\s*(?!.*(?:reason|tooltip|title|aria-label|aria-describedby))/gi,
];

// Raw fetch in components
const RAW_FETCH_PATTERNS = [
  /fetch\s*\(\s*["']\/api\//g,
  /fetch\s*\(\s*`\/api\//g,
  /axios\s*\.\s*(get|post|put|delete)\s*\(\s*["']\/api\//g,
];

export class DeadUIDetector {
  private findings: DeadUIFinding[] = [];
  private findingCounter = 1;

  /**
   * Scan for dead UI issues
   */
  async scan(projectPath: string, options: {
    exclude?: string[];
    includeTests?: boolean;
  } = {}): Promise<DeadUIScanResult> {
    this.findings = [];
    this.findingCounter = 1;

    const exclude = options.exclude || ['node_modules', '.git', 'dist', 'build', '.next'];
    const includeTests = options.includeTests || false;

    // Scan UI files
    await this.scanDirectory(projectPath, exclude, includeTests);

    // Calculate summary
    const summary = {
      total: this.findings.length,
      critical: this.findings.filter(f => f.severity === 'critical').length,
      high: this.findings.filter(f => f.severity === 'high').length,
      medium: this.findings.filter(f => f.severity === 'medium').length,
      low: this.findings.filter(f => f.severity === 'low').length,
    };

    return {
      findings: this.findings,
      summary,
    };
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

      // Only scan UI files
      const ext = extname(entry);
      if (!['.tsx', '.jsx', '.ts', '.js', '.vue', '.svelte'].includes(ext)) {
        continue;
      }

      await this.scanFile(fullPath);
    }
  }

  private async scanFile(filePath: string): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Check each line for patterns
      lines.forEach((line, index) => {
        const lineNum = index + 1;

        // Dead link detection
        this.checkPatterns(
          line,
          lineNum,
          filePath,
          DEAD_LINK_PATTERNS,
          'dead_link',
          'high',
          'Dead link detected (href="#")'
        );

        // Noop handler detection
        this.checkPatterns(
          line,
          lineNum,
          filePath,
          NOOP_HANDLER_PATTERNS,
          'noop_handler',
          'high',
          'No-op click handler detected'
        );

        // Coming soon detection (only in non-test files)
        if (!filePath.includes('test') && !filePath.includes('spec')) {
          this.checkPatterns(
            line,
            lineNum,
            filePath,
            COMING_SOON_PATTERNS,
            'coming_soon',
            'medium',
            'Coming soon UI in production code'
          );
        }

        // Disabled button without reason
        if (line.includes('disabled') && !this.hasReasonText(line)) {
          this.addFinding({
            id: `GR-UI-${String(this.findingCounter++).padStart(3, '0')}`,
            type: 'disabled_no_reason',
            file: filePath,
            line: lineNum,
            severity: 'medium',
            issue: 'Disabled button without reason text',
            suggestion: 'Add tooltip, aria-label, or reason text explaining why button is disabled',
          });
        }

        // Raw fetch detection
        this.checkPatterns(
          line,
          lineNum,
          filePath,
          RAW_FETCH_PATTERNS,
          'raw_fetch',
          'low',
          'Raw API fetch in component (consider using action registry)'
        );
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
    type: DeadUIFinding['type'],
    severity: DeadUIFinding['severity'],
    issue: string
  ): void {
    for (const pattern of patterns) {
      const matches = line.matchAll(new RegExp(pattern.source, pattern.flags));
      for (const match of matches) {
        this.addFinding({
          id: `GR-UI-${String(this.findingCounter++).padStart(3, '0')}`,
          type,
          file: filePath,
          line: lineNum,
          severity,
          issue,
          suggestion: this.getSuggestion(type),
        });
      }
    }
  }

  private hasReasonText(line: string): boolean {
    // Check if line has reason text (tooltip, aria-label, etc.)
    return /(tooltip|aria-label|aria-describedby|title|reason|why|disabled.*because)/i.test(line);
  }

  private addFinding(finding: DeadUIFinding): void {
    this.findings.push(finding);
  }

  private getSuggestion(type: DeadUIFinding['type']): string {
    const suggestions: Record<DeadUIFinding['type'], string> = {
      dead_link: 'Replace with actual route or remove if not needed',
      noop_handler: 'Implement actual handler or remove onClick',
      coming_soon: 'Remove or implement the feature',
      disabled_no_reason: 'Add tooltip, aria-label, or reason text',
      raw_fetch: 'Use action registry or typed API client',
    };
    return suggestions[type] || 'Review and fix';
  }
}
