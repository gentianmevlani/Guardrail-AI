/**
 * Supply Chain Security Integration for guardrail
 * 
 * Integrates Syft (SBOM), Grype/Trivy (vulnerabilities), and OpenSSF Scorecard.
 * Provides unified supply chain risk assessment.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ============ Types ============

export interface SupplyChainConfig {
  // Tool paths
  syftPath: string;
  grypePath: string;
  trivyPath: string;
  scorecardPath: string;
  
  // SBOM settings
  sbomFormat: 'spdx-json' | 'cyclonedx-json' | 'syft-json';
  
  // Vulnerability thresholds
  vulnerabilityThresholds: {
    critical: number;  // Max allowed critical vulns
    high: number;      // Max allowed high vulns
    medium: number;    // Max allowed medium vulns
  };
  
  // Scorecard minimum score (0-10)
  minScorecardScore: number;
  
  // Cache settings
  cacheEnabled: boolean;
  cacheTTL: number;  // seconds
}

export interface SBOM {
  format: string;
  generatedAt: string;
  source: string;
  artifacts: SBOMArtifact[];
  relationships: SBOMRelationship[];
}

export interface SBOMArtifact {
  id: string;
  name: string;
  version: string;
  type: 'npm' | 'pip' | 'gem' | 'cargo' | 'go' | 'maven' | 'nuget' | 'unknown';
  licenses: string[];
  purl?: string;
  cpe?: string;
  locations: string[];
}

export interface SBOMRelationship {
  parent: string;
  child: string;
  type: 'depends-on' | 'dev-depends-on' | 'optional-depends-on';
}

export interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  package: string;
  version: string;
  fixedVersion?: string;
  description: string;
  cvss?: number;
  cwe?: string[];
  references: string[];
  exploitAvailable?: boolean;
}

export interface ScorecardResult {
  repo: string;
  score: number;
  checks: ScorecardCheck[];
  generatedAt: string;
}

export interface ScorecardCheck {
  name: string;
  score: number;
  reason: string;
  details?: string[];
}

export interface SupplyChainReport {
  sbom: SBOM;
  vulnerabilities: Vulnerability[];
  scorecard?: ScorecardResult;
  riskScore: number;
  summary: {
    totalDependencies: number;
    directDependencies: number;
    transitiveDependencies: number;
    vulnerabilityCounts: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    licenseBreakdown: Record<string, number>;
    outdatedPackages: number;
  };
  verdict: {
    allowed: boolean;
    blockers: string[];
    warnings: string[];
  };
}

// ============ Default Configuration ============

export const DEFAULT_SUPPLY_CHAIN_CONFIG: SupplyChainConfig = {
  syftPath: 'syft',
  grypePath: 'grype',
  trivyPath: 'trivy',
  scorecardPath: 'scorecard',
  sbomFormat: 'cyclonedx-json',
  vulnerabilityThresholds: {
    critical: 0,  // Zero tolerance for critical
    high: 3,
    medium: 10
  },
  minScorecardScore: 5,
  cacheEnabled: true,
  cacheTTL: 3600
};

// ============ Supply Chain Integration Class ============

export class SupplyChainIntegration {
  private config: SupplyChainConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  
  constructor(config: Partial<SupplyChainConfig> = {}) {
    this.config = { ...DEFAULT_SUPPLY_CHAIN_CONFIG, ...config };
  }
  
  /**
   * Check which tools are installed
   */
  async checkTools(): Promise<Record<string, boolean>> {
    const tools = {
      syft: this.config.syftPath,
      grype: this.config.grypePath,
      trivy: this.config.trivyPath,
      scorecard: this.config.scorecardPath
    };
    
    const results: Record<string, boolean> = {};
    
    for (const [name, path] of Object.entries(tools)) {
      try {
        execSync(`${path} version`, { stdio: 'pipe' });
        results[name] = true;
      } catch {
        results[name] = false;
      }
    }
    
    return results;
  }
  
  /**
   * Generate SBOM using Syft
   */
  async generateSBOM(targetPath: string): Promise<SBOM> {
    const cacheKey = `sbom-${targetPath}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    console.log('📦 Generating SBOM with Syft...');
    
    try {
      const output = execSync(
        `${this.config.syftPath} ${targetPath} -o ${this.config.sbomFormat}`,
        { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
      );
      
      const rawSbom = JSON.parse(output);
      const sbom = this.normalizeSBOM(rawSbom);
      
      this.setCache(cacheKey, sbom);
      return sbom;
    } catch (error) {
      console.warn('⚠️ Syft not available, falling back to package.json analysis');
      return this.generateSBOMFromPackageJson(targetPath);
    }
  }
  
  /**
   * Fallback: Generate SBOM from package.json
   */
  private async generateSBOMFromPackageJson(targetPath: string): Promise<SBOM> {
    const artifacts: SBOMArtifact[] = [];
    const relationships: SBOMRelationship[] = [];
    
    // Find all package.json files
    const packageJsonPaths = this.findFiles(targetPath, 'package.json');
    
    for (const pkgPath of packageJsonPaths) {
      try {
        const content = fs.readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(content);
        
        // Add the package itself
        const pkgArtifact: SBOMArtifact = {
          id: `${pkg.name}@${pkg.version}`,
          name: pkg.name || path.basename(path.dirname(pkgPath)),
          version: pkg.version || '0.0.0',
          type: 'npm',
          licenses: pkg.license ? [pkg.license] : [],
          locations: [pkgPath]
        };
        artifacts.push(pkgArtifact);
        
        // Add dependencies
        const deps = { ...pkg.dependencies };
        for (const [name, version] of Object.entries(deps)) {
          const depArtifact: SBOMArtifact = {
            id: `${name}@${version}`,
            name,
            version: String(version).replace(/^[\^~]/, ''),
            type: 'npm',
            licenses: [],
            purl: `pkg:npm/${name}@${version}`,
            locations: []
          };
          artifacts.push(depArtifact);
          
          relationships.push({
            parent: pkgArtifact.id,
            child: depArtifact.id,
            type: 'depends-on'
          });
        }
        
        // Add dev dependencies
        const devDeps = pkg.devDependencies || {};
        for (const [name, version] of Object.entries(devDeps)) {
          const depArtifact: SBOMArtifact = {
            id: `${name}@${version}`,
            name,
            version: String(version).replace(/^[\^~]/, ''),
            type: 'npm',
            licenses: [],
            purl: `pkg:npm/${name}@${version}`,
            locations: []
          };
          artifacts.push(depArtifact);
          
          relationships.push({
            parent: pkgArtifact.id,
            child: depArtifact.id,
            type: 'dev-depends-on'
          });
        }
      } catch (error) {
        console.warn(`Failed to parse ${pkgPath}:`, error);
      }
    }
    
    // Deduplicate artifacts
    const uniqueArtifacts = Array.from(
      new Map(artifacts.map(a => [a.id, a])).values()
    );
    
    return {
      format: 'guardrail-sbom',
      generatedAt: new Date().toISOString(),
      source: targetPath,
      artifacts: uniqueArtifacts,
      relationships
    };
  }
  
  /**
   * Normalize SBOM from various formats
   */
  private normalizeSBOM(raw: any): SBOM {
    // Handle CycloneDX format
    if (raw.bomFormat === 'CycloneDX') {
      return {
        format: 'cyclonedx',
        generatedAt: raw.metadata?.timestamp || new Date().toISOString(),
        source: raw.metadata?.component?.name || 'unknown',
        artifacts: (raw.components || []).map((c: any) => ({
          id: `${c.name}@${c.version}`,
          name: c.name,
          version: c.version,
          type: this.mapPackageType(c.type),
          licenses: (c.licenses || []).map((l: any) => l.license?.id || l.expression || 'unknown'),
          purl: c.purl,
          cpe: c.cpe,
          locations: []
        })),
        relationships: (raw.dependencies || []).flatMap((d: any) =>
          (d.dependsOn || []).map((dep: string) => ({
            parent: d.ref,
            child: dep,
            type: 'depends-on' as const
          }))
        )
      };
    }
    
    // Handle SPDX format
    if (raw.spdxVersion) {
      return {
        format: 'spdx',
        generatedAt: raw.creationInfo?.created || new Date().toISOString(),
        source: raw.name || 'unknown',
        artifacts: (raw.packages || []).map((p: any) => ({
          id: p.SPDXID,
          name: p.name,
          version: p.versionInfo,
          type: 'unknown' as const,
          licenses: p.licenseConcluded ? [p.licenseConcluded] : [],
          purl: p.externalRefs?.find((r: any) => r.referenceType === 'purl')?.referenceLocator,
          locations: []
        })),
        relationships: (raw.relationships || []).map((r: any) => ({
          parent: r.spdxElementId,
          child: r.relatedSpdxElement,
          type: r.relationshipType === 'DEPENDS_ON' ? 'depends-on' : 'depends-on'
        }))
      };
    }
    
    // Default: return as-is with minimal structure
    return {
      format: 'unknown',
      generatedAt: new Date().toISOString(),
      source: 'unknown',
      artifacts: [],
      relationships: []
    };
  }
  
  /**
   * Scan for vulnerabilities using Grype or Trivy
   */
  async scanVulnerabilities(sbomOrPath: SBOM | string): Promise<Vulnerability[]> {
    const cacheKey = `vulns-${typeof sbomOrPath === 'string' ? sbomOrPath : sbomOrPath.source}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    console.log('🔍 Scanning for vulnerabilities...');
    
    // Try Grype first
    let vulnerabilities = await this.scanWithGrype(sbomOrPath);
    
    // Fall back to Trivy if Grype fails
    if (vulnerabilities.length === 0) {
      vulnerabilities = await this.scanWithTrivy(sbomOrPath);
    }
    
    // Fall back to npm audit if both fail
    if (vulnerabilities.length === 0 && typeof sbomOrPath === 'string') {
      vulnerabilities = await this.scanWithNpmAudit(sbomOrPath);
    }
    
    this.setCache(cacheKey, vulnerabilities);
    return vulnerabilities;
  }
  
  /**
   * Scan with Grype
   */
  private async scanWithGrype(sbomOrPath: SBOM | string): Promise<Vulnerability[]> {
    try {
      const target = typeof sbomOrPath === 'string' ? `dir:${sbomOrPath}` : 'sbom:-';
      const input = typeof sbomOrPath === 'string' ? undefined : JSON.stringify(sbomOrPath);
      
      const output = execSync(
        `${this.config.grypePath} ${target} -o json`,
        { 
          encoding: 'utf-8',
          input,
          maxBuffer: 50 * 1024 * 1024
        }
      );
      
      const result = JSON.parse(output);
      return (result.matches || []).map((m: any) => ({
        id: m.vulnerability.id,
        severity: this.mapSeverity(m.vulnerability.severity),
        package: m.artifact.name,
        version: m.artifact.version,
        fixedVersion: m.vulnerability.fix?.versions?.[0],
        description: m.vulnerability.description || '',
        cvss: m.vulnerability.cvss?.[0]?.metrics?.baseScore,
        cwe: m.vulnerability.cwe || [],
        references: m.vulnerability.urls || [],
        exploitAvailable: m.vulnerability.exploit !== undefined
      }));
    } catch {
      return [];
    }
  }
  
  /**
   * Scan with Trivy
   */
  private async scanWithTrivy(sbomOrPath: SBOM | string): Promise<Vulnerability[]> {
    try {
      const target = typeof sbomOrPath === 'string' ? sbomOrPath : '.';
      
      const output = execSync(
        `${this.config.trivyPath} fs --format json ${target}`,
        { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
      );
      
      const result = JSON.parse(output);
      const vulnerabilities: Vulnerability[] = [];
      
      for (const target of result.Results || []) {
        for (const vuln of target.Vulnerabilities || []) {
          vulnerabilities.push({
            id: vuln.VulnerabilityID,
            severity: this.mapSeverity(vuln.Severity),
            package: vuln.PkgName,
            version: vuln.InstalledVersion,
            fixedVersion: vuln.FixedVersion,
            description: vuln.Description || vuln.Title || '',
            cvss: vuln.CVSS?.nvd?.V3Score,
            cwe: vuln.CweIDs || [],
            references: vuln.References || []
          });
        }
      }
      
      return vulnerabilities;
    } catch {
      return [];
    }
  }
  
  /**
   * Fallback: Scan with npm audit
   */
  private async scanWithNpmAudit(targetPath: string): Promise<Vulnerability[]> {
    try {
      const output = execSync(
        'npm audit --json',
        { cwd: targetPath, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
      );
      
      const result = JSON.parse(output);
      const vulnerabilities: Vulnerability[] = [];
      
      for (const [, advisory] of Object.entries(result.advisories || {})) {
        const adv = advisory as any;
        vulnerabilities.push({
          id: `NPM-${adv.id}`,
          severity: this.mapSeverity(adv.severity),
          package: adv.module_name,
          version: adv.vulnerable_versions,
          fixedVersion: adv.patched_versions,
          description: adv.overview || adv.title || '',
          cwe: adv.cwe ? [adv.cwe] : [],
          references: [adv.url].filter(Boolean)
        });
      }
      
      return vulnerabilities;
    } catch {
      return [];
    }
  }
  
  /**
   * Run OpenSSF Scorecard
   */
  async runScorecard(repoUrl: string): Promise<ScorecardResult | null> {
    const cacheKey = `scorecard-${repoUrl}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;
    
    console.log('📊 Running OpenSSF Scorecard...');
    
    try {
      const output = execSync(
        `${this.config.scorecardPath} --repo=${repoUrl} --format=json`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      
      const result = JSON.parse(output);
      const scorecard: ScorecardResult = {
        repo: repoUrl,
        score: result.score || 0,
        checks: (result.checks || []).map((c: any) => ({
          name: c.name,
          score: c.score,
          reason: c.reason,
          details: c.details
        })),
        generatedAt: new Date().toISOString()
      };
      
      this.setCache(cacheKey, scorecard);
      return scorecard;
    } catch {
      console.warn('⚠️ Scorecard not available');
      return null;
    }
  }
  
  /**
   * Generate full supply chain report
   */
  async generateReport(
    targetPath: string,
    repoUrl?: string
  ): Promise<SupplyChainReport> {
    // Generate SBOM
    const sbom = await this.generateSBOM(targetPath);
    
    // Scan for vulnerabilities
    const vulnerabilities = await this.scanVulnerabilities(targetPath);
    
    // Run Scorecard if repo URL provided
    const scorecard = repoUrl ? await this.runScorecard(repoUrl) : undefined;
    
    // Calculate summary
    const directDeps = sbom.relationships.filter(r => r.type === 'depends-on').length;
    const devDeps = sbom.relationships.filter(r => r.type === 'dev-depends-on').length;
    
    const vulnCounts = {
      critical: vulnerabilities.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length,
      medium: vulnerabilities.filter(v => v.severity === 'medium').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length
    };
    
    const licenseBreakdown: Record<string, number> = {};
    for (const artifact of sbom.artifacts) {
      for (const license of artifact.licenses) {
        licenseBreakdown[license] = (licenseBreakdown[license] || 0) + 1;
      }
    }
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore(vulnerabilities, scorecard);
    
    // Determine verdict
    const blockers: string[] = [];
    const warnings: string[] = [];
    
    if (vulnCounts.critical > this.config.vulnerabilityThresholds.critical) {
      blockers.push(`${vulnCounts.critical} critical vulnerabilities exceed threshold of ${this.config.vulnerabilityThresholds.critical}`);
    }
    
    if (vulnCounts.high > this.config.vulnerabilityThresholds.high) {
      blockers.push(`${vulnCounts.high} high vulnerabilities exceed threshold of ${this.config.vulnerabilityThresholds.high}`);
    }
    
    if (vulnCounts.medium > this.config.vulnerabilityThresholds.medium) {
      warnings.push(`${vulnCounts.medium} medium vulnerabilities exceed threshold of ${this.config.vulnerabilityThresholds.medium}`);
    }
    
    if (scorecard && scorecard.score < this.config.minScorecardScore) {
      warnings.push(`Scorecard score ${scorecard.score} below minimum ${this.config.minScorecardScore}`);
    }
    
    return {
      sbom,
      vulnerabilities,
      scorecard: scorecard || undefined,
      riskScore,
      summary: {
        totalDependencies: sbom.artifacts.length,
        directDependencies: directDeps,
        transitiveDependencies: sbom.artifacts.length - directDeps - devDeps,
        vulnerabilityCounts: vulnCounts,
        licenseBreakdown,
        outdatedPackages: 0 // Would need version comparison
      },
      verdict: {
        allowed: blockers.length === 0,
        blockers,
        warnings
      }
    };
  }
  
  /**
   * Calculate risk score (0-100)
   */
  private calculateRiskScore(
    vulnerabilities: Vulnerability[],
    scorecard?: ScorecardResult | null
  ): number {
    let score = 0;
    
    // Vulnerability scoring
    const vulnWeights = { critical: 25, high: 10, medium: 3, low: 1, unknown: 1 };
    for (const vuln of vulnerabilities) {
      score += vulnWeights[vuln.severity] || 1;
      if (vuln.exploitAvailable) score += 10;
    }
    
    // Scorecard penalty
    if (scorecard) {
      const scorecardPenalty = Math.max(0, (5 - scorecard.score) * 5);
      score += scorecardPenalty;
    }
    
    return Math.min(100, score);
  }
  
  // ============ Helper Methods ============
  
  private mapPackageType(type: string): SBOMArtifact['type'] {
    const mapping: Record<string, SBOMArtifact['type']> = {
      'library': 'npm',
      'npm': 'npm',
      'pypi': 'pip',
      'gem': 'gem',
      'cargo': 'cargo',
      'go-module': 'go',
      'maven': 'maven',
      'nuget': 'nuget'
    };
    return mapping[type?.toLowerCase()] || 'unknown';
  }
  
  private mapSeverity(severity: string): Vulnerability['severity'] {
    const mapping: Record<string, Vulnerability['severity']> = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'moderate': 'medium',
      'low': 'low',
      'negligible': 'low',
      'unknown': 'unknown'
    };
    return mapping[severity?.toLowerCase()] || 'unknown';
  }
  
  private findFiles(dir: string, filename: string): string[] {
    const results: string[] = [];
    
    const walk = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            walk(fullPath);
          } else if (entry.isFile() && entry.name === filename) {
            results.push(fullPath);
          }
        }
      } catch {
        // Ignore permission errors
      }
    };
    
    walk(dir);
    return results;
  }
  
  private getFromCache(key: string): any {
    if (!this.config.cacheEnabled) return null;
    
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTTL * 1000) {
      return cached.data;
    }
    
    return null;
  }
  
  private setCache(key: string, data: any): void {
    if (!this.config.cacheEnabled) return;
    
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

// ============ Export Default Instance ============

export const supplyChain = new SupplyChainIntegration();
