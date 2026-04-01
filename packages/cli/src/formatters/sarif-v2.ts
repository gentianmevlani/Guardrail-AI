/**
 * SARIF v2.1.0 Output - Enterprise-grade implementation
 * Compliant with GitHub Code Scanning and Azure DevOps
 * https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 */

import { createHash } from 'crypto';

export interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

export interface SarifRun {
  tool: SarifTool;
  results: SarifResult[];
  invocations?: SarifInvocation[];
  properties?: Record<string, any>;
}

export interface SarifTool {
  driver: SarifToolComponent;
}

export interface SarifToolComponent {
  name: string;
  version: string;
  informationUri?: string;
  rules?: SarifReportingDescriptor[];
  organization?: string;
  semanticVersion?: string;
}

export interface SarifReportingDescriptor {
  id: string;
  name?: string;
  shortDescription?: SarifMultiformatMessageString;
  fullDescription?: SarifMultiformatMessageString;
  help?: SarifMultiformatMessageString;
  helpUri?: string;
  defaultConfiguration?: SarifReportingConfiguration;
  properties?: Record<string, any>;
}

export interface SarifMultiformatMessageString {
  text: string;
  markdown?: string;
}

export interface SarifReportingConfiguration {
  level: 'error' | 'warning' | 'note' | 'none';
  enabled?: boolean;
}

export interface SarifResult {
  ruleId: string;
  ruleIndex?: number;
  level: 'error' | 'warning' | 'note' | 'none';
  message: SarifMessage;
  locations?: SarifLocation[];
  partialFingerprints?: Record<string, string>;
  fingerprints?: Record<string, string>;
  fixes?: SarifFix[];
  properties?: Record<string, any>;
}

export interface SarifMessage {
  text: string;
  markdown?: string;
}

export interface SarifLocation {
  physicalLocation?: SarifPhysicalLocation;
  logicalLocations?: SarifLogicalLocation[];
}

export interface SarifPhysicalLocation {
  artifactLocation: SarifArtifactLocation;
  region?: SarifRegion;
  contextRegion?: SarifRegion;
}

export interface SarifArtifactLocation {
  uri: string;
  uriBaseId?: string;
}

export interface SarifRegion {
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
  snippet?: SarifArtifactContent;
}

export interface SarifArtifactContent {
  text?: string;
}

export interface SarifLogicalLocation {
  name?: string;
  fullyQualifiedName?: string;
  kind?: string;
}

export interface SarifFix {
  description?: SarifMessage;
  artifactChanges: SarifArtifactChange[];
}

export interface SarifArtifactChange {
  artifactLocation: SarifArtifactLocation;
  replacements: SarifReplacement[];
}

export interface SarifReplacement {
  deletedRegion: SarifRegion;
  insertedContent?: SarifArtifactContent;
}

export interface SarifInvocation {
  executionSuccessful: boolean;
  commandLine?: string;
  startTimeUtc?: string;
  endTimeUtc?: string;
  workingDirectory?: SarifArtifactLocation;
  exitCode?: number;
}

/**
 * Convert severity to SARIF level
 */
function severityToLevel(severity: string): 'error' | 'warning' | 'note' {
  switch (severity.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    case 'info':
      return 'note';
    default:
      return 'warning';
  }
}

/**
 * Generate stable fingerprint for a finding
 */
