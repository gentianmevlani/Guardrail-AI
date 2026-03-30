// Stub prisma for standalone use
const prisma: any = null;
import { LICENSE_INFO, COMPATIBILITY_MATRIX, LicenseType } from './compatibility-matrix';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * License cache to avoid repeated API calls
 */
const licenseCache = new Map<string, { license: string; category: string; fetchedAt: Date }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface LicensedDependency {
  name: string;
  version: string;
  license: string;
  category: string;
}

export interface LicenseConflict {
  dependency: string;
  dependencyLicense: string;
  projectLicense: string;
  reason: string;
  severity: 'warning' | 'error';
}

export interface LicenseAnalysisResult {
  projectId: string;
  projectLicense: string;
  summary: {
    totalDeps: number;
    categories: Record<string, number>;
    conflicts: number;
  };
  dependencies: LicensedDependency[];
  conflicts: LicenseConflict[];
  aiAttribution: AICodeAttribution[];
  overallStatus: 'compliant' | 'warning' | 'violation';
}

export interface AICodeAttribution {
  file: string;
  generator: string; // 'copilot', 'chatgpt', 'claude', etc.
  percentage: number;
  requiresAttribution: boolean;
}

export interface CompatibilityResult {
  compatible: boolean;
  reason: string;
}

export class LicenseComplianceEngine {
  async analyzeProject(projectPath: string, projectId: string, projectLicense: string): Promise<LicenseAnalysisResult> {
    const dependencies = await this.extractDependencies(projectPath);
    const conflicts = this.detectGPLContamination(dependencies, projectLicense);
    const aiAttribution = await this.analyzeAICodeAttribution(projectPath);

    const categories: Record<string, number> = {};
    for (const dep of dependencies) {
      categories[dep.category] = (categories[dep.category] || 0) + 1;
    }

    const overallStatus: 'compliant' | 'warning' | 'violation' =
      conflicts.some(c => c.severity === 'error') ? 'violation' :
      conflicts.length > 0 ? 'warning' : 'compliant';

    const result: LicenseAnalysisResult = {
      projectId,
      projectLicense,
      summary: {
        totalDeps: dependencies.length,
        categories,
        conflicts: conflicts.length,
      },
      dependencies,
      conflicts,
      aiAttribution,
      overallStatus,
    };

    // @ts-ignore - licenseAnalysis may not exist in schema yet
    try {
      // Check if analysis exists (may not be in schema yet)
      await (prisma as any).licenseAnalysis?.findUnique({
        where: { id: projectId }
      });
      // Analysis result can be used here if needed
    } catch (error) {
      // licenseAnalysis table may not exist yet, ignore
    }

    return result;
  }

