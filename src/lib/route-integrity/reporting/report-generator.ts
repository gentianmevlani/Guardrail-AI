/**
 * Phase 5.3: Report Generator
 * 
 * Generates output in multiple formats:
 * - route-integrity-report.md (human-readable)
 * - route-integrity.json (machine-readable)
 * - route-integrity.sarif (GitHub code scanning)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  RouteIntegrityReport,
  SarifReport,
  SarifRun,
  SarifDriver,
  SarifResult,
  SarifRule,
  RouteVerdict,
  LinkVerdict,
  ShipBlocker,
} from '../types';

export class ReportGenerator {
  constructor(private report: RouteIntegrityReport, private outputDir: string) {}

  async generateAll(): Promise<{ md: string; json: string; sarif: string }> {
    const mdPath = await this.generateMarkdown();
    const jsonPath = await this.generateJson();
    const sarifPath = await this.generateSarif();

    return { md: mdPath, json: jsonPath, sarif: sarifPath };
  }

  async generateMarkdown(): Promise<string> {
    const md = this.buildMarkdownReport();
    const outputPath = path.join(this.outputDir, 'route-integrity-report.md');
    
    await this.ensureDir(this.outputDir);
    await fs.promises.writeFile(outputPath, md, 'utf8');
    
    return outputPath;
  }

  async generateJson(): Promise<string> {
    const outputPath = path.join(this.outputDir, 'route-integrity.json');
    
    await this.ensureDir(this.outputDir);
    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(this.report, this.jsonReplacer, 2),
      'utf8'
    );
    
    return outputPath;
  }

  async generateSarif(): Promise<string> {
    const sarif = this.buildSarifReport();
    const outputPath = path.join(this.outputDir, 'route-integrity.sarif');
    
    await this.ensureDir(this.outputDir);
    await fs.promises.writeFile(outputPath, JSON.stringify(sarif, null, 2), 'utf8');
    
    return outputPath;
  }

  private buildMarkdownReport(): string {
    const lines: string[] = [];
    const { score, shipBlockers, coverageMap, routeVerdicts, linkVerdicts, placeholders } = this.report;

    lines.push('# Route Integrity Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date(this.report.timestamp).toLocaleString()}`);
    lines.push(`**Project:** ${this.report.projectPath}`);
    lines.push(`**Execution Time:** ${this.report.executionTime}ms`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| **Overall Score** | ${score.overall}/100 (${score.grade}) |`);
    lines.push(`| **Confidence** | ${score.confidence}% |`);
    lines.push(`| **Route Coverage** | ${coverageMap.coveragePercent}% |`);
    lines.push(`| **Total Routes** | ${coverageMap.totalShippedRoutes} |`);
    lines.push(`| **Reachable from Root** | ${coverageMap.reachableFromRoot} |`);
    lines.push('');

    lines.push('### Score Breakdown');
    lines.push('');
    lines.push('| Category | Count | Penalty |');
    lines.push('|----------|-------|---------|');
    lines.push(`| Dead Links | ${score.breakdown.deadLinks.count} | -${score.breakdown.deadLinks.penalty} |`);
    lines.push(`| Orphan Routes | ${score.breakdown.orphanRoutes.count} | -${score.breakdown.orphanRoutes.penalty} |`);
    lines.push(`| Unresolved Dynamic | ${score.breakdown.unresolvedDynamic.count} | -${score.breakdown.unresolvedDynamic.penalty} |`);
    lines.push(`| Runtime Failures | ${score.breakdown.runtimeFailures.count} | -${score.breakdown.runtimeFailures.penalty} |`);
    lines.push(`| Placeholders | ${score.breakdown.placeholders.count} | -${score.breakdown.placeholders.penalty} |`);
    lines.push('');

    if (shipBlockers.length > 0) {
      lines.push('## 🚫 Ship Blockers');
      lines.push('');
      lines.push('These issues must be resolved before shipping:');
      lines.push('');

      for (const blocker of shipBlockers) {
        const severity = blocker.severity === 'critical' ? '🔴' : '🟠';
        lines.push(`### ${severity} ${blocker.title}`);
        lines.push('');
        lines.push(`- **Type:** ${blocker.type}`);
        lines.push(`- **Description:** ${blocker.description}`);
        if (blocker.file) {
          lines.push(`- **Location:** \`${blocker.file}${blocker.line ? `:${blocker.line}` : ''}\``);
        }
        if (blocker.fixSuggestion) {
          lines.push(`- **Fix:** ${blocker.fixSuggestion}`);
        }
        lines.push('');
      }
    }

    lines.push('## Route Analysis');
    lines.push('');

    const deadRoutes = routeVerdicts.filter(v => v.verdict === 'dead-runtime' || v.verdict === 'dead-static');
    const orphanRoutes = routeVerdicts.filter(v => v.verdict === 'orphan');
    const deadEndRoutes = routeVerdicts.filter(v => v.verdict === 'dead-end');
    const hiddenRoutes = routeVerdicts.filter(v => v.verdict === 'hidden-guarded');
    const healthyRoutes = routeVerdicts.filter(v => v.verdict === 'healthy');

    if (deadRoutes.length > 0) {
      lines.push('### Dead Routes');
      lines.push('');
      lines.push('| Pattern | Verdict | Certainty | Evidence |');
      lines.push('|---------|---------|-----------|----------|');
      for (const verdict of deadRoutes) {
        lines.push(`| \`${verdict.pattern}\` | ${verdict.verdict} | ${verdict.certainty} | ${verdict.evidence[0]?.description || ''} |`);
      }
      lines.push('');
    }

    if (orphanRoutes.length > 0) {
      lines.push('### Orphan Routes');
      lines.push('');
      lines.push('Routes that exist but have no incoming navigation:');
      lines.push('');
      for (const verdict of orphanRoutes) {
        lines.push(`- \`${verdict.pattern}\``);
      }
      lines.push('');
    }

    if (deadEndRoutes.length > 0) {
      lines.push('### Dead End Routes');
      lines.push('');
      lines.push('Routes with no outgoing navigation:');
      lines.push('');
      for (const verdict of deadEndRoutes) {
        lines.push(`- \`${verdict.pattern}\``);
      }
      lines.push('');
    }

    if (hiddenRoutes.length > 0) {
      lines.push('### Hidden/Guarded Routes');
      lines.push('');
      lines.push('Routes behind feature flags or auth:');
      lines.push('');
      for (const verdict of hiddenRoutes) {
        lines.push(`- \`${verdict.pattern}\``);
      }
      lines.push('');
    }

    lines.push(`### Healthy Routes: ${healthyRoutes.length}`);
    lines.push('');

    const deadLinks = linkVerdicts.filter(v => v.verdict === 'dead-runtime' || v.verdict === 'dead-static');
    const dynamicLinks = linkVerdicts.filter(v => v.verdict === 'dynamic-unresolved');

    if (deadLinks.length > 0) {
      lines.push('## Dead Links');
      lines.push('');
      lines.push('| Source File | Target | Verdict | Certainty |');
      lines.push('|-------------|--------|---------|-----------|');
      for (const verdict of deadLinks.slice(0, 20)) {
        const shortFile = path.basename(verdict.sourceFile);
        lines.push(`| \`${shortFile}\` | \`${verdict.targetHref}\` | ${verdict.verdict} | ${verdict.certainty} |`);
      }
      if (deadLinks.length > 20) {
        lines.push(`| ... | ${deadLinks.length - 20} more | ... | ... |`);
      }
      lines.push('');
    }

    if (dynamicLinks.length > 0) {
      lines.push('## Dynamic/Unresolved Links');
      lines.push('');
      lines.push('Links that need manual review:');
      lines.push('');
      for (const verdict of dynamicLinks.slice(0, 10)) {
        lines.push(`- \`${verdict.targetHref}\` in \`${path.basename(verdict.sourceFile)}\``);
      }
      if (dynamicLinks.length > 10) {
        lines.push(`- ... and ${dynamicLinks.length - 10} more`);
      }
      lines.push('');
    }

    if (placeholders.length > 0) {
      lines.push('## Placeholders Detected');
      lines.push('');
      
      const uiPlaceholders = placeholders.filter(p => p.type === 'ui-visible');
      const codePlaceholders = placeholders.filter(p => p.type !== 'ui-visible');

      if (uiPlaceholders.length > 0) {
        lines.push('### UI-Visible Placeholders (High Severity)');
        lines.push('');
        for (const p of uiPlaceholders.slice(0, 10)) {
          lines.push(`- "${p.text.slice(0, 50)}${p.text.length > 50 ? '...' : ''}" in \`${path.basename(p.location.file)}:${p.location.line}\``);
        }
        lines.push('');
      }

      if (codePlaceholders.length > 0) {
        lines.push('### Code Placeholders (Low Severity)');
        lines.push('');
        lines.push(`${codePlaceholders.length} placeholder strings found in code.`);
        lines.push('');
      }
    }

    lines.push('## Navigation Coverage Map');
    lines.push('');
    lines.push(`**${coverageMap.coveragePercent}%** of shipped routes are reachable from \`/\` via real links.`);
    lines.push('');

    if (coverageMap.isolatedClusters.length > 0) {
      lines.push('### Isolated Clusters');
      lines.push('');
      for (const cluster of coverageMap.isolatedClusters) {
        const authNote = cluster.requiresAuth ? ' (requires auth)' : '';
        lines.push(`- **${cluster.name}**${authNote}: ${cluster.nodeIds.length} routes`);
      }
      lines.push('');
    }

    if (coverageMap.unreachableRoutes.length > 0) {
      lines.push('### Unreachable Routes');
      lines.push('');
      for (const route of coverageMap.unreachableRoutes.slice(0, 10)) {
        lines.push(`- \`${route}\``);
      }
      if (coverageMap.unreachableRoutes.length > 10) {
        lines.push(`- ... and ${coverageMap.unreachableRoutes.length - 10} more`);
      }
      lines.push('');
    }

    lines.push('## Layers Executed');
    lines.push('');
    lines.push('| Layer | Executed | Duration | Findings |');
    lines.push('|-------|----------|----------|----------|');
    for (const layer of this.report.layers) {
      const status = layer.executed ? '✅' : '⏭️';
      lines.push(`| ${layer.layer.toUpperCase()} | ${status} | ${layer.duration}ms | ${layer.findings} |`);
    }
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push('*Generated by [guardrail](https://guardrail.dev) Route Integrity Scanner*');

    return lines.join('\n');
  }

  private buildSarifReport(): SarifReport {
    const rules = this.buildSarifRules();
    const results = this.buildSarifResults();

    const driver: SarifDriver = {
      name: 'guardrail Route Integrity',
      version: '1.0.0',
      informationUri: 'https://guardrail.dev/docs/route-integrity',
      rules,
    };

    const run: SarifRun = {
      tool: { driver },
      results,
    };

    return {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [run],
    };
  }

  private buildSarifRules(): SarifRule[] {
    return [
      {
        id: 'route-integrity/dead-runtime',
        name: 'RuntimeDeadRoute',
        shortDescription: { text: 'Route returns 404 at runtime' },
        fullDescription: { text: 'A route was found that returns HTTP 404 when accessed at runtime.' },
        defaultConfiguration: { level: 'error' },
      },
      {
        id: 'route-integrity/dead-static',
        name: 'StaticDeadLink',
        shortDescription: { text: 'Link points to non-existent route' },
        fullDescription: { text: 'A link href was found that does not match any route in the build manifest.' },
        defaultConfiguration: { level: 'error' },
      },
      {
        id: 'route-integrity/orphan',
        name: 'OrphanRoute',
        shortDescription: { text: 'Route has no incoming navigation' },
        fullDescription: { text: 'A route exists but cannot be reached via any navigation link.' },
        defaultConfiguration: { level: 'warning' },
      },
      {
        id: 'route-integrity/dead-end',
        name: 'DeadEndRoute',
        shortDescription: { text: 'Route has no outgoing navigation' },
        fullDescription: { text: 'A route loads successfully but has no links to other pages.' },
        defaultConfiguration: { level: 'warning' },
      },
      {
        id: 'route-integrity/placeholder',
        name: 'VisiblePlaceholder',
        shortDescription: { text: 'Placeholder text visible in UI' },
        fullDescription: { text: 'Placeholder or "coming soon" text is visible in the rendered page.' },
        defaultConfiguration: { level: 'error' },
      },
      {
        id: 'route-integrity/dynamic-unresolved',
        name: 'UnresolvedDynamicLink',
        shortDescription: { text: 'Dynamic link could not be resolved' },
        fullDescription: { text: 'A link contains dynamic values that could not be statically resolved.' },
        defaultConfiguration: { level: 'note' },
      },
    ];
  }

  private buildSarifResults(): SarifResult[] {
    const results: SarifResult[] = [];

    for (const verdict of this.report.routeVerdicts) {
      if (verdict.verdict === 'healthy') continue;

      const node = this.report.graph.nodes.get(verdict.nodeId);
      if (!node?.source.file) continue;

      results.push({
        ruleId: `route-integrity/${verdict.verdict}`,
        level: this.sarifLevel(verdict.severity),
        message: { text: verdict.evidence[0]?.description || `Route ${verdict.pattern} has issue: ${verdict.verdict}` },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: node.source.file },
            region: { startLine: node.source.line || 1, startColumn: node.source.column || 1 },
          },
        }],
      });
    }

    for (const verdict of this.report.linkVerdicts) {
      if (verdict.verdict === 'healthy') continue;

      results.push({
        ruleId: `route-integrity/${verdict.verdict}`,
        level: this.sarifLevel(verdict.severity),
        message: { text: `Link to ${verdict.targetHref}: ${verdict.evidence[0]?.description}` },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: verdict.sourceFile },
            region: { startLine: 1, startColumn: 1 },
          },
        }],
      });
    }

    for (const placeholder of this.report.placeholders) {
      if (placeholder.type !== 'ui-visible') continue;

      results.push({
        ruleId: 'route-integrity/placeholder',
        level: 'error',
        message: { text: `Placeholder text visible: "${placeholder.text.slice(0, 50)}"` },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: placeholder.location.file },
            region: { startLine: placeholder.location.line, startColumn: placeholder.location.column },
          },
        }],
      });
    }

    return results;
  }

  private sarifLevel(severity: string): string {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'note';
    }
  }

  private jsonReplacer(key: string, value: any): any {
    if (value instanceof Map) {
      return Object.fromEntries(value);
    }
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }

  private async ensureDir(dir: string): Promise<void> {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch {
      // Directory exists
    }
  }
}

export function createReportGenerator(
  report: RouteIntegrityReport,
  outputDir: string
): ReportGenerator {
  return new ReportGenerator(report, outputDir);
}

export async function generateReports(
  report: RouteIntegrityReport,
  outputDir: string
): Promise<{ md: string; json: string; sarif: string }> {
  const generator = new ReportGenerator(report, outputDir);
  return generator.generateAll();
}