function generateFingerprint(finding: any): string {
  const data = `${finding.type || finding.category}:${finding.file}:${finding.line}:${finding.title || finding.match}`;
  return createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Get package version
 */
function getVersion(): string {
  try {
    const pkg = require('../../package.json');
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/**
 * Convert secrets scan results to SARIF v2.1.0
 */
export function secretsToSarif(results: any): SarifLog {
  const version = getVersion();
  const ruleMap = new Map<string, SarifReportingDescriptor>();
  const ruleIndexMap = new Map<string, number>();

  // Build rules from unique finding types
  for (const finding of results.findings || []) {
    const ruleId = finding.type || 'secret-detected';
    if (!ruleMap.has(ruleId)) {
      const index = ruleMap.size;
      ruleIndexMap.set(ruleId, index);
      ruleMap.set(ruleId, {
        id: ruleId,
        name: ruleId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        shortDescription: {
          text: `Detected ${ruleId.replace(/_/g, ' ')}`,
        },
        fullDescription: {
          text: finding.recommendation?.reason || `Potential ${ruleId} detected in source code`,
        },
        help: {
          text: finding.recommendation?.remediation || 'Move secrets to environment variables or secure vault',
          markdown: `## Remediation\n\n${finding.recommendation?.remediation || 'Move secrets to environment variables or secure vault'}\n\n[Learn more](https://guardrailai.dev/docs/secrets)`,
        },
        helpUri: 'https://guardrailai.dev/docs/secrets',
        defaultConfiguration: {
          level: severityToLevel(finding.risk || 'high'),
          enabled: true,
        },
        properties: {
          tags: ['security', 'secrets', finding.risk || 'high'],
          precision: 'high',
        },
      });
    }
  }

  const sarifResults: SarifResult[] = (results.findings || []).map((f: any) => {
    const ruleId = f.type || 'secret-detected';
    return {
      ruleId,
      ruleIndex: ruleIndexMap.get(ruleId),
      level: severityToLevel(f.risk || 'high'),
      message: {
        text: `${f.type}: ${f.match}${f.isTest ? ' (in test file)' : ''}`,
      },
      locations: [{
        physicalLocation: {
          artifactLocation: {
            uri: f.file.replace(/\\/g, '/'),
            uriBaseId: '%SRCROOT%',
          },
          region: {
            startLine: f.line,
            startColumn: 1,
            snippet: {
              text: f.match,
            },
          },
        },
      }],
      partialFingerprints: {
        'guardrail/v1': generateFingerprint(f),
      },
      fingerprints: {
        'guardrail/v1': `${f.type}:${f.file}:${f.line}`,
      },
      properties: {
        confidence: f.confidence,
        entropy: f.entropy,
        isTest: f.isTest,
        risk: f.risk,
      },
      fixes: f.recommendation?.remediation ? [{
        description: {
          text: f.recommendation.remediation,
        },
        artifactChanges: [{
          artifactLocation: {
            uri: f.file.replace(/\\/g, '/'),
            uriBaseId: '%SRCROOT%',
          },
          replacements: [{
            deletedRegion: {
              startLine: f.line,
              startColumn: 1,
            },
            insertedContent: {
              text: '// TODO: Move to environment variable',
            },
          }],
        }],
      }] : undefined,
    };
  });

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'guardrail',
          version,
          semanticVersion: version,
          informationUri: 'https://guardrailai.dev',
          organization: 'guardrail Security',
          rules: Array.from(ruleMap.values()),
        },
      },
      results: sarifResults,
      invocations: [{
        executionSuccessful: true,
        startTimeUtc: new Date().toISOString(),
        endTimeUtc: new Date().toISOString(),
        workingDirectory: {
          uri: results.projectPath?.replace(/\\/g, '/') || '.',
        },
        exitCode: 0,
      }],
      properties: {
        scanType: 'secrets',
        filesScanned: results.filesScanned,
        patterns: results.patterns,
      },
    }],
  };
}

/**
 * Convert vulnerability scan results to SARIF v2.1.0
 */
