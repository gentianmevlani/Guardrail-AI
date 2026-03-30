/**
 * Supply Chain Suite
 *
 * Unified supply chain security combining:
 * - SBOM Generation (Software Bill of Materials)
 * - Vulnerability Assessment (CVE checking)
 * - License Compliance (GPL, MIT, Apache detection)
 * - Dependency Analysis (outdated packages)
 * - Typosquatting Detection (malicious packages)
 *
 * Protects against supply chain attacks and ensures compliance.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { execSync } from "child_process";

// ============================================================================
// TYPES
// ============================================================================

export interface SupplyChainReport {
  projectPath: string;
  timestamp: string;
  duration: number;

  // SBOM
  sbom: SBOM;

  // Vulnerabilities
  vulnerabilities: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    findings: VulnerabilityFinding[];
  };

  // Licenses
  licenses: {
    compliant: boolean;
    riskyLicenses: LicenseFinding[];
    summary: LicenseSummary;
  };

  // Dependencies
  dependencies: {
    total: number;
    direct: number;
    transitive: number;
    outdated: OutdatedDependency[];
    deprecated: DeprecatedDependency[];
  };

  // Security
  security: {
    typosquatting: TyposquattingRisk[];
    malicious: MaliciousPackage[];
    unmaintained: UnmaintainedPackage[];
  };

  // Scores
  scores: {
    overall: number;
    vulnerability: number;
    license: number;
    maintenance: number;
  };

  // Recommendations
  recommendations: SupplyChainRecommendation[];
}

export interface SBOM {
  format: "CycloneDX" | "SPDX";
  version: string;
  components: SBOMComponent[];
  dependencies: SBOMDependency[];
  metadata: SBOMMetadata;
}

export interface SBOMComponent {
  type: "library" | "framework" | "application";
  name: string;
  version: string;
  purl?: string;
  licenses: string[];
  supplier?: string;
  hashes?: { algorithm: string; value: string }[];
}

export interface SBOMDependency {
  ref: string;
  dependsOn: string[];
}

export interface SBOMMetadata {
  timestamp: string;
  tools: { name: string; version: string }[];
  component: { name: string; version: string; type: string };
}

export interface VulnerabilityFinding {
  id: string;
  cve?: string;
  cwe?: string;
  ghsa?: string;
  severity: "critical" | "high" | "medium" | "low";
  package: string;
  version: string;
  title: string;
  description: string;
  fixedIn?: string;
  references: string[];
  cvss?: number;
  exploitability?: "high" | "medium" | "low" | "none";
}

export interface LicenseFinding {
  package: string;
  version: string;
  license: string;
  risk: "high" | "medium" | "low";
  reason: string;
  recommendation: string;
}

export interface LicenseSummary {
  total: number;
  byLicense: { [license: string]: number };
  copyleft: number;
  permissive: number;
  unknown: number;
}

export interface OutdatedDependency {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: "dependencies" | "devDependencies";
  ageMonths: number;
}

export interface DeprecatedDependency {
  name: string;
  version: string;
  reason: string;
  replacement?: string;
}

export interface TyposquattingRisk {
  package: string;
  similarTo: string;
  riskLevel: "high" | "medium" | "low";
  indicators: string[];
}

export interface MaliciousPackage {
  name: string;
  version: string;
  reason: string;
  advisoryUrl?: string;
}

export interface UnmaintainedPackage {
  name: string;
  version: string;
  lastPublished: string;
  monthsSinceUpdate: number;
  openIssues?: number;
}

export interface SupplyChainRecommendation {
  priority: number;
  category: "vulnerability" | "license" | "maintenance" | "security";
  action: string;
  reason: string;
  packages?: string[];
  effort: "low" | "medium" | "high";
}

// ============================================================================
// LICENSE CLASSIFICATIONS
// ============================================================================

const LICENSE_RISK = {
  high: [
    "GPL-3.0",
    "GPL-2.0",
    "AGPL-3.0",
    "LGPL-3.0",
    "LGPL-2.1",
    "SSPL-1.0",
    "EUPL-1.2",
  ],
  medium: ["MPL-2.0", "EPL-2.0", "CDDL-1.0", "CPL-1.0"],
  low: [
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "0BSD",
    "Unlicense",
    "CC0-1.0",
  ],
};

// ============================================================================
// KNOWN TYPOSQUATTING TARGETS
// ============================================================================

const POPULAR_PACKAGES = [
  "lodash",
  "express",
  "react",
  "axios",
  "moment",
  "chalk",
  "commander",
  "debug",
  "async",
  "request",
  "underscore",
  "uuid",
  "bluebird",
  "mongoose",
  "webpack",
  "babel",
  "typescript",
  "eslint",
  "prettier",
  "jest",
  "mocha",
];

// ============================================================================
// SUPPLY CHAIN SUITE
// ============================================================================

class SupplyChainSuite {
  /**
   * Run comprehensive supply chain analysis
   */
  async analyze(projectPath: string): Promise<SupplyChainReport> {
    const startTime = Date.now();

    console.log(`📦 Supply Chain Suite analyzing: ${projectPath}`);

    // Read package.json
    const packageJson = await this.readPackageJson(projectPath);
    if (!packageJson) {
      throw new Error("No package.json found");
    }

    // Generate SBOM
    const sbom = await this.generateSBOM(projectPath, packageJson);

    // Check vulnerabilities
    const vulnerabilities = await this.checkVulnerabilities(projectPath);

    // Analyze licenses
    const licenses = await this.analyzeLicenses(projectPath, sbom);

    // Analyze dependencies
    const dependencies = await this.analyzeDependencies(
      projectPath,
      packageJson,
    );

    // Security checks
    const security = await this.securityChecks(projectPath, packageJson);

    // Calculate scores
    const scores = this.calculateScores(
      vulnerabilities,
      licenses,
      dependencies,
      security,
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      vulnerabilities,
      licenses,
      dependencies,
      security,
    );

    const duration = Date.now() - startTime;

    return {
      projectPath,
      timestamp: new Date().toISOString(),
      duration,
      sbom,
      vulnerabilities,
      licenses,
      dependencies,
      security,
      scores,
      recommendations,
    };
  }

  /**
   * Generate SBOM only
   */
  async generateSBOMOnly(projectPath: string): Promise<SBOM> {
    const packageJson = await this.readPackageJson(projectPath);
    if (!packageJson) {
      throw new Error("No package.json found");
    }
    return this.generateSBOM(projectPath, packageJson);
  }

  /**
   * Check vulnerabilities only
   */
  async checkVulnerabilitiesOnly(
    projectPath: string,
  ): Promise<SupplyChainReport["vulnerabilities"]> {
    return this.checkVulnerabilities(projectPath);
  }

  // ============================================================================
  // SBOM GENERATION
  // ============================================================================

  private async generateSBOM(
    projectPath: string,
    packageJson: any,
  ): Promise<SBOM> {
    const components: SBOMComponent[] = [];
    const dependencies: SBOMDependency[] = [];

    // Add main component
    components.push({
      type: "application",
      name: packageJson.name || "unknown",
      version: packageJson.version || "0.0.0",
      licenses: [packageJson.license || "UNKNOWN"],
    });

    // Read lock file for accurate versions
    const lockFile = await this.readLockFile(projectPath);

    // Process dependencies
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [name, versionRange] of Object.entries(allDeps)) {
      const version =
        lockFile?.[name]?.version || String(versionRange).replace(/^\^|~/, "");
      const license = await this.getPackageLicense(projectPath, name);

      components.push({
        type: "library",
        name,
        version,
        purl: `pkg:npm/${name}@${version}`,
        licenses: [license],
      });

      dependencies.push({
        ref: `pkg:npm/${name}@${version}`,
        dependsOn: [], // Would need to parse lock file for full tree
      });
    }

    return {
      format: "CycloneDX",
      version: "1.4",
      components,
      dependencies,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: [{ name: "guardrail", version: "1.0.0" }],
        component: {
          name: packageJson.name || "unknown",
          version: packageJson.version || "0.0.0",
          type: "application",
        },
      },
    };
  }

  // ============================================================================
  // VULNERABILITY CHECKING
  // ============================================================================

  private async checkVulnerabilities(
    projectPath: string,
  ): Promise<SupplyChainReport["vulnerabilities"]> {
    const findings: VulnerabilityFinding[] = [];

    try {
      // Run npm audit
      const result = execSync("npm audit --json", {
        cwd: projectPath,
        encoding: "utf-8",
        maxBuffer: 50 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const audit = JSON.parse(result);
      findings.push(...this.parseNpmAudit(audit));
    } catch (error: any) {
      // npm audit exits with non-zero when vulnerabilities found
      if (error.stdout) {
        try {
          const audit = JSON.parse(error.stdout);
          findings.push(...this.parseNpmAudit(audit));
        } catch {
          // Parse error
        }
      }
    }

    return {
      total: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      findings,
    };
  }

  private parseNpmAudit(audit: any): VulnerabilityFinding[] {
    const findings: VulnerabilityFinding[] = [];

    if (audit.vulnerabilities) {
      for (const [name, vuln] of Object.entries(
        audit.vulnerabilities,
      ) as any[]) {
        const vias = Array.isArray(vuln.via) ? vuln.via : [vuln.via];

        for (const via of vias) {
          if (typeof via === "object" && via.title) {
            findings.push({
              id: `vuln-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              cve: via.cve || undefined,
              ghsa: via.source || undefined,
              severity: via.severity || vuln.severity || "medium",
              package: name,
              version: vuln.range || "unknown",
              title: via.title || `Vulnerability in ${name}`,
              description:
                via.overview || via.title || "No description available",
              fixedIn: vuln.fixAvailable?.version || undefined,
              references: via.url ? [via.url] : [],
              cvss: via.cvss?.score,
            });
          }
        }
      }
    }

    return findings;
  }

  // ============================================================================
  // LICENSE ANALYSIS
  // ============================================================================

  private async analyzeLicenses(
    projectPath: string,
    sbom: SBOM,
  ): Promise<SupplyChainReport["licenses"]> {
    const riskyLicenses: LicenseFinding[] = [];
    const licenseCounts: { [license: string]: number } = {};
    let copyleft = 0;
    let permissive = 0;
    let unknown = 0;

    for (const component of sbom.components) {
      if (component.type === "application") continue;

      for (const license of component.licenses) {
        licenseCounts[license] = (licenseCounts[license] || 0) + 1;

        if (LICENSE_RISK.high.includes(license)) {
          copyleft++;
          riskyLicenses.push({
            package: component.name,
            version: component.version,
            license,
            risk: "high",
            reason:
              "Copyleft license requires derivative works to use same license",
            recommendation: "Review license compatibility with your project",
          });
        } else if (LICENSE_RISK.medium.includes(license)) {
          riskyLicenses.push({
            package: component.name,
            version: component.version,
            license,
            risk: "medium",
            reason: "Weak copyleft license with some restrictions",
            recommendation: "Ensure compliance with license terms",
          });
        } else if (LICENSE_RISK.low.includes(license)) {
          permissive++;
        } else if (license === "UNKNOWN" || !license) {
          unknown++;
          riskyLicenses.push({
            package: component.name,
            version: component.version,
            license: "UNKNOWN",
            risk: "medium",
            reason: "License could not be determined",
            recommendation: "Manually verify the license",
          });
        } else {
          permissive++;
        }
      }
    }

    return {
      compliant: riskyLicenses.filter((r) => r.risk === "high").length === 0,
      riskyLicenses,
      summary: {
        total: sbom.components.length - 1, // Exclude main app
        byLicense: licenseCounts,
        copyleft,
        permissive,
        unknown,
      },
    };
  }

  // ============================================================================
  // DEPENDENCY ANALYSIS
  // ============================================================================

  private async analyzeDependencies(
    projectPath: string,
    packageJson: any,
  ): Promise<SupplyChainReport["dependencies"]> {
    const outdated: OutdatedDependency[] = [];
    const deprecated: DeprecatedDependency[] = [];

    const directDeps = Object.keys(packageJson.dependencies || {}).length;
    const devDeps = Object.keys(packageJson.devDependencies || {}).length;

    // Check for outdated packages
    try {
      const result = execSync("npm outdated --json", {
        cwd: projectPath,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const outdatedJson = JSON.parse(result || "{}");

      for (const [name, info] of Object.entries(outdatedJson) as any[]) {
        const current = info.current || "unknown";
        const wanted = info.wanted || current;
        const latest = info.latest || wanted;

        // Calculate age (simplified)
        const majorDiff =
          this.getMajorVersion(latest) - this.getMajorVersion(current);
        const ageMonths = majorDiff * 6; // Rough estimate

        outdated.push({
          name,
          current,
          wanted,
          latest,
          type: info.type || "dependencies",
          ageMonths,
        });
      }
    } catch (error: any) {
      // npm outdated exits with non-zero when packages are outdated
      if (error.stdout) {
        try {
          const outdatedJson = JSON.parse(error.stdout || "{}");

          for (const [name, info] of Object.entries(outdatedJson) as any[]) {
            outdated.push({
              name,
              current: info.current || "unknown",
              wanted: info.wanted || "unknown",
              latest: info.latest || "unknown",
              type: info.type || "dependencies",
              ageMonths: 0,
            });
          }
        } catch {
          // Parse error
        }
      }
    }

    // Count transitive dependencies (from lock file)
    let transitive = 0;
    try {
      const lockPath = path.join(projectPath, "package-lock.json");
      const lock = JSON.parse(await fs.readFile(lockPath, "utf-8"));
      transitive =
        Object.keys(lock.packages || lock.dependencies || {}).length -
        directDeps -
        devDeps;
    } catch {
      // No lock file
    }

    return {
      total: directDeps + devDeps + Math.max(0, transitive),
      direct: directDeps + devDeps,
      transitive: Math.max(0, transitive),
      outdated,
      deprecated,
    };
  }

  // ============================================================================
  // SECURITY CHECKS
  // ============================================================================

  private async securityChecks(
    projectPath: string,
    packageJson: any,
  ): Promise<SupplyChainReport["security"]> {
    const typosquatting: TyposquattingRisk[] = [];
    const malicious: MaliciousPackage[] = [];
    const unmaintained: UnmaintainedPackage[] = [];

    const allDeps = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    });

    // Check for typosquatting
    for (const dep of allDeps) {
      for (const popular of POPULAR_PACKAGES) {
        const distance = this.levenshteinDistance(dep, popular);

        if (distance > 0 && distance <= 2 && dep !== popular) {
          typosquatting.push({
            package: dep,
            similarTo: popular,
            riskLevel: distance === 1 ? "high" : "medium",
            indicators: [
              `Name is ${distance} character(s) different from "${popular}"`,
              "Could be a typosquatting attack",
            ],
          });
        }
      }
    }

    // Check for known malicious packages (simplified - would use database in production)
    const knownMalicious = [
      "event-stream",
      "flatmap-stream",
      "ua-parser-js@0.7.29",
    ];
    for (const dep of allDeps) {
      if (
        knownMalicious.some((m) => dep === m || dep.startsWith(m.split("@")[0]))
      ) {
        malicious.push({
          name: dep,
          version:
            packageJson.dependencies?.[dep] ||
            packageJson.devDependencies?.[dep] ||
            "unknown",
          reason: "Package has been reported as compromised",
          advisoryUrl:
            "https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident",
        });
      }
    }

    return {
      typosquatting,
      malicious,
      unmaintained,
    };
  }

  // ============================================================================
  // SCORING & RECOMMENDATIONS
  // ============================================================================

  private calculateScores(
    vulnerabilities: SupplyChainReport["vulnerabilities"],
    licenses: SupplyChainReport["licenses"],
    dependencies: SupplyChainReport["dependencies"],
    security: SupplyChainReport["security"],
  ) {
    // Vulnerability score
    const vulnPenalty =
      vulnerabilities.critical * 25 +
      vulnerabilities.high * 15 +
      vulnerabilities.medium * 5 +
      vulnerabilities.low * 2;
    const vulnerabilityScore = Math.max(0, 100 - vulnPenalty);

    // License score
    const licensePenalty =
      licenses.riskyLicenses.filter((l) => l.risk === "high").length * 20 +
      licenses.riskyLicenses.filter((l) => l.risk === "medium").length * 5;
    const licenseScore = Math.max(0, 100 - licensePenalty);

    // Maintenance score
    const outdatedPenalty = dependencies.outdated.length * 2;
    const maintenanceScore = Math.max(0, 100 - outdatedPenalty);

    // Overall
    const securityPenalty =
      security.malicious.length * 50 +
      security.typosquatting.filter((t) => t.riskLevel === "high").length * 20;
    const overall = Math.round(
      (vulnerabilityScore + licenseScore + maintenanceScore - securityPenalty) /
        3,
    );

    return {
      overall: Math.max(0, Math.min(100, overall)),
      vulnerability: vulnerabilityScore,
      license: licenseScore,
      maintenance: maintenanceScore,
    };
  }

  private generateRecommendations(
    vulnerabilities: SupplyChainReport["vulnerabilities"],
    licenses: SupplyChainReport["licenses"],
    dependencies: SupplyChainReport["dependencies"],
    security: SupplyChainReport["security"],
  ): SupplyChainRecommendation[] {
    const recommendations: SupplyChainRecommendation[] = [];

    // Critical vulnerabilities
    if (vulnerabilities.critical > 0) {
      recommendations.push({
        priority: 1,
        category: "vulnerability",
        action: `Fix ${vulnerabilities.critical} critical vulnerabilities immediately`,
        reason:
          "Critical vulnerabilities can be exploited to compromise your application",
        packages: vulnerabilities.findings
          .filter((f) => f.severity === "critical")
          .map((f) => f.package),
        effort: "high",
      });
    }

    // Malicious packages
    if (security.malicious.length > 0) {
      recommendations.push({
        priority: 1,
        category: "security",
        action: `Remove ${security.malicious.length} known malicious package(s)`,
        reason: "Malicious packages can steal data or execute harmful code",
        packages: security.malicious.map((m) => m.name),
        effort: "low",
      });
    }

    // High-risk licenses
    const highRiskLicenses = licenses.riskyLicenses.filter(
      (l) => l.risk === "high",
    );
    if (highRiskLicenses.length > 0) {
      recommendations.push({
        priority: 2,
        category: "license",
        action: `Review ${highRiskLicenses.length} package(s) with copyleft licenses`,
        reason: "Copyleft licenses may require you to open source your code",
        packages: highRiskLicenses.map((l) => l.package),
        effort: "medium",
      });
    }

    // High vulnerabilities
    if (vulnerabilities.high > 0) {
      recommendations.push({
        priority: 3,
        category: "vulnerability",
        action: `Address ${vulnerabilities.high} high severity vulnerabilities`,
        reason: "High severity vulnerabilities pose significant risk",
        packages: vulnerabilities.findings
          .filter((f) => f.severity === "high")
          .map((f) => f.package),
        effort: "medium",
      });
    }

    // Outdated packages
    const majorOutdated = dependencies.outdated.filter(
      (d) => this.getMajorVersion(d.latest) > this.getMajorVersion(d.current),
    );
    if (majorOutdated.length > 5) {
      recommendations.push({
        priority: 4,
        category: "maintenance",
        action: `Update ${majorOutdated.length} packages with major version updates available`,
        reason:
          "Outdated packages may have bugs, security issues, or missing features",
        packages: majorOutdated.map((d) => d.name),
        effort: "high",
      });
    }

    // Typosquatting risks
    const highRiskTypos = security.typosquatting.filter(
      (t) => t.riskLevel === "high",
    );
    if (highRiskTypos.length > 0) {
      recommendations.push({
        priority: 2,
        category: "security",
        action: `Verify ${highRiskTypos.length} package(s) with potential typosquatting`,
        reason: "These packages have names similar to popular packages",
        packages: highRiskTypos.map((t) => t.package),
        effort: "low",
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private async readPackageJson(projectPath: string): Promise<any | null> {
    try {
      const content = await fs.readFile(
        path.join(projectPath, "package.json"),
        "utf-8",
      );
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async readLockFile(projectPath: string): Promise<any | null> {
    try {
      const content = await fs.readFile(
        path.join(projectPath, "package-lock.json"),
        "utf-8",
      );
      const lock = JSON.parse(content);
      return lock.packages || lock.dependencies || {};
    } catch {
      try {
        // Try pnpm lock
        const content = await fs.readFile(
          path.join(projectPath, "pnpm-lock.yaml"),
          "utf-8",
        );
        // Simplified parsing
        return {};
      } catch {
        return null;
      }
    }
  }

  private async getPackageLicense(
    projectPath: string,
    packageName: string,
  ): Promise<string> {
    try {
      const pkgPath = path.join(
        projectPath,
        "node_modules",
        packageName,
        "package.json",
      );
      const content = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(content);
      return pkg.license || "UNKNOWN";
    } catch {
      return "UNKNOWN";
    }
  }

  private getMajorVersion(version: string): number {
    const match = version.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[a.length][b.length];
  }
}

export const supplyChainSuite = new SupplyChainSuite();
export default supplyChainSuite;
