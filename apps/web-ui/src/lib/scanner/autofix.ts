import type { ScanIssue } from './types';

export interface FixResult {
  file: string;
  originalContent: string;
  fixedContent: string;
  appliedFixes: AppliedFix[];
  skippedFixes: SkippedFix[];
}

export interface AppliedFix {
  issue: ScanIssue;
  oldText: string;
  newText: string;
  line: number;
}

export interface SkippedFix {
  issue: ScanIssue;
  reason: string;
}

export interface DiffLine {
  type: 'unchanged' | 'removed' | 'added';
  content: string;
  lineNumber?: number;
}

export function generateFixes(
  content: string,
  issues: ScanIssue[]
): FixResult {
  const fixableIssues = issues.filter(i => i.autoFixAvailable);
  const appliedFixes: AppliedFix[] = [];
  const skippedFixes: SkippedFix[] = [];
  
  let fixedContent = content;
  const lines = content.split('\n');

  const sortedIssues = [...fixableIssues].sort((a, b) => b.line - a.line);

  for (const issue of sortedIssues) {
    const lineIndex = issue.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) {
      skippedFixes.push({ issue, reason: 'Line out of bounds' });
      continue;
    }

    const line = lines[lineIndex];
    const fixResult = applyFix(line, issue);

    if (fixResult.success && fixResult.newLine !== line) {
      lines[lineIndex] = fixResult.newLine;
      appliedFixes.push({
        issue,
        oldText: line,
        newText: fixResult.newLine,
        line: issue.line
      });
    } else if (!fixResult.success) {
      skippedFixes.push({ issue, reason: fixResult.reason || 'Could not apply fix' });
    }
  }

  fixedContent = lines.join('\n');

  return {
    file: '',
    originalContent: content,
    fixedContent,
    appliedFixes,
    skippedFixes
  };
}

function applyFix(line: string, issue: ScanIssue): { success: boolean; newLine: string; reason?: string } {
  switch (issue.type) {
    case 'console_log':
      return removeConsoleLine(line, issue);
    case 'debug_code':
      return removeDebugStatement(line, issue);
    case 'hardcoded_secret':
      return replaceWithEnvVar(line, issue);
    case 'placeholder_api':
      return replaceWithEnvVar(line, issue);
    case 'mock_data':
      if (issue.suggestedFix) {
        return replaceWithSuggestion(line, issue);
      }
      return { success: false, newLine: line, reason: 'No auto-fix available for this mock data' };
    default:
      return { success: false, newLine: line, reason: 'No auto-fix available' };
  }
}

function removeConsoleLine(line: string, issue: ScanIssue): { success: boolean; newLine: string; reason?: string } {
  const consolePatterns = [
    /console\.log\s*\([^)]*\)\s*;?/g,
    /console\.debug\s*\([^)]*\)\s*;?/g,
    /console\.info\s*\([^)]*\)\s*;?/g,
    /console\.trace\s*\([^)]*\)\s*;?/g,
    /console\.table\s*\([^)]*\)\s*;?/g
  ];

  let newLine = line;
  for (const pattern of consolePatterns) {
    newLine = newLine.replace(pattern, '');
  }

  newLine = newLine.trim();
  
  if (newLine === '' || newLine === ';') {
    return { success: true, newLine: `// ${line.trim()} // REMOVED BY guardrail` };
  }

  return { success: true, newLine };
}

function removeDebugStatement(line: string, issue: ScanIssue): { success: boolean; newLine: string; reason?: string } {
  const debugPatterns = [
    /\bdebugger\b\s*;?/g,
    /alert\s*\([^)]*\)\s*;?/g,
    /breakpoint\s*\(\)\s*;?/g
  ];

  let newLine = line;
  for (const pattern of debugPatterns) {
    newLine = newLine.replace(pattern, '');
  }

  newLine = newLine.trim();
  
  if (newLine === '' || newLine === ';') {
    return { success: true, newLine: `// ${line.trim()} // REMOVED BY guardrail` };
  }

  return { success: true, newLine };
}

function replaceWithEnvVar(line: string, issue: ScanIssue): { success: boolean; newLine: string; reason?: string } {
  if (!issue.suggestedFix) {
    return { success: false, newLine: line, reason: 'No suggested fix available' };
  }

  const urlPatterns = [
    /(["'`])(https?:\/\/localhost:\d+[^"'`]*)(\1)/g,
    /(["'`])(https?:\/\/127\.0\.0\.1:\d+[^"'`]*)(\1)/g,
    /(["'`])(https?:\/\/example\.com[^"'`]*)(\1)/gi,
    /(["'`])(https?:\/\/api\.fake\.[a-z]+[^"'`]*)(\1)/gi
  ];

  let newLine = line;
  let replaced = false;

  for (const pattern of urlPatterns) {
    if (pattern.test(newLine)) {
      newLine = newLine.replace(pattern, issue.suggestedFix);
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    const secretPatterns = [
      /(api[_-]?key\s*[:=]\s*)(["'`])([^"'`]+)(\2)/gi,
      /(secret\s*[:=]\s*)(["'`])([^"'`]+)(\2)/gi,
      /(token\s*[:=]\s*)(["'`])([^"'`]+)(\2)/gi
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(newLine)) {
        newLine = newLine.replace(pattern, `$1${issue.suggestedFix}`);
        replaced = true;
        break;
      }
    }
  }

  return { 
    success: replaced, 
    newLine, 
    reason: replaced ? undefined : 'Could not find pattern to replace' 
  };
}

function replaceWithSuggestion(line: string, issue: ScanIssue): { success: boolean; newLine: string; reason?: string } {
  if (!issue.suggestedFix) {
    return { success: false, newLine: line, reason: 'No suggested fix' };
  }

  return { success: false, newLine: line, reason: 'Manual review required for mock data' };
}

export function generateDiff(original: string, fixed: string): DiffLine[] {
  const originalLines = original.split('\n');
  const fixedLines = fixed.split('\n');
  const diff: DiffLine[] = [];

  const maxLen = Math.max(originalLines.length, fixedLines.length);

  for (let i = 0; i < maxLen; i++) {
    const origLine = originalLines[i];
    const fixedLine = fixedLines[i];

    if (origLine === fixedLine) {
      diff.push({ type: 'unchanged', content: origLine || '', lineNumber: i + 1 });
    } else if (origLine !== undefined && fixedLine !== undefined) {
      diff.push({ type: 'removed', content: origLine, lineNumber: i + 1 });
      diff.push({ type: 'added', content: fixedLine, lineNumber: i + 1 });
    } else if (origLine !== undefined) {
      diff.push({ type: 'removed', content: origLine, lineNumber: i + 1 });
    } else if (fixedLine !== undefined) {
      diff.push({ type: 'added', content: fixedLine, lineNumber: i + 1 });
    }
  }

  return diff;
}

export async function createFixedFilesZip(
  fixResults: Map<string, FixResult>
): Promise<Blob> {
  const files: { name: string; content: string }[] = [];
  
  fixResults.forEach((result, filename) => {
    if (result.appliedFixes.length > 0) {
      files.push({
        name: filename,
        content: result.fixedContent
      });
    }
  });

  const zipContent = files.map(f => 
    `=== ${f.name} ===\n${f.content}\n`
  ).join('\n\n');

  return new Blob([zipContent], { type: 'text/plain' });
}