export function vulnerabilitiesToSarif(results: any): SarifLog {
  const version = getVersion();

  const rules: SarifReportingDescriptor[] = [{
    id: 'vulnerable-dependency',
    name: 'Vulnerable Dependency',
    shortDescription: {
      text: 'Known vulnerability in dependency',
    },
    fullDescription: {
      text: 'A dependency with a known security vulnerability was detected. Update to the fixed version to remediate.',
    },
    help: {
      text: 'Update vulnerable dependencies to their fixed versions',
      markdown: '## Remediation\n\nUpdate the vulnerable dependency to the version specified in the fix recommendation.\n\n[Learn more](https://guardrailai.dev/docs/vulnerabilities)',
    },
    helpUri: 'https://guardrailai.dev/docs/vulnerabilities',
    defaultConfiguration: {
      level: 'error',
      enabled: true,
    },
    properties: {
      tags: ['security', 'vulnerability', 'dependencies'],
      precision: 'very-high',
    },
  }];

  const sarifResults: SarifResult[] = (results.findings || []).map((f: any) => ({
    ruleId: 'vulnerable-dependency',
    ruleIndex: 0,
    level: severityToLevel(f.severity),
    message: {
      text: `${f.cve}: ${f.title} in ${f.package}@${f.version}`,
      markdown: `**${f.cve}**: ${f.title}\n\n**Package**: \`${f.package}@${f.version}\`\n**Fix**: Upgrade to \`${f.fixedIn}\``,
    },
    locations: [{
      physicalLocation: {
        artifactLocation: {
          uri: 'package.json',
          uriBaseId: '%SRCROOT%',
        },
        region: {
          startLine: 1,
        },
      },
    }],
    partialFingerprints: {
      'guardrail/v1': generateFingerprint(f),
    },
    fingerprints: {
      'guardrail/v1': `${f.cve}:${f.package}:${f.version}`,
    },
    properties: {
      cve: f.cve,
      package: f.package,
      version: f.version,
      fixedIn: f.fixedIn,
      severity: f.severity,
    },
    fixes: [{
      description: {
        text: `Upgrade ${f.package} to ${f.fixedIn}`,
      },
      artifactChanges: [{
        artifactLocation: {
          uri: 'package.json',
          uriBaseId: '%SRCROOT%',
        },
        replacements: [{
          deletedRegion: {
            startLine: 1,
          },
          insertedContent: {
            text: `"${f.package}": "${f.fixedIn}"`,
          },
        }],
      }],
    }],
  }));

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'guardrail',
          version,
          semanticVersion: version,
          informationUri: 'https://guardrailai.dev',
          organization: 'guardrail Security',
          rules,
        },
      },
      results: sarifResults,
      invocations: [{
        executionSuccessful: true,
        startTimeUtc: new Date().toISOString(),
        endTimeUtc: new Date().toISOString(),
        workingDirectory: {
          uri: results.projectPath?.replace(/\\/g, '/') || '.',
        },
        exitCode: 0,
      }],
      properties: {
        scanType: 'vulnerabilities',
        packagesScanned: results.packagesScanned,
        auditSource: results.auditSource,
      },
    }],
  };
}

/**
 * Convert combined scan results to SARIF v2.1.0
 */
export function combinedToSarif(results: any): SarifLog {
  const version = getVersion();
  const allRules: SarifReportingDescriptor[] = [];
  const allResults: SarifResult[] = [];
  const ruleIndexMap = new Map<string, number>();

  // Add secrets rules and results
  if (results.secrets) {
    const secretsSarif = secretsToSarif(results.secrets);
    const secretsRun = secretsSarif.runs[0];
<<<<<<< HEAD
    if (secretsRun) {
      for (const rule of secretsRun.tool.driver.rules || []) {
        ruleIndexMap.set(rule.id, allRules.length);
        allRules.push(rule);
      }

      for (const result of secretsRun.results) {
        allResults.push({
          ...result,
          ruleIndex: ruleIndexMap.get(result.ruleId),
        });
      }
=======
    
    for (const rule of secretsRun.tool.driver.rules || []) {
      ruleIndexMap.set(rule.id, allRules.length);
      allRules.push(rule);
    }
    
    for (const result of secretsRun.results) {
      allResults.push({
        ...result,
        ruleIndex: ruleIndexMap.get(result.ruleId),
      });
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    }
  }

  // Add vulnerability rules and results
  if (results.vulnerabilities) {
    const vulnSarif = vulnerabilitiesToSarif(results.vulnerabilities);
    const vulnRun = vulnSarif.runs[0];
<<<<<<< HEAD
    if (vulnRun) {
      for (const rule of vulnRun.tool.driver.rules || []) {
        if (!ruleIndexMap.has(rule.id)) {
          ruleIndexMap.set(rule.id, allRules.length);
          allRules.push(rule);
        }
      }

      for (const result of vulnRun.results) {
        allResults.push({
          ...result,
          ruleIndex: ruleIndexMap.get(result.ruleId),
        });
      }
    }
=======
    
    for (const rule of vulnRun.tool.driver.rules || []) {
      if (!ruleIndexMap.has(rule.id)) {
        ruleIndexMap.set(rule.id, allRules.length);
        allRules.push(rule);
      }
    }
    
    for (const result of vulnRun.results) {
      allResults.push({
        ...result,
        ruleIndex: ruleIndexMap.get(result.ruleId),
      });
    }
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  }

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'guardrail',
          version,
          semanticVersion: version,
          informationUri: 'https://guardrailai.dev',
          organization: 'guardrail Security',
          rules: allRules,
        },
      },
      results: allResults,
      invocations: [{
        executionSuccessful: true,
        startTimeUtc: new Date().toISOString(),
        endTimeUtc: new Date().toISOString(),
        exitCode: 0,
      }],
      properties: {
        scanType: 'combined',
        duration: results.duration,
      },
    }],
  };
}
