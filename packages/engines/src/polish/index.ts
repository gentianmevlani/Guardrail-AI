/**
 * Polish engines — project-level quality checks.
 * Run via: guardrail polish [path]
 */

import seoEngine from './engines/seo';
import securityEngine from './engines/security';
import resilienceEngine from './engines/resilience';
import performanceEngine from './engines/performance';
import observabilityEngine from './engines/observability';
import infrastructureEngine from './engines/infrastructure';
import documentationEngine from './engines/documentation';
import configurationEngine from './engines/configuration';
import backendEngine from './engines/backend';
import accessibilityEngine from './engines/accessibility';

import path from 'path';
import type { PolishEngine, PolishIssue, PolishReport } from './types';
import { detectProjectType, adjustSeverity } from './libraries';
import { readFileSafe } from './utils';

export type { PolishEngine, PolishIssue, PolishReport, ProjectType } from './types';
export { c, icons, categoryIcons } from './styles';
export { LIBRARY_ALTERNATIVES, hasLibrary, detectProjectType, adjustSeverity } from './libraries';
export { pathExists, findFile, findAllFiles, readFileSafe, fileContains } from './utils';

const ENGINES: PolishEngine[] = [
  seoEngine,
  securityEngine,
  resilienceEngine,
  performanceEngine,
  observabilityEngine,
  infrastructureEngine,
  documentationEngine,
  configurationEngine,
  backendEngine,
  accessibilityEngine,
];

/**
 * Run all polish engines on a project and return a combined report.
 * Each engine is isolated: a failing engine logs to console and contributes no issues.
 * Severity is adjusted by project type (e.g. frontend-only issues downgraded for API-only projects).
 */
export async function runPolish(projectPath: string): Promise<PolishReport> {
  const allIssues: PolishIssue[] = [];
  const packageJson = await readFileSafe(path.join(projectPath, 'package.json'));
  const projectType = await detectProjectType(projectPath, packageJson);

  for (const engine of ENGINES) {
    try {
      const issues = await engine(projectPath);
      for (const issue of issues) {
        const adjusted = adjustSeverity(issue.severity as 'critical' | 'high' | 'medium' | 'low', projectType, issue.id);
        allIssues.push({ ...issue, severity: adjusted });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[polish] Engine error: ${msg}`);
    }
  }

  const critical = allIssues.filter((i) => i.severity === 'critical').length;
  const high = allIssues.filter((i) => i.severity === 'high').length;
  const medium = allIssues.filter((i) => i.severity === 'medium').length;
  const low = allIssues.filter((i) => i.severity === 'low').length;

  // Score: 100 - (critical*20 + high*10 + medium*5 + low*2), floored at 0
  const penalty = critical * 20 + high * 10 + medium * 5 + low * 2;
  const score = Math.max(0, 100 - penalty);

  const recommendations: string[] = [];
  if (critical > 0) recommendations.push('Address critical issues first.');
  if (high > 0) recommendations.push('Fix high-severity issues for production readiness.');
  if (medium > 0) recommendations.push('Consider addressing medium-priority improvements.');
  if (low > 0) recommendations.push('Address low-priority items when convenient.');
  if (allIssues.length === 0) recommendations.push('Project looks well-polished!');

  return {
    projectPath,
    totalIssues: allIssues.length,
    critical,
    high,
    medium,
    low,
    issues: allIssues,
    score,
    recommendations,
  };
}

export {
  seoEngine,
  securityEngine,
  resilienceEngine,
  performanceEngine,
  observabilityEngine,
  infrastructureEngine,
  documentationEngine,
  configurationEngine,
  backendEngine,
  accessibilityEngine,
};
