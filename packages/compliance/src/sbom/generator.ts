/**
 * SBOM Generator
 *
 * Main orchestrator that collects dependencies, enriches with metadata,
 * and produces CycloneDX 1.5 or SPDX 2.3 output.
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type {
  SBOMDocument,
  SBOMComponent,
  SBOMGenerateOptions,
  SBOMGenerateResult,
  SBOMDependencyGraph,
} from './types';
import {
  collectFromNpmLockfile,
  collectFromPnpmLockfile,
  collectFromPackageJson,
  getRootComponent,
  detectPackageManagers,
} from './collector';
import { formatCycloneDX, formatSPDX } from './formatters';

const GUARDRAIL_VERSION = '1.0.0';

/**
 * Generate an SBOM for a project
 */
export async function generateSBOM(options: SBOMGenerateOptions): Promise<SBOMGenerateResult> {
  const startTime = Date.now();
  const projectPath = path.resolve(options.projectPath);

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  // Detect package managers
  const managers = options.packageManagers || detectPackageManagers(projectPath);

  if (managers.length === 0) {
    throw new Error('No supported package manager detected. Ensure package.json exists.');
  }

  // Collect components from all detected managers
  let components: SBOMComponent[] = [];
  const collectorOptions = {
    includeDevDependencies: options.includeDevDependencies ?? false,
    includeHashes: options.includeHashes ?? true,
    includeLicenses: options.includeLicenses ?? true,
  };

  for (const manager of managers) {
    let collected: SBOMComponent[] = [];

    switch (manager) {
      case 'pnpm':
        collected = collectFromPnpmLockfile(projectPath, collectorOptions);
        break;
      case 'npm':
        collected = collectFromNpmLockfile(projectPath, collectorOptions);
        break;
      case 'yarn':
        // Yarn uses npm-compatible lockfile parsing for v1, or package.json fallback
        collected = collectFromNpmLockfile(projectPath, collectorOptions);
        break;
    }

    // Fallback to package.json if lockfile parsing yields nothing
    if (collected.length === 0) {
      collected = collectFromPackageJson(projectPath, collectorOptions);
    }

    components = mergeComponents(components, collected);
  }

  // Get root project info
  const rootComponent = getRootComponent(projectPath);

  // Build dependency graph
  const dependencies = buildDependencyGraph(components, rootComponent);

  // Build SBOM document
  const document: SBOMDocument = {
    format: options.format,
    specVersion: options.format === 'cyclonedx' ? '1.5' : 'SPDX-2.3',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'Guardrail',
          name: 'guardrail-sbom',
          version: GUARDRAIL_VERSION,
        },
      ],
      component: rootComponent || undefined,
    },
    components,
    dependencies,
    generatedAt: new Date().toISOString(),
  };

  // Serialize to output format
  const serialized = options.format === 'cyclonedx'
    ? formatCycloneDX(document)
    : formatSPDX(document);

  // Write to file if output path specified
  let outputPath = options.outputPath;
  if (outputPath) {
    outputPath = path.resolve(outputPath);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, serialized, 'utf8');
  }

  // Compute stats
  const licenseBreakdown: Record<string, number> = {};
  const componentTypes: Record<string, number> = {};

  for (const comp of components) {
    const license = comp.license || 'UNKNOWN';
    licenseBreakdown[license] = (licenseBreakdown[license] || 0) + 1;

    componentTypes[comp.type] = (componentTypes[comp.type] || 0) + 1;
  }

  const totalVulnerabilities = components.reduce(
    (sum, c) => sum + (c.vulnerabilities?.length || 0),
    0
  );

  return {
    document,
    serialized,
    stats: {
      totalComponents: components.length,
      totalVulnerabilities,
      licenseBreakdown,
      componentTypes,
      generationTimeMs: Date.now() - startTime,
    },
    outputPath,
  };
}

/**
 * Merge component lists, deduplicating by name@version
 */
function mergeComponents(existing: SBOMComponent[], incoming: SBOMComponent[]): SBOMComponent[] {
  const seen = new Map<string, SBOMComponent>();

  for (const comp of existing) {
    seen.set(`${comp.name}@${comp.version}`, comp);
  }

  for (const comp of incoming) {
    const key = `${comp.name}@${comp.version}`;
    if (!seen.has(key)) {
      seen.set(key, comp);
    }
  }

  return Array.from(seen.values());
}

/**
 * Build a dependency graph from components
 */
function buildDependencyGraph(
  components: SBOMComponent[],
  rootComponent: SBOMComponent | null
): SBOMDependencyGraph[] {
  const graph: SBOMDependencyGraph[] = [];

  // Root depends on all top-level components
  if (rootComponent) {
    graph.push({
      ref: rootComponent.purl || `${rootComponent.name}@${rootComponent.version}`,
      dependsOn: components
        .filter(c => c.scope === 'required')
        .map(c => c.purl || `${c.name}@${c.version}`),
    });
  }

  // Each component entry (dependencies not resolved at this level)
  for (const comp of components) {
    graph.push({
      ref: comp.purl || `${comp.name}@${comp.version}`,
      dependsOn: comp.dependencies || [],
    });
  }

  return graph;
}

/**
 * Quick SBOM summary for CLI display
 */
export function formatSBOMSummary(result: SBOMGenerateResult): string {
  const lines: string[] = [
    '',
    `  SBOM Generated (${result.document.format.toUpperCase()} ${result.document.specVersion})`,
    `  ${'─'.repeat(50)}`,
    `  Components:       ${result.stats.totalComponents}`,
    `  Vulnerabilities:  ${result.stats.totalVulnerabilities}`,
    `  Generation Time:  ${result.stats.generationTimeMs}ms`,
    '',
    '  License Breakdown:',
  ];

  const sorted = Object.entries(result.stats.licenseBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  for (const [license, count] of sorted) {
    lines.push(`    ${license.padEnd(20)} ${count}`);
  }

  if (result.outputPath) {
    lines.push('');
    lines.push(`  Output: ${result.outputPath}`);
  }

  lines.push('');
  return lines.join('\n');
}