  private async extractDependencies(projectPath: string): Promise<LicensedDependency[]> {
    try {
      const packageJsonPath = join(projectPath, 'package.json');
      if (!existsSync(packageJsonPath)) {
        return [];
      }
      
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      const entries = Object.entries(deps);
      
      // Fetch licenses in parallel with concurrency limit
      const results: LicensedDependency[] = [];
      const batchSize = 10;
      
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async ([name, version]) => {
            const licenseInfo = await this.fetchLicenseFromRegistry(name);
            return {
              name,
              version: version as string,
              license: licenseInfo.license,
              category: licenseInfo.category,
            };
          })
        );
        results.push(...batchResults);
      }
      
      return results;
    } catch (error) {
      console.error('Failed to extract dependencies:', error);
      return [];
    }
  }

  /**
   * Fetch license information from npm registry
   */
  private async fetchLicenseFromRegistry(packageName: string): Promise<{ license: string; category: string }> {
    // Check cache first
    const cached = licenseCache.get(packageName);
    if (cached && (Date.now() - cached.fetchedAt.getTime()) < CACHE_TTL_MS) {
      return { license: cached.license, category: cached.category };
    }

    try {
      // Fetch from npm registry
      const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'guardrail-AI/1.0',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        return this.getDefaultLicense(packageName);
      }

      const data = await response.json();
      const license = this.extractLicenseFromPackageData(data);
      const category = this.categorizeLicense(license);

      // Cache the result
      licenseCache.set(packageName, {
        license,
        category,
        fetchedAt: new Date(),
      });

      return { license, category };
    } catch (error) {
      // Fallback for network errors or private packages
      return this.getDefaultLicense(packageName);
    }
  }

  /**
   * Extract license from npm package data
   */
  private extractLicenseFromPackageData(data: any): string {
    // Check latest version first
    const latestVersion = data['dist-tags']?.latest;
    const versionData = latestVersion ? data.versions?.[latestVersion] : null;

    // Try multiple license sources
    let license = versionData?.license || data.license;

    // Handle SPDX expressions
    if (typeof license === 'object') {
      if (license.type) {
        license = license.type;
      } else if (Array.isArray(license)) {
        license = license.map((l: any) => l.type || l).join(' OR ');
      }
    }

    // Normalize common variations
    if (typeof license === 'string') {
      license = this.normalizeLicenseName(license);
    }

    return license || 'UNKNOWN';
  }

  /**
   * Normalize license name variations
   */
  private normalizeLicenseName(license: string): string {
    const normalizations: Record<string, string> = {
      'Apache 2.0': 'Apache-2.0',
      'Apache License 2.0': 'Apache-2.0',
      'Apache-2': 'Apache-2.0',
      'BSD': 'BSD-3-Clause',
      'BSD-2': 'BSD-2-Clause',
      'BSD-3': 'BSD-3-Clause',
      'GPL': 'GPL-3.0',
      'GPLv2': 'GPL-2.0',
      'GPLv3': 'GPL-3.0',
      'LGPL': 'LGPL-3.0',
      'LGPLv2': 'LGPL-2.1',
      'LGPLv3': 'LGPL-3.0',
      'MIT License': 'MIT',
      'ISC License': 'ISC',
      'Unlicense': 'Unlicense',
      'WTFPL': 'WTFPL',
      'CC0': 'CC0-1.0',
      'CC-BY-3.0': 'CC-BY-3.0',
      'CC-BY-4.0': 'CC-BY-4.0',
    };

    return normalizations[license] || license;
  }

  /**
   * Categorize license by permissiveness
   */
  private categorizeLicense(license: string): string {
    const categories: Record<string, string[]> = {
      'permissive': ['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'Unlicense', 'CC0-1.0', 'WTFPL', '0BSD'],
      'weak-copyleft': ['LGPL-2.1', 'LGPL-3.0', 'MPL-2.0', 'EPL-1.0', 'EPL-2.0'],
      'copyleft': ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],
      'proprietary': ['PROPRIETARY', 'COMMERCIAL', 'UNLICENSED'],
      'public-domain': ['CC0-1.0', 'Unlicense', 'WTFPL'],
    };

    for (const [category, licenses] of Object.entries(categories)) {
      if (licenses.some(l => license.toUpperCase().includes(l.toUpperCase()))) {
        return category;
      }
    }

    return 'unknown';
  }

  /**
   * Get default license for packages that can't be fetched
   */
  private getDefaultLicense(_packageName: string): { license: string; category: string } {
    // Check node_modules for local license file
    // This is a fallback for private packages
    return {
      license: 'UNKNOWN',
      category: 'unknown',
    };
  }

  /**
   * Clear license cache
   */
  clearCache(): void {
    licenseCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; oldestEntry: Date | null } {
    let oldest: Date | null = null;
    for (const entry of licenseCache.values()) {
      if (!oldest || entry.fetchedAt < oldest) {
        oldest = entry.fetchedAt;
      }
    }
    return {
      size: licenseCache.size,
      oldestEntry: oldest,
    };
  }

  checkCompatibility(projectLicense: string, depLicense: string): CompatibilityResult {
    const projLic = projectLicense as LicenseType;
    const depLic = depLicense as LicenseType;

    if (!LICENSE_INFO[projLic] || !LICENSE_INFO[depLic]) {
      return { compatible: false, reason: 'Unknown license' };
    }

    const compatible = COMPATIBILITY_MATRIX[projLic]?.[depLic] ?? false;

    return {
      compatible,
      reason: compatible
        ? 'Licenses are compatible'
        : `${depLicense} is incompatible with ${projectLicense}`,
    };
  }

  private detectGPLContamination(deps: LicensedDependency[], projectLicense: string): LicenseConflict[] {
    const conflicts: LicenseConflict[] = [];

    for (const dep of deps) {
      const compat = this.checkCompatibility(projectLicense, dep.license);

      if (!compat.compatible) {
        conflicts.push({
          dependency: dep.name,
          dependencyLicense: dep.license,
          projectLicense,
          reason: compat.reason,
          severity: dep.license.includes('GPL') ? 'error' : 'warning',
        });
      }
    }

    return conflicts;
  }

  private async analyzeAICodeAttribution(_projectPath: string): Promise<AICodeAttribution[]> {
    // In production, this would scan for AI-generated code markers
    return [];
  }

  async generateComplianceReport(analysis: LicenseAnalysisResult): Promise<string> {
    let report = '# License Compliance Report\n\n';
    report += `**Project License:** ${analysis.projectLicense}\n`;
    report += `**Status:** ${analysis.overallStatus}\n\n`;
    report += `## Summary\n`;
    report += `- Total Dependencies: ${analysis.summary.totalDeps}\n`;
    report += `- Conflicts: ${analysis.summary.conflicts}\n\n`;

    if (analysis.conflicts.length > 0) {
      report += `## Conflicts\n\n`;
      for (const conflict of analysis.conflicts) {
        report += `- **${conflict.dependency}** (${conflict.dependencyLicense}): ${conflict.reason}\n`;
      }
    }

    return report;
  }
}

export const licenseComplianceEngine = new LicenseComplianceEngine();
