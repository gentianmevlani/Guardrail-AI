/**
 * Enhanced SARIF (Static Analysis Results Interchange Format) Output
 * For vulnerability scanning with OSV integration
 * 
 * Includes:
 * - CVSS scores and vectors
 * - Remediation paths
 * - Direct vs transitive classification
 * - Multiple vulnerability sources
 */

import { EnhancedVulnResult } from '../commands/scan-vulnerabilities-enhanced';

export interface SarifResult {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

export interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      rules: SarifRule[];
    };
  };
  results: SarifFinding[];
  invocations: SarifInvocation[];
}

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  helpUri?: string;
  defaultConfiguration: {
    level: 'error' | 'warning' | 'note' | 'none';
  };
  properties?: Record<string, any>;
}

export interface SarifFinding {
  ruleId: string;
  level: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations: SarifLocation[];
  fingerprints?: Record<string, string>;
  properties?: Record<string, any>;
}

export interface SarifLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string;
      uriBaseId?: string;
    };
    region?: {
      startLine: number;
      startColumn?: number;
      endLine?: number;
      endColumn?: number;
    };
  };
}

export interface SarifInvocation {
  executionSuccessful: boolean;
  commandLine?: string;
  startTimeUtc?: string;
  endTimeUtc?: string;
  workingDirectory?: { uri: string };
}

function severityToLevel(severity: string): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'note';
    default:
      return 'warning';
  }
}

function getVersion(): string {
  try {
    const pkg = require('../../package.json');
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

export function toSarifVulnerabilitiesEnhanced(results: EnhancedVulnResult): SarifResult {
  const version = getVersion();
  const ruleMap = new Map<string, SarifRule>();
  
  // Build rules from unique vulnerability IDs
  for (const finding of results.findings) {
    for (const vuln of finding.vulnerabilities) {
      if (!ruleMap.has(vuln.id)) {
        ruleMap.set(vuln.id, {
          id: vuln.id,
          name: vuln.title,
          shortDescription: { text: vuln.title },
          fullDescription: { text: vuln.description || vuln.title },
          helpUri: vuln.references[0] || 'https://osv.dev',
          defaultConfiguration: { level: severityToLevel(vuln.severity) },
          properties: {
            severity: vuln.severity,
            cvssScore: vuln.cvssScore,
            cvssVector: vuln.cvssVector,
            cwe: vuln.cwe,
            aliases: vuln.aliases,
            source: vuln.source,
          },
        });
      }
    }
  }
  
  const sarifResults: SarifFinding[] = [];
  
  for (const finding of results.findings) {
    for (const vuln of finding.vulnerabilities) {
      const remediationText = finding.remediationPath
        ? `${finding.remediationPath.description}${finding.remediationPath.breakingChange ? ' (Breaking change)' : ''}`
        : `Upgrade to ${finding.recommendedVersion || 'latest'}`;
      
      sarifResults.push({
        ruleId: vuln.id,
        level: severityToLevel(vuln.severity),
        message: { 
          text: `${vuln.title} in ${finding.package}@${finding.version}. ${remediationText}`,
        },
        locations: [{
          physicalLocation: {
            artifactLocation: {
              uri: getManifestFile(results.ecosystem),
              uriBaseId: '%SRCROOT%',
            },
            region: { startLine: 1 },
          },
        }],
        fingerprints: {
          'guardrail/v1': `${vuln.id}:${finding.package}:${finding.version}`,
          'osv/id': vuln.id,
        },
        properties: {
          package: finding.package,
          version: finding.version,
          ecosystem: results.ecosystem,
          isDirect: finding.isDirect,
          severity: vuln.severity,
          cvssScore: vuln.cvssScore,
          cvssVector: vuln.cvssVector,
          cwe: vuln.cwe,
          aliases: vuln.aliases,
          source: vuln.source,
          affectedVersions: vuln.affectedVersions,
          patchedVersions: vuln.patchedVersions,
          references: vuln.references,
          publishedAt: vuln.publishedAt,
          updatedAt: vuln.updatedAt,
          remediationPath: finding.remediationPath,
          recommendedVersion: finding.recommendedVersion,
        },
      });
    }
  }
  
  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'guardrail-cli-tool',
          version,
          informationUri: 'https://guardrail.dev',
          rules: Array.from(ruleMap.values()),
        },
      },
      results: sarifResults,
      invocations: [{
        executionSuccessful: true,
        startTimeUtc: new Date().toISOString(),
        workingDirectory: { uri: results.projectPath?.replace(/\\/g, '/') || '.' },
      }],
    }],
  };
}

function getManifestFile(ecosystem: string): string {
  switch (ecosystem) {
    case 'npm':
      return 'package.json';
    case 'PyPI':
      return 'requirements.txt';
    case 'RubyGems':
      return 'Gemfile';
    case 'Go':
      return 'go.mod';
    default:
      return 'package.json';
  }
}
