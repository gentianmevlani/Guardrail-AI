import type { IssueSeverity, LocalScanResult, ScanSummary } from './types';

export interface SarifReport {
  $schema: string;
  version: string;
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
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  defaultConfiguration: { level: string };
}

interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations: {
    physicalLocation: {
      artifactLocation: { uri: string };
      region: {
        startLine: number;
        startColumn: number;
      };
    };
  }[];
}

export function exportToJson(results: LocalScanResult[], summary: ScanSummary): string {
  const report = {
    generatedAt: new Date().toISOString(),
    generator: 'guardrail Local Scanner',
    version: '1.0.0',
    summary: {
      totalFiles: summary.totalFiles,
      totalIssues: summary.totalIssues,
      filesWithIssues: summary.filesWithIssues,
      scanDuration: `${summary.scanDuration.toFixed(2)}ms`,
      bySeverity: summary.bySeverity,
      byType: summary.byType
    },
    results: results.map(r => ({
      file: r.relativePath,
      language: r.language,
      issueCount: r.issues.length,
      issues: r.issues.map(i => ({
        type: i.type,
        severity: i.severity,
        line: i.line,
        column: i.column,
        message: i.message,
        ruleId: i.ruleId,
        autoFixAvailable: i.autoFixAvailable
      }))
    }))
  };

  return JSON.stringify(report, null, 2);
}

export function exportToSarif(results: LocalScanResult[], summary: ScanSummary): string {
  const severityToLevel: Record<IssueSeverity, string> = {
    critical: 'error',
    high: 'error',
    medium: 'warning',
    low: 'note'
  };

  const rules: SarifRule[] = [
    {
      id: 'mock-data',
      name: 'MockDataDetection',
      shortDescription: { text: 'Mock or placeholder data detected' },
      fullDescription: { text: 'Detects lorem ipsum, test emails, fake phone numbers, and other placeholder data' },
      defaultConfiguration: { level: 'warning' }
    },
    {
      id: 'placeholder-api',
      name: 'PlaceholderApiDetection',
      shortDescription: { text: 'Placeholder API URL detected' },
      fullDescription: { text: 'Detects localhost, example.com, and other placeholder API URLs' },
      defaultConfiguration: { level: 'error' }
    },
    {
      id: 'hardcoded-secret',
      name: 'HardcodedSecretDetection',
      shortDescription: { text: 'Hardcoded secret detected' },
      fullDescription: { text: 'Detects API keys, passwords, tokens, and other secrets in code' },
      defaultConfiguration: { level: 'error' }
    },
    {
      id: 'debug-code',
      name: 'DebugCodeDetection',
      shortDescription: { text: 'Debug code detected' },
      fullDescription: { text: 'Detects console.log, debugger statements, and other debug code' },
      defaultConfiguration: { level: 'warning' }
    },
    {
      id: 'todo-fixme',
      name: 'TodoFixmeDetection',
      shortDescription: { text: 'TODO/FIXME comment detected' },
      fullDescription: { text: 'Detects TODO, FIXME, HACK, and other task comments' },
      defaultConfiguration: { level: 'note' }
    }
  ];

  const sarifResults: SarifResult[] = [];

  for (const fileResult of results) {
    for (const issue of fileResult.issues) {
      sarifResults.push({
        ruleId: issue.ruleId,
        level: severityToLevel[issue.severity],
        message: { text: issue.message },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: fileResult.relativePath },
            region: {
              startLine: issue.line,
              startColumn: issue.column
            }
          }
        }]
      });
    }
  }

  const sarif: SarifReport = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'guardrail Local Scanner',
          version: '1.0.0',
          informationUri: 'https://guardrailai.dev',
          rules
        }
      },
      results: sarifResults
    }]
  };

  return JSON.stringify(sarif, null, 2);
}

export function exportToCsv(results: LocalScanResult[]): string {
  const headers = ['File', 'Line', 'Column', 'Severity', 'Type', 'Message', 'Rule ID', 'Auto-Fix Available'];
  const rows: string[][] = [headers];

  for (const fileResult of results) {
    for (const issue of fileResult.issues) {
      rows.push([
        fileResult.relativePath,
        String(issue.line),
        String(issue.column),
        issue.severity,
        issue.type,
        `"${issue.message.replace(/"/g, '""')}"`,
        issue.ruleId,
        issue.autoFixAvailable ? 'Yes' : 'No'
      ]);
    }
  }

  return rows.map(row => row.join(',')).join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function copyToClipboard(content: string): Promise<void> {
  return navigator.clipboard.writeText(content);
}
