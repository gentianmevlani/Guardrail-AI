/**
 * SARIF (Static Analysis Results Interchange Format) Output
 * Standard format for GitHub/Azure DevOps security integration
 * https://sarifweb.azurewebsites.net/
 */

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

function riskToLevel(risk: string): 'error' | 'warning' | 'note' {
  switch (risk) {
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'note';
    default: return 'warning';
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

export function toSarif(results: any): SarifResult {
  const version = getVersion();
  const ruleMap = new Map<string, SarifRule>();
  
  // Build rules from unique finding types
  for (const finding of results.findings || []) {
    if (!ruleMap.has(finding.type)) {
      ruleMap.set(finding.type, {
        id: finding.type,
        name: finding.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        shortDescription: { text: `Detected ${finding.type.replace(/_/g, ' ')}` },
        fullDescription: { text: finding.recommendation?.reason || `Potential ${finding.type} detected in source code` },
        helpUri: 'https://guardrailai.dev/docs/secrets',
        defaultConfiguration: { level: riskToLevel(finding.risk) },
      });
    }
  }
  
  const sarifResults: SarifFinding[] = (results.findings || []).map((f: any) => ({
    ruleId: f.type,
    level: riskToLevel(f.risk),
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
        },
      },
    }],
    fingerprints: {
      'guardrail/v1': `${f.type}:${f.file}:${f.line}`,
    },
    properties: {
      confidence: f.confidence,
      entropy: f.entropy,
      isTest: f.isTest,
      remediation: f.recommendation?.remediation,
    },
  }));
  
  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'guardrail-cli-tool',
          version,
          informationUri: 'https://guardrailai.dev',
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

export function toSarifVulnerabilities(results: any): SarifResult {
  const version = getVersion();
  
  const rules: SarifRule[] = [{
    id: 'vulnerable-dependency',
    name: 'Vulnerable Dependency',
    shortDescription: { text: 'Known vulnerability in dependency' },
    helpUri: 'https://guardrailai.dev/docs/vulnerabilities',
    defaultConfiguration: { level: 'error' },
  }];
  
  const sarifResults: SarifFinding[] = (results.findings || []).map((f: any) => ({
    ruleId: 'vulnerable-dependency',
    level: riskToLevel(f.severity),
    message: { 
      text: `${f.cve}: ${f.title} in ${f.package}@${f.version}. Fix: upgrade to ${f.fixedIn}`,
    },
    locations: [{
      physicalLocation: {
        artifactLocation: {
          uri: 'package.json',
          uriBaseId: '%SRCROOT%',
        },
        region: { startLine: 1 },
      },
    }],
    fingerprints: {
      'guardrail/v1': `${f.cve}:${f.package}:${f.version}`,
    },
    properties: {
      cve: f.cve,
      package: f.package,
      version: f.version,
      fixedIn: f.fixedIn,
    },
  }));
  
  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'guardrail-cli-tool',
          version,
          informationUri: 'https://guardrailai.dev',
          rules,
        },
      },
      results: sarifResults,
      invocations: [{
        executionSuccessful: true,
        startTimeUtc: new Date().toISOString(),
      }],
    }],
  };
}
