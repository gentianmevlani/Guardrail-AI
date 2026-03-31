/**
 * SARIF Generator
 * 
 * Generates SARIF (Static Analysis Results Interchange Format) output
 * for integration with VS Code, GitHub Code Scanning, and other tools.
 * 
 * SARIF 2.1.0 compliant output for inline diagnostics.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Finding, RunResult } from './state-manager';

export interface SarifLog {
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
  results: SarifResult[];
  invocations: SarifInvocation[];
}

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  helpUri?: string;
  defaultConfiguration: {
    level: 'error' | 'warning' | 'note' | 'none';
  };
  properties?: {
    category?: string;
    tags?: string[];
  };
}

export interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations: SarifLocation[];
  fingerprints?: Record<string, string>;
  fixes?: SarifFix[];
  properties?: Record<string, unknown>;
}

export interface SarifLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string;
      uriBaseId?: string;
    };
    region: {
      startLine: number;
      startColumn?: number;
      endLine?: number;
      endColumn?: number;
      snippet?: { text: string };
    };
  };
  logicalLocations?: {
    name: string;
    kind: string;
  }[];
}

export interface SarifFix {
  description: { text: string };
  artifactChanges: {
    artifactLocation: { uri: string };
    replacements: {
      deletedRegion: { startLine: number; endLine: number };
      insertedContent: { text: string };
    }[];
  }[];
}

export interface SarifInvocation {
  executionSuccessful: boolean;
  commandLine?: string;
  startTimeUtc?: string;
  endTimeUtc?: string;
  workingDirectory?: { uri: string };
}

const RULE_DEFINITIONS: Record<string, Omit<SarifRule, 'id'>> = {
  'fake-api-domain': {
    name: 'Fake API Domain',
    shortDescription: { text: 'Request to mock/staging/localhost API detected' },
    fullDescription: { text: 'Production code is making requests to a fake API domain (localhost, jsonplaceholder, mockapi, etc.). This indicates the app is not ready for production.' },
    helpUri: 'https://guardrailai.dev/rules/fake-api-domain',
    defaultConfiguration: { level: 'error' },
    properties: { category: 'Network', tags: ['production-readiness', 'fake-data'] },
  },
  'demo-response-data': {
    name: 'Demo Response Data',
    shortDescription: { text: 'Response contains demo/placeholder data' },
    fullDescription: { text: 'API response contains demo identifiers, placeholder text, or test data that should not appear in production.' },
    helpUri: 'https://guardrailai.dev/rules/demo-response-data',
    defaultConfiguration: { level: 'error' },
    properties: { category: 'Data', tags: ['production-readiness', 'fake-data'] },
  },
  'mock-import': {
    name: 'Mock Import',
    shortDescription: { text: 'Production code imports mock module' },
    fullDescription: { text: 'Production code imports from a mock, fake, or test module. These imports should be removed or conditionalized for production builds.' },
    helpUri: 'https://guardrailai.dev/rules/mock-import',
    defaultConfiguration: { level: 'error' },
    properties: { category: 'Imports', tags: ['production-readiness', 'mock-data'] },
  },
  'test-api-keys': {
    name: 'Test API Keys',
    shortDescription: { text: 'Test/demo API keys in code' },
    fullDescription: { text: 'Test or demo API keys detected in the codebase. Production should use real API keys stored securely in environment variables.' },
    helpUri: 'https://guardrailai.dev/rules/test-api-keys',
    defaultConfiguration: { level: 'error' },
    properties: { category: 'Security', tags: ['security', 'secrets'] },
  },
  'simulated-billing': {
    name: 'Simulated Billing',
    shortDescription: { text: 'Billing appears to be simulated' },
    fullDescription: { text: 'Billing or payment functionality appears to be using test mode or simulated responses. Switch to live billing for production.' },
    helpUri: 'https://guardrailai.dev/rules/simulated-billing',
    defaultConfiguration: { level: 'error' },
    properties: { category: 'Billing', tags: ['production-readiness', 'billing'] },
  },
  'localhost-url': {
    name: 'Localhost URL',
    shortDescription: { text: 'Hardcoded localhost URL' },
    fullDescription: { text: 'Hardcoded localhost URL found in production code. Use environment variables for API URLs.' },
    helpUri: 'https://guardrailai.dev/rules/localhost-url',
    defaultConfiguration: { level: 'error' },
    properties: { category: 'Configuration', tags: ['production-readiness', 'configuration'] },
  },
  'banned-pattern': {
    name: 'Banned Pattern',
    shortDescription: { text: 'Banned code pattern detected' },
    fullDescription: { text: 'Code contains a pattern that is banned by project policy. Review and fix according to project guidelines.' },
    helpUri: 'https://guardrailai.dev/rules/banned-pattern',
    defaultConfiguration: { level: 'error' },
    properties: { category: 'Code Quality', tags: ['policy'] },
  },
  'silent-fallback': {
    name: 'Silent Fallback Success',
    shortDescription: { text: 'Error silently returns success' },
    fullDescription: { text: 'Error handling code silently returns success or default data instead of propagating the error. This can hide real issues in production.' },
    helpUri: 'https://guardrailai.dev/rules/silent-fallback',
    defaultConfiguration: { level: 'warning' },
    properties: { category: 'Error Handling', tags: ['error-handling'] },
  },
};

class SarifGenerator {
  private projectPath: string = '';

  initialize(projectPath: string): void {
    this.projectPath = projectPath;
  }

  generateFromRun(run: RunResult): SarifLog {
    const rules: SarifRule[] = [];
    const ruleIndexMap = new Map<string, number>();
    const results: SarifResult[] = [];

    // Collect unique rules and build index map
    for (const finding of run.findings) {
      if (!ruleIndexMap.has(finding.ruleId)) {
        const ruleIndex = rules.length;
        ruleIndexMap.set(finding.ruleId, ruleIndex);
        
        const ruleDef = RULE_DEFINITIONS[finding.ruleId] || {
          name: finding.title,
          shortDescription: { text: finding.title },
          fullDescription: { text: finding.description },
          defaultConfiguration: { level: this.severityToLevel(finding.severity) },
        };
        
        rules.push({
          id: finding.ruleId,
          ...ruleDef,
        });
      }
    }

    // Generate results
    for (const finding of run.findings) {
      results.push(this.findingToResult(finding, ruleIndexMap.get(finding.ruleId)!));
    }

    return {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [{
        tool: {
          driver: {
            name: 'guardrail',
            version: '1.0.0',
            informationUri: 'https://guardrailai.dev',
            rules,
          },
        },
        results,
        invocations: [{
          executionSuccessful: run.verdict === 'SHIP' || run.verdict === 'PASS',
          startTimeUtc: run.timestamp,
          workingDirectory: { uri: `file:///${this.projectPath.replace(/\\/g, '/')}` },
        }],
      }],
    };
  }

  generateFromFindings(findings: Finding[]): SarifLog {
    const mockRun: RunResult = {
      id: 'sarif-export',
      tool: 'ship',
      verdict: findings.length > 0 ? 'NO-SHIP' : 'SHIP',
      timestamp: new Date().toISOString(),
      duration: 0,
      findings,
      blockers: findings.filter(f => f.severity === 'critical' || f.severity === 'high'),
      warnings: findings.filter(f => f.severity === 'medium' || f.severity === 'low'),
      artifacts: [],
      summary: {
        totalFindings: findings.length,
        criticalCount: findings.filter(f => f.severity === 'critical').length,
        highCount: findings.filter(f => f.severity === 'high').length,
        mediumCount: findings.filter(f => f.severity === 'medium').length,
        lowCount: findings.filter(f => f.severity === 'low').length,
      },
    };
    
    return this.generateFromRun(mockRun);
  }

  private findingToResult(finding: Finding, ruleIndex: number): SarifResult {
    const result: SarifResult = {
      ruleId: finding.ruleId,
      ruleIndex,
      level: this.severityToLevel(finding.severity),
      message: { text: this.formatMessage(finding) },
      locations: [{
        physicalLocation: {
          artifactLocation: {
            uri: this.toFileUri(finding.file),
            uriBaseId: '%SRCROOT%',
          },
          region: {
            startLine: finding.line,
            startColumn: finding.column || 1,
            endLine: finding.endLine || finding.line,
            endColumn: finding.endColumn,
            snippet: finding.evidence?.content ? { text: finding.evidence.content.substring(0, 200) } : undefined,
          },
        },
      }],
      fingerprints: {
        'guardrail/v1': finding.id,
      },
      properties: {
        runId: finding.runId,
        evidenceType: finding.evidence?.type,
      },
    };

    // Add fix if available
    if (finding.fix?.autoFixable && finding.fix.diff) {
      result.fixes = [{
        description: { text: finding.fix.suggestion },
        artifactChanges: [{
          artifactLocation: { uri: this.toFileUri(finding.file) },
          replacements: [{
            deletedRegion: { startLine: finding.line, endLine: finding.endLine || finding.line },
            insertedContent: { text: finding.fix.diff },
          }],
        }],
      }];
    }

    return result;
  }

  private formatMessage(finding: Finding): string {
    let message = finding.title;
    
    if (finding.description && finding.description !== finding.title) {
      message += `\n\n${finding.description}`;
    }
    
    if (finding.evidence?.content) {
      message += `\n\nEvidence: ${finding.evidence.content.substring(0, 100)}`;
    }
    
    if (finding.fix?.suggestion) {
      message += `\n\nSuggested fix: ${finding.fix.suggestion}`;
    }
    
    return message;
  }

  private severityToLevel(severity: Finding['severity']): SarifResult['level'] {
    switch (severity) {
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

  private toFileUri(filePath: string): string {
    // Convert to relative path if within project
    if (this.projectPath && filePath.startsWith(this.projectPath)) {
      return filePath.substring(this.projectPath.length + 1).replace(/\\/g, '/');
    }
    return filePath.replace(/\\/g, '/');
  }

  async saveToFile(sarif: SarifLog, outputPath: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, JSON.stringify(sarif, null, 2));
  }

  async loadFromFile(inputPath: string): Promise<SarifLog> {
    const content = await fs.promises.readFile(inputPath, 'utf-8');
    return JSON.parse(content);
  }

  // Generate VS Code diagnostics format
  toVSCodeDiagnostics(sarif: SarifLog): {
    uri: string;
    diagnostics: {
      range: { start: { line: number; character: number }; end: { line: number; character: number } };
      message: string;
      severity: number; // 0=Error, 1=Warning, 2=Information, 3=Hint
      source: string;
      code: string;
    }[];
  }[] {
    const diagnosticsByFile = new Map<string, any[]>();

    for (const run of sarif.runs) {
      for (const result of run.results) {
        for (const location of result.locations) {
          const uri = location.physicalLocation.artifactLocation.uri;
          const region = location.physicalLocation.region;
          
          if (!diagnosticsByFile.has(uri)) {
            diagnosticsByFile.set(uri, []);
          }
          
          diagnosticsByFile.get(uri)!.push({
            range: {
              start: { line: region.startLine - 1, character: (region.startColumn || 1) - 1 },
              end: { line: (region.endLine || region.startLine) - 1, character: (region.endColumn || 999) - 1 },
            },
            message: result.message.text,
            severity: result.level === 'error' ? 0 : result.level === 'warning' ? 1 : 2,
            source: 'guardrail',
            code: result.ruleId,
          });
        }
      }
    }

    return Array.from(diagnosticsByFile.entries()).map(([uri, diagnostics]) => ({
      uri,
      diagnostics,
    }));
  }
}

export const sarifGenerator = new SarifGenerator();
