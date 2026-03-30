import { ComplianceScanResult, RuleResult } from '../types';

interface SarifReport {
  version: string;
  $schema: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      rules: SarifRule[];
    };
  };
  results: SarifResult[];
  properties?: {
    summary: any;
    drift?: any;
  };
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: {
    text: string;
  };
  fullDescription?: {
    text: string;
  };
  help?: {
    text: string;
  };
  properties: {
    tags: string[];
    'security-severity': string;
  };
}

interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note';
  message: {
    text: string;
  };
  locations?: Array<{
    physicalLocation: {
      artifactLocation: {
        uri: string;
      };
    };
  }>;
  properties?: {
    evidenceRefs: string[];
    remediation: string;
  };
}

export class SarifFormatter {
  format(result: ComplianceScanResult): string {
    const sarif: SarifReport = {
      version: '2.1.0',
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs: [
        {
          tool: {
            driver: {
              name: 'guardrail Compliance Scanner',
              version: '1.0.0',
              informationUri: 'https://github.com/guardrail/compliance',
              rules: this.buildRules(result)
            }
          },
          results: this.buildResults(result),
          properties: {
            summary: result.summary,
            drift: result.drift
          }
        }
      ]
    };

    return JSON.stringify(sarif, null, 2);
  }

  private buildRules(result: ComplianceScanResult): SarifRule[] {
    const rulesMap = new Map<string, SarifRule>();

    for (const r of result.results) {
      if (!rulesMap.has(r.controlId)) {
        rulesMap.set(r.controlId, {
          id: r.controlId,
          name: r.controlId,
          shortDescription: {
            text: r.message
          },
          fullDescription: {
            text: r.message
          },
          help: {
            text: r.remediation
          },
          properties: {
            tags: [result.framework, r.severity],
            'security-severity': this.getSeverityScore(r.severity)
          }
        });
      }
    }

    return Array.from(rulesMap.values());
  }

  private buildResults(result: ComplianceScanResult): SarifResult[] {
    return result.results
      .filter(r => !r.passed)
      .map(r => this.buildResult(r));
  }

  private buildResult(result: RuleResult): SarifResult {
    const sarifResult: SarifResult = {
      ruleId: result.controlId,
      level: this.mapSeverityToLevel(result.severity),
      message: {
        text: result.message
      },
      properties: {
        evidenceRefs: result.evidenceRefs,
        remediation: result.remediation
      }
    };

    if (result.evidenceRefs.length > 0) {
      sarifResult.locations = result.evidenceRefs.map(ref => ({
        physicalLocation: {
          artifactLocation: {
            uri: ref
          }
        }
      }));
    }

    return sarifResult;
  }

  private mapSeverityToLevel(severity: string): 'error' | 'warning' | 'note' {
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

  private getSeverityScore(severity: string): string {
    switch (severity) {
      case 'critical':
        return '9.0';
      case 'high':
        return '7.0';
      case 'medium':
        return '5.0';
      case 'low':
        return '3.0';
      default:
        return '5.0';
    }
  }
}
