/**
 * allowlist.ts
 * Manage allowlisted secret detections via SHA256 fingerprints
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export class Allowlist {
  private fingerprints = new Set<string>();

  constructor(private readonly projectPath: string) {
    this.load();
  }

  /**
   * Load allowlist from .guardrail/secrets.allowlist
   */
  private load(): void {
    const allowlistPath = this.getAllowlistPath();
    
    if (!existsSync(allowlistPath)) {
      return;
    }

    try {
      const content = readFileSync(allowlistPath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }
        
        // Validate SHA256 format (64 hex chars)
        if (/^[a-f0-9]{64}$/i.test(trimmed)) {
          this.fingerprints.add(trimmed.toLowerCase());
        }
      }
    } catch (err) {
      // Silently ignore read errors
    }
  }

  /**
   * Check if a fingerprint is allowlisted
   */
  isAllowlisted(fingerprint: string): boolean {
    return this.fingerprints.has(fingerprint.toLowerCase());
  }

  /**
   * Add a fingerprint to the allowlist
   */
  add(fingerprint: string): void {
    if (!/^[a-f0-9]{64}$/i.test(fingerprint)) {
      throw new Error(`Invalid fingerprint format: ${fingerprint}`);
    }
    this.fingerprints.add(fingerprint.toLowerCase());
  }

  /**
   * Add multiple fingerprints from a baseline file
   */
  addFromBaseline(baselinePath: string): number {
    if (!existsSync(baselinePath)) {
      throw new Error(`Baseline file not found: ${baselinePath}`);
    }

    let added = 0;
    try {
      const content = readFileSync(baselinePath, 'utf-8');
      
      // Try to parse as JSON first (scan results format)
      try {
        const json = JSON.parse(content);
        if (json.findings && Array.isArray(json.findings)) {
          for (const finding of json.findings) {
            if (finding.fingerprint) {
              this.add(finding.fingerprint);
              added++;
            }
          }
          return added;
        }
      } catch {
        // Not JSON, try line-by-line
      }

      // Parse as line-delimited fingerprints
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && /^[a-f0-9]{64}$/i.test(trimmed)) {
          this.add(trimmed);
          added++;
        }
      }
    } catch (err) {
      throw new Error(`Failed to read baseline file: ${(err as Error).message}`);
    }

    return added;
  }

  /**
   * Save allowlist to disk
   */
  save(): void {
    const allowlistPath = this.getAllowlistPath();
    const dir = dirname(allowlistPath);
    
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const lines = [
      '# guardrail Secrets Allowlist',
      '# SHA256 fingerprints of approved/suppressed detections',
      '# One fingerprint per line',
      '',
      ...Array.from(this.fingerprints).sort(),
    ];

    writeFileSync(allowlistPath, lines.join('\n'), 'utf-8');
  }

  /**
   * Get the allowlist file path
   */
  private getAllowlistPath(): string {
    return join(this.projectPath, '.guardrail', 'secrets.allowlist');
  }

  /**
   * Get count of allowlisted items
   */
  size(): number {
    return this.fingerprints.size;
  }
}
