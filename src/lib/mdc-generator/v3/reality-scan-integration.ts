/**
 * Reality Scan Integration
 * 
 * Integrates Reality scan findings into MDC packs:
 * - Runs scan on changed files
 * - Extracts findings (FAIL/WARN/INFO)
 * - Embeds "Hotspots" section in packs
 */

import { RealitySniffScanner, RealitySniffResult, ScanOptions } from '../../reality-sniff/reality-sniff-scanner';
import { ChangedFile } from './change-aware-selector';

export interface RealityScanIntegration {
  scanResult: RealitySniffResult;
  hotspots: Array<{
    file: string;
    line: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    rule: string;
    message: string;
  }>;
}

export interface RealityScanOptions {
  projectPath: string;
  changedFiles?: ChangedFile[];
  layers?: {
    lexical?: boolean;
    structural?: boolean;
    runtime?: boolean;
  };
}

export class RealityScanIntegrator {
  /**
   * Run Reality scan and extract hotspots
   */
  static async scanAndExtractHotspots(
    options: RealityScanOptions
  ): Promise<RealityScanIntegration> {
    const scanOptions: ScanOptions = {
      projectPath: options.projectPath,
      layers: {
        lexical: true,
        structural: false,
        runtime: false,
        ...options.layers,
      },
      verbose: false,
    };

    // If changed files provided, focus scan on those
    if (options.changedFiles && options.changedFiles.length > 0) {
      // Extract file paths
      const filePaths = options.changedFiles
        .filter(f => f.status !== 'deleted')
        .map(f => f.relativePath);
      
      // Note: RealitySniffScanner doesn't support file filtering yet
      // This would need to be added or we scan all and filter results
    }

    const scanner = new RealitySniffScanner(scanOptions);
    const scanResult = await scanner.scan();

    // Extract top hotspots (FAIL + high severity WARN)
    const hotspots = scanResult.findings
      .filter(f => 
        f.verdict === 'FAIL' || 
        (f.verdict === 'WARN' && (f.severity === 'critical' || f.severity === 'high'))
      )
      .slice(0, 20) // Top 20
      .map(f => ({
        file: f.file,
        line: f.line,
        severity: f.severity,
        rule: f.ruleName,
        message: f.message,
      }));

    return {
      scanResult,
      hotspots,
    };
  }

  /**
   * Format hotspots as markdown section
   */
  static formatHotspotsAsMarkdown(integration: RealityScanIntegration): string {
    const lines: string[] = [];

    lines.push('## Reality Scan Hotspots');
    lines.push('');
    lines.push(`**Scan Verdict:** ${integration.scanResult.verdict}`);
    lines.push(`**Total Findings:** ${integration.scanResult.findings.length}`);
    lines.push(`**Blockers (FAIL):** ${integration.scanResult.blockers.length}`);
    lines.push(`**Warnings:** ${integration.scanResult.warnings.length}`);
    lines.push('');

    if (integration.hotspots.length === 0) {
      lines.push('✅ No critical hotspots found.');
      lines.push('');
      return lines.join('\n');
    }

    lines.push('### Top Hotspots');
    lines.push('');
    lines.push('| File | Line | Severity | Rule | Message |');
    lines.push('|------|------|----------|------|---------|');

    for (const hotspot of integration.hotspots) {
      const fileLink = `\`${hotspot.file}\``;
      const severityEmoji = 
        hotspot.severity === 'critical' ? '🚨' :
        hotspot.severity === 'high' ? '⚠️' :
        hotspot.severity === 'medium' ? '⚡' : 'ℹ️';
      
      lines.push(
        `| ${fileLink} | ${hotspot.line} | ${severityEmoji} ${hotspot.severity} | ${hotspot.rule} | ${hotspot.message.substring(0, 60)}... |`
      );
    }

    lines.push('');
    lines.push('> **Note:** These are the top findings from Reality scan. Review and fix blockers before proceeding.');
    lines.push('');

    return lines.join('\n');
  }
}
