/**
 * Baseline support for suppressing known findings
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';

export interface BaselineFinding {
  fingerprint: string;
  category: string;
  title: string;
  file: string;
  line: number;
  suppressedAt: string;
}

export interface Baseline {
  version: string;
  createdAt: string;
  findings: BaselineFinding[];
}

export interface Finding {
  type?: string;
  category?: string;
  title: string;
  file: string;
  line: number;
  match?: string;
  snippet?: string;
}

export class BaselineManager {
  /**
   * Generate stable fingerprint for a finding
   * fingerprint = sha256(category + title + file + line + snippetNormalized)
   */
  static generateFingerprint(finding: Finding): string {
    const category = finding.category || finding.type || 'unknown';
    const title = finding.title || '';
    const file = finding.file || '';
    const line = finding.line || 0;
    
    // Normalize snippet by removing whitespace variations
    let snippet = finding.snippet || finding.match || '';
    snippet = snippet.replace(/\s+/g, ' ').trim();
    
    const data = `${category}:${title}:${file}:${line}:${snippet}`;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Load baseline from file
   */
  static loadBaseline(path: string): Baseline | null {
    if (!existsSync(path)) {
      return null;
    }

    try {
      const content = readFileSync(path, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Save baseline to file
   */
  static saveBaseline(path: string, findings: Finding[]): void {
    const baseline: Baseline = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      findings: findings.map(f => ({
        fingerprint: this.generateFingerprint(f),
        category: f.category || f.type || 'unknown',
        title: f.title,
        file: f.file,
        line: f.line,
        suppressedAt: new Date().toISOString(),
      })),
    };

    writeFileSync(path, JSON.stringify(baseline, null, 2), 'utf8');
  }

  /**
   * Check if a finding is suppressed by baseline
   */
  static isSuppressed(finding: Finding, baseline: Baseline | null): boolean {
    if (!baseline) {
      return false;
    }

    const fingerprint = this.generateFingerprint(finding);
    return baseline.findings.some(bf => bf.fingerprint === fingerprint);
  }

  /**
   * Filter findings by baseline
   */
  static filterFindings<T extends Finding>(findings: T[], baselinePath?: string): { filtered: T[]; suppressed: number } {
    if (!baselinePath) {
      return { filtered: findings, suppressed: 0 };
    }

    const baseline = this.loadBaseline(baselinePath);
    if (!baseline) {
      return { filtered: findings, suppressed: 0 };
    }

    const filtered = findings.filter(f => !this.isSuppressed(f, baseline));
    const suppressed = findings.length - filtered.length;

    return { filtered, suppressed };
  }
}
