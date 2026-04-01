/**
 * SARIF 2.1.0 generator for Guardrail findings.
 * Used by CLI, CI, and IDE integrations (e.g. GitHub Code Scanning).
 */

import * as path from 'path';
import type { Finding } from '../core-types';

const SEVERITY_TO_SARIF: Record<string, string> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'note',
  info: 'note',
};

export interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: { driver: { name: string; version: string; rules: SarifRule[] } };
  results: SarifResult[];
}

interface SarifRule {
  id: string;
  shortDescription: { text: string };
}

interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region: {
        startLine: number;
        startColumn?: number;
        endLine?: number;
        endColumn?: number;
      };
    };
  }>;
  fixes?: Array<{ description: { text: string } }>;
}

/** Input compatible with RunResult.files from FileRunner. */
export interface SarifInput {
  files: Array<{ file: string; relativePath?: string; findings: Finding[] }>;
}

export interface ToSarifOptions {
  toolVersion?: string;
}

/**
 * Convert scan results to SARIF 2.1.0 format.
 */
export function toSarif(
  input: SarifInput,
  workspaceRoot: string,
  options: ToSarifOptions = {}
): SarifLog {
  const { toolVersion = '3.0.0' } = options;
  const rulesMap = new Map<string, SarifRule>();
  const sarifResults: SarifResult[] = [];

  for (const fileResult of input.files) {
    for (const f of fileResult.findings) {
      const ruleId = f.ruleId ?? `${f.engine}-${f.category}`;

      if (!rulesMap.has(ruleId)) {
        rulesMap.set(ruleId, {
          id: ruleId,
          shortDescription: { text: f.message },
        });
      }

      const relPath =
        fileResult.relativePath ??
        path.relative(workspaceRoot, f.file).replace(/\\/g, '/');

      const sarifResult: SarifResult = {
        ruleId,
        level: SEVERITY_TO_SARIF[f.severity] ?? 'warning',
        message: {
          text: f.suggestion
            ? `${f.message}\n\nSuggestion: ${f.suggestion}`
            : f.message,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: relPath },
              region: {
                startLine: f.line,
                ...(f.column != null && { startColumn: f.column + 1 }),
                ...(f.endLine != null && { endLine: f.endLine }),
                ...(f.endColumn != null && { endColumn: f.endColumn + 1 }),
              },
            },
          },
        ],
      };

      if (f.suggestion) {
        sarifResult.fixes = [{ description: { text: f.suggestion } }];
      }

      sarifResults.push(sarifResult);
    }
  }

  return {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Guardrail',
            version: toolVersion,
            rules: [...rulesMap.values()],
          },
        },
        results: sarifResults,
      },
    ],
  };
}
