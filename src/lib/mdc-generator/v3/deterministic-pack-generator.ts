/**
 * Deterministic Pack Generator
 * 
 * Generates MDC packs with:
 * - Stable ordering (by path, then symbol)
 * - Normalized whitespace and headings
 * - Version header (MDC_PACK_VERSION + timestamp + git commit)
 * - Size budgeting (prefer indexes over full files when large)
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import { TruthIndex } from './truth-index-extractor';
import { CriticalInvariant } from './critical-invariants';
import { RealityScanIntegration } from './reality-scan-integration';
import { DependencyClosure } from './change-aware-selector';

export interface PackMetadata {
  version: string;
  timestamp: string;
  gitCommit: string;
  gitBranch?: string;
  lane: 'cli-mcp' | 'dashboard' | 'shared';
  filesIncluded: number;
  symbolsIncluded: number;
}

export interface PackContent {
  metadata: PackMetadata;
  changedFiles: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted';
    summary: string;
  }>;
  dependencyClosure: {
    changedFiles: number;
    dependentFiles: number;
    relatedSymbols: number;
  };
  truthIndex: TruthIndex;
  criticalInvariants: CriticalInvariant[];
  realityHotspots?: RealityScanIntegration['hotspots'];
}

export class DeterministicPackGenerator {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Generate pack with deterministic output
   */
  generatePack(
    lane: 'cli-mcp' | 'dashboard' | 'shared',
    content: PackContent
  ): string {
    const lines: string[] = [];

    // Header
    lines.push('---');
    lines.push(`MDC_PACK_VERSION: ${content.metadata.version}`);
    lines.push(`TIMESTAMP: ${content.metadata.timestamp}`);
    lines.push(`GIT_COMMIT: ${content.metadata.gitCommit}`);
    if (content.metadata.gitBranch) {
      lines.push(`GIT_BRANCH: ${content.metadata.gitBranch}`);
    }
    lines.push(`LANE: ${lane.toUpperCase()}`);
    lines.push(`FILES_INCLUDED: ${content.metadata.filesIncluded}`);
    lines.push(`SYMBOLS_INCLUDED: ${content.metadata.symbolsIncluded}`);
    lines.push('---');
    lines.push('');

    // Title
    lines.push(`# ${lane === 'cli-mcp' ? 'CLI/MCP' : lane === 'dashboard' ? 'Dashboard' : 'Shared'} Context Pack`);
    lines.push('');
    lines.push(`**Generated:** ${new Date(content.metadata.timestamp).toLocaleString()}`);
    lines.push(`**Commit:** \`${content.metadata.gitCommit.substring(0, 8)}\``);
    lines.push('');

    // Changed Files Summary
    if (content.changedFiles.length > 0) {
      lines.push('## Changed Files Summary');
      lines.push('');
      lines.push('| File | Status | Summary |');
      lines.push('|------|--------|---------|');
      
      // Sort by path for determinism
      const sorted = [...content.changedFiles].sort((a, b) => a.path.localeCompare(b.path));
      
      for (const file of sorted) {
        const statusEmoji = 
          file.status === 'added' ? '➕' :
          file.status === 'modified' ? '✏️' : '🗑️';
        lines.push(`| \`${file.path}\` | ${statusEmoji} ${file.status} | ${file.summary} |`);
      }
      lines.push('');
    }

    // Dependency Closure
    lines.push('## Dependency Closure');
    lines.push('');
    lines.push(`- **Changed Files:** ${content.dependencyClosure.changedFiles}`);
    lines.push(`- **Dependent Files:** ${content.dependencyClosure.dependentFiles}`);
    lines.push(`- **Related Symbols:** ${content.dependencyClosure.relatedSymbols}`);
    lines.push('');

    // Truth Index
    lines.push('## Truth Index');
    lines.push('');
    lines.push(this.formatTruthIndex(content.truthIndex));
    lines.push('');

    // Critical Invariants
    if (content.criticalInvariants.length > 0) {
      lines.push(this.formatInvariants(content.criticalInvariants));
      lines.push('');
    }

    // Reality Hotspots
    if (content.realityHotspots && content.realityHotspots.length > 0) {
      lines.push('## Reality Scan Hotspots');
      lines.push('');
      lines.push('| File | Line | Severity | Rule |');
      lines.push('|------|------|----------|------|');
      
      // Sort by severity, then file, then line
      const sorted = [...content.realityHotspots].sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (sevDiff !== 0) return sevDiff;
        const fileDiff = a.file.localeCompare(b.file);
        if (fileDiff !== 0) return fileDiff;
        return a.line - b.line;
      });

      for (const hotspot of sorted) {
        const severityEmoji = 
          hotspot.severity === 'critical' ? '🚨' :
          hotspot.severity === 'high' ? '⚠️' :
          hotspot.severity === 'medium' ? '⚡' : 'ℹ️';
        lines.push(
          `| \`${hotspot.file}\` | ${hotspot.line} | ${severityEmoji} ${hotspot.severity} | ${hotspot.rule} |`
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format Truth Index section
   */
  private formatTruthIndex(index: TruthIndex): string {
    const lines: string[] = [];

    // Commands
    if (index.commands.length > 0) {
      lines.push('### Commands');
      lines.push('');
      lines.push('| Command | File | Line | Description |');
      lines.push('|---------|------|------|-------------|');
      
      const sorted = [...index.commands].sort((a, b) => a.name.localeCompare(b.name));
      for (const cmd of sorted) {
        lines.push(`| \`${cmd.name}\` | \`${cmd.file}\` | ${cmd.line} | ${cmd.description || ''} |`);
      }
      lines.push('');
    }

    // Tools
    if (index.tools.length > 0) {
      lines.push('### MCP Tools');
      lines.push('');
      lines.push('| Tool | File | Line | Server |');
      lines.push('|------|------|------|--------|');
      
      const sorted = [...index.tools].sort((a, b) => a.name.localeCompare(b.name));
      for (const tool of sorted) {
        lines.push(`| \`${tool.name}\` | \`${tool.file}\` | ${tool.line} | ${tool.mcpServer || 'guardrail'} |`);
      }
      lines.push('');
    }

    // Routes
    if (index.routes.length > 0) {
      lines.push('### API Routes');
      lines.push('');
      lines.push('| Method | Path | File | Line | Auth |');
      lines.push('|--------|------|------|------|------|');
      
      const sorted = [...index.routes].sort((a, b) => {
        const methodDiff = a.method.localeCompare(b.method);
        if (methodDiff !== 0) return methodDiff;
        return a.path.localeCompare(b.path);
      });
      
      for (const route of sorted) {
        const authIcon = route.authRequired ? '🔒' : '🔓';
        lines.push(
          `| ${route.method} | \`${route.path}\` | \`${route.file}\` | ${route.line} | ${authIcon} |`
        );
      }
      lines.push('');
    }

    // Env Vars
    if (index.envVars.length > 0) {
      lines.push('### Environment Variables');
      lines.push('');
      lines.push('| Variable | File | Line | Required | Default | Dangerous |');
      lines.push('|----------|------|------|----------|---------|-----------|');
      
      const sorted = [...index.envVars].sort((a, b) => a.name.localeCompare(b.name));
      for (const env of sorted) {
        const dangerIcon = env.dangerous ? '⚠️' : '';
        lines.push(
          `| \`${env.name}\` | \`${env.file}\` | ${env.line} | ${env.required ? '✅' : '❌'} | ${env.defaultValue || ''} | ${dangerIcon} |`
        );
      }
      lines.push('');
    }

    // DB Models
    if (index.dbModels.length > 0) {
      lines.push('### Database Models');
      lines.push('');
      lines.push('| Model | File | Line | Fields |');
      lines.push('|-------|------|------|--------|');
      
      const sorted = [...index.dbModels].sort((a, b) => a.name.localeCompare(b.name));
      for (const model of sorted) {
        lines.push(
          `| \`${model.name}\` | \`${model.file}\` | ${model.line} | ${model.fields.length} |`
        );
      }
      lines.push('');
    }

    // Integrations
    if (index.integrations.length > 0) {
      lines.push('### Integrations');
      lines.push('');
      lines.push('| Type | Name | File | Line | Verified | Idempotent |');
      lines.push('|------|------|------|------|----------|------------|');
      
      const sorted = [...index.integrations].sort((a, b) => {
        const typeDiff = a.type.localeCompare(b.type);
        if (typeDiff !== 0) return typeDiff;
        return a.name.localeCompare(b.name);
      });
      
      for (const integration of sorted) {
        lines.push(
          `| ${integration.type} | \`${integration.name}\` | \`${integration.file}\` | ${integration.line} | ${integration.signatureVerification ? '✅' : '❌'} | ${integration.idempotent ? '✅' : '❌'} |`
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format invariants section
   */
  private formatInvariants(invariants: CriticalInvariant[]): string {
    const lines: string[] = [];
    
    lines.push('## Critical Invariants');
    lines.push('');
    lines.push('**These rules must not be violated.**');
    lines.push('');

    // Group by category
    const byCategory = invariants.reduce((acc, inv) => {
      if (!acc[inv.category]) acc[inv.category] = [];
      acc[inv.category].push(inv);
      return acc;
    }, {} as Record<string, CriticalInvariant[]>);

    for (const [category, invs] of Object.entries(byCategory)) {
      lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ')}`);
      lines.push('');

      // Sort by ID for determinism
      const sorted = [...invs].sort((a, b) => a.id.localeCompare(b.id));

      for (const inv of sorted) {
        lines.push(`- **${inv.id}:** ${inv.rule}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get git commit hash
   */
  getGitCommit(): string {
    try {
      const gitDir = join(this.projectPath, '.git');
      if (!existsSync(gitDir)) {
        return 'not-a-git-repo';
      }

      const commit = execSync('git rev-parse HEAD', {
        cwd: this.projectPath,
        encoding: 'utf8',
      }).trim();

      return commit;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get git branch
   */
  getGitBranch(): string | undefined {
    try {
      const gitDir = join(this.projectPath, '.git');
      if (!existsSync(gitDir)) {
        return undefined;
      }

      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectPath,
        encoding: 'utf8',
      }).trim();

      return branch;
    } catch {
      return undefined;
    }
  }
}
