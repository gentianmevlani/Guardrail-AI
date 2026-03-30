import type { LocalScanResult, ScanIssue } from '../types';
import { getLanguageFromExtension } from '../types';
import { detectDebugCode, detectTodoFixme } from './debug-code';
import { detectHardcodedSecrets } from './hardcoded-secret';
import { detectMockData } from './mock-data';
import { detectPlaceholderApi } from './placeholder-api';

export interface ParsedFile {
  name: string;
  content: string;
  relativePath: string;
}

export function scanFile(file: ParsedFile): LocalScanResult {
  const startTime = performance.now();
  const issues: ScanIssue[] = [];
  const language = getLanguageFromExtension(file.name);

  issues.push(...detectMockData(file.content, file.name));
  issues.push(...detectPlaceholderApi(file.content, file.name));
  issues.push(...detectHardcodedSecrets(file.content, file.name));
  issues.push(...detectDebugCode(file.content, file.name));
  issues.push(...detectTodoFixme(file.content, file.name));

  issues.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.line - b.line;
  });

  const parseTime = performance.now() - startTime;

  return {
    file: file.name,
    relativePath: file.relativePath,
    language,
    issues,
    scannedAt: Date.now(),
    parseTime
  };
}

export { detectDebugCode, detectTodoFixme } from './debug-code';
export { detectHardcodedSecrets } from './hardcoded-secret';
export { detectMockData } from './mock-data';
export { detectPlaceholderApi } from './placeholder-api';

