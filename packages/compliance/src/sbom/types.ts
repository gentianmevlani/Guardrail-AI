/**
 * SBOM (Software Bill of Materials) Types
 *
 * Supports CycloneDX 1.5 and SPDX 2.3 output formats.
 * Enterprise feature for procurement and supply chain compliance.
 */

// ─── Core SBOM Types ───────────────────────────────────────────

export type SBOMFormat = 'cyclonedx' | 'spdx';
export type SBOMOutputEncoding = 'json' | 'xml';

export interface SBOMComponent {
  name: string;
  version: string;
  type: 'library' | 'framework' | 'application' | 'device' | 'firmware' | 'file' | 'operating-system';
  purl?: string;          // Package URL (pkg:npm/express@4.18.2)
  cpe?: string;           // Common Platform Enumeration
  description?: string;
  license?: string;
  licenses?: LicenseInfo[];
  author?: string;
  supplier?: string;
  hashes?: ComponentHash[];
  externalReferences?: ExternalReference[];
  dependencies?: string[]; // PURLs of direct dependencies
  scope?: 'required' | 'optional' | 'excluded';
  vulnerabilities?: VulnerabilityRef[];
}

export interface LicenseInfo {
  id?: string;            // SPDX license identifier (e.g., "MIT")
  name?: string;          // License name if not in SPDX list
  url?: string;
}

export interface ComponentHash {
  algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512' | 'SHA-1' | 'MD5';
  value: string;
}

export interface ExternalReference {
  type: 'vcs' | 'issue-tracker' | 'website' | 'documentation' | 'distribution' | 'other';
  url: string;
  comment?: string;
}

export interface VulnerabilityRef {
  id: string;             // CVE-2024-XXXXX
  source: string;         // NVD, GitHub Advisory, etc.
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'none' | 'unknown';
  description?: string;
  recommendation?: string;
  url?: string;
}

// ─── SBOM Document ────────────────────────────────────────────

export interface SBOMDocument {
  format: SBOMFormat;
  specVersion: string;    // "1.5" for CycloneDX, "SPDX-2.3" for SPDX
  serialNumber: string;   // Unique document ID
  version: number;        // Document version (1 for first generation)
  metadata: SBOMMetadata;
  components: SBOMComponent[];
  dependencies: SBOMDependencyGraph[];
  vulnerabilities?: VulnerabilityRef[];
  generatedAt: string;    // ISO 8601
}

export interface SBOMMetadata {
  timestamp: string;
  tools: SBOMTool[];
  component?: SBOMComponent;  // The root project
  authors?: Array<{ name: string; email?: string }>;
  supplier?: { name: string; url?: string };
}

export interface SBOMTool {
  vendor: string;
  name: string;
  version: string;
}

export interface SBOMDependencyGraph {
  ref: string;            // PURL of the component
  dependsOn: string[];    // PURLs of direct dependencies
}

// ─── Generation Options ───────────────────────────────────────

export interface SBOMGenerateOptions {
  projectPath: string;
  format: SBOMFormat;
  output?: SBOMOutputEncoding;
  includeDevDependencies?: boolean;
  includeLicenses?: boolean;
  includeVulnerabilities?: boolean;
  includeHashes?: boolean;
  outputPath?: string;
  packageManagers?: ('npm' | 'yarn' | 'pnpm')[];
}

export interface SBOMGenerateResult {
  document: SBOMDocument;
  serialized: string;     // The final output string (JSON or XML)
  stats: {
    totalComponents: number;
    totalVulnerabilities: number;
    licenseBreakdown: Record<string, number>;
    componentTypes: Record<string, number>;
    generationTimeMs: number;
  };
  outputPath?: string;
}
