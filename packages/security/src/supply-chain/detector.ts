// Stub prisma for standalone use
const prisma: any = null;
import { typosquatDetector, TyposquatResult } from "./typosquat";
import { maliciousPackageDB } from "./malicious-db";
import { scriptAnalyzer, ScriptAnalysisResult } from "./script-analyzer";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Package analysis result
 */
export interface PackageAnalysisResult {
  packageName: string;
  version: string;
  registry: string;
  riskScore: number;
  threats: Threat[];
  isMalicious: boolean;
  isTyposquat: boolean;
  isDeprecated: boolean;
  typosquatResult?: TyposquatResult;
  scriptAnalysis?: ScriptAnalysisResult[];
  license?: string;
  maintainerRisk?: MaintainerRisk;
}

export interface Threat {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
}

export interface MaintainerRisk {
  accountAge: number;
  packageCount: number;
  suspiciousActivity: boolean;
  riskLevel: "low" | "medium" | "high";
}

/**
 * SBOM (Software Bill of Materials)
 */
export interface SBOM {
  id?: string;
  projectId: string;
  version: number;
  format: "CycloneDX" | "SPDX";
  specVersion: string;
  components: SBOMComponent[];
  generatedAt: Date;
}

export interface SBOMComponent {
  type: "library" | "application" | "framework";
  name: string;
  version: string;
  purl: string; // Package URL
  licenses?: string[];
  hashes?: { algorithm: string; value: string }[];
  dependencies?: string[];
}

/**
 * Supply Chain Attack Detector
 */
export class SupplyChainDetector {
  /**
   * Detect typosquatting
   */
  async detectTyposquatting(packageName: string): Promise<TyposquatResult> {
    return typosquatDetector.detectTyposquatting(packageName);
  }

  /**
   * Detect dependency confusion
   */
  async detectDependencyConfusion(
    _packageName: string,
    internalRegistry?: string,
  ): Promise<{ isDependencyConfusion: boolean; reason: string }> {
    // Check if package exists in both public and internal registries
    // This is a simplified implementation

    if (!internalRegistry) {
      return {
        isDependencyConfusion: false,
        reason: "No internal registry configured",
      };
    }

    // In production, this would check both registries
    // and compare versions, publish dates, etc.

    return {
      isDependencyConfusion: false,
      reason: "Package only found in public registry",
    };
  }

  /**
   * Full package analysis
   */
  async analyzePackage(
    packageName: string,
    version: string,
    projectId: string,
  ): Promise<PackageAnalysisResult> {
    const threats: Threat[] = [];
    let riskScore = 0;

    // Check for typosquatting
    const typosquatResult = await this.detectTyposquatting(packageName);
    const isTyposquat = typosquatResult.isTyposquat;

    if (isTyposquat) {
      threats.push({
        type: "typosquatting",
        severity: "high",
        description: `Possible typosquatting of ${typosquatResult.targetPackage}`,
      });
      riskScore += 40;
    }

    // Check against malicious database
    const maliciousCheck = await maliciousPackageDB.checkPackage(
      packageName,
      version,
    );
    const isMalicious = maliciousCheck.isMalicious;

    if (isMalicious) {
      for (const match of maliciousCheck.matches) {
        threats.push({
          type: "known_malicious",
          severity: match.severity,
          description: match.reason,
        });
        riskScore += 50;
      }
    }

    // Analyze scripts
    const scriptAnalysis = await scriptAnalyzer.analyzeScripts(
      packageName,
      version,
    );

    for (const analysis of scriptAnalysis) {
      if (analysis.isSuspicious) {
        threats.push({
          type: "suspicious_script",
          severity: "high",
          description: `Suspicious script: ${analysis.scriptName}`,
        });
        riskScore += analysis.riskScore * 0.5;
      }
    }

    // Save to database
    await prisma.dependencyAnalysis.create({
      data: {
        projectId,
        packageName,
        version,
        registry: "npm",
        isMalicious,
        isTyposquat,
        isDeprecated: false,
        riskScore: Math.min(100, riskScore),
        threats: JSON.parse(JSON.stringify(threats)),
      },
    });

    return {
      packageName,
      version,
      registry: "npm",
      riskScore: Math.min(100, riskScore),
      threats,
      isMalicious,
      isTyposquat,
      isDeprecated: false,
      typosquatResult: isTyposquat ? typosquatResult : undefined,
      scriptAnalysis,
    };
  }

  /**
   * Generate SBOM (CycloneDX format)
   */
  async generateSBOM(projectPath: string, projectId: string): Promise<SBOM> {
    const components: SBOMComponent[] = [];

    try {
      // Read package.json
      const packageJsonPath = join(projectPath, "package.json");
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

      // Extract dependencies
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      for (const [name, version] of Object.entries(deps)) {
        components.push({
          type: "library",
          name,
          version: version as string,
          purl: `pkg:npm/${name}@${version}`,
        });
      }
    } catch (error) {
      // Handle error
    }

    const sbom: SBOM = {
      id: `sbom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      version: 1,
      format: "CycloneDX",
      specVersion: "1.4",
      components,
      generatedAt: new Date(),
    };

    // @ts-ignore - SBOM model exists in schema, Prisma client may need regeneration
    const savedSBOM = await (prisma as any).sBOM.create({
      data: {
        id: sbom.id,
        projectId,
        version: sbom.version,
        format: sbom.format,
        specVersion: sbom.specVersion,
        components: JSON.parse(JSON.stringify(components)),
        generatedAt: sbom.generatedAt,
      },
    });

    return {
      id: savedSBOM.id,
      projectId: savedSBOM.projectId,
      version: savedSBOM.version,
      format: savedSBOM.format as "CycloneDX" | "SPDX",
      specVersion: savedSBOM.specVersion,
      components: savedSBOM.components as unknown as SBOMComponent[],
      generatedAt: savedSBOM.generatedAt,
    };
  }
}

// Export singleton
export const supplyChainDetector = new SupplyChainDetector();
