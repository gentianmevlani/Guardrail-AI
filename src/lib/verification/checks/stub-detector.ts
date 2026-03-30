/**
 * Stub Detector Check
 * Detects placeholder code, TODOs, and unfinished implementations
 */

import { CheckResult, STUB_PATTERNS, VerificationMode } from '../types';

interface StubMatch {
  name: string;
  line: number;
  content: string;
  intentAware: boolean;
}

/**
 * Detect stubs in code content
 */
function detectStubs(content: string): StubMatch[] {
  const matches: StubMatch[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    for (const { name, pattern, intentAware } of STUB_PATTERNS) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;

      if (pattern.test(line)) {
        matches.push({
          name,
          line: lineNumber,
          content: line.trim().substring(0, 100),
          intentAware,
        });
        break; // One match per line is enough
      }
    }
  }

  return matches;
}

/**
 * Check if a stub is allowed in the given context
 * Intent-aware stubs may be allowed in explore mode or if they're in test files
 */
function isStubAllowedInContext(
  stub: StubMatch,
  filePath: string,
  mode: VerificationMode
): boolean {
  // In explore mode, intent-aware stubs are allowed
  if (mode === 'explore' && stub.intentAware) {
    return true;
  }

  // TODOs and FIXMEs are generally allowed in comments during build/explore mode
  if (stub.intentAware && mode !== 'ship') {
    return true;
  }

  // Test files can have mock data (but only if it's actually a test file)
  const isTestFile = /\.(test|spec)\.[jt]sx?$/.test(filePath) ||
    filePath.includes('__tests__') ||
    filePath.includes('__mocks__') ||
    filePath.includes('/test/') ||
    filePath.includes('/tests/');

  if (isTestFile && stub.name.toLowerCase().includes('mock')) {
    return true;
  }

  // Fixture/seed files can have fake data (but not just any file with "mock" in name)
  const isFixtureFile = filePath.includes('/fixtures/') ||
    filePath.includes('/seeds/') ||
    filePath.includes('/seed.') ||
    (filePath.includes('fixture') && !filePath.endsWith('.ts') && !filePath.endsWith('.js'));

  if (isFixtureFile && (stub.name.includes('Fake') || stub.name.includes('Lorem'))) {
    return true;
  }
  
  // Don't allow fake data in regular source files, even if named mock.ts
  if (stub.name === 'Fake data' && !isFixtureFile && !isTestFile) {
    return false;
  }

  return false;
}

/**
 * Validate file content for stubs
 */
export function validateFileForStubs(
  content: string,
  filePath: string,
  mode: VerificationMode
): CheckResult {
  const stubs = detectStubs(content);

  if (stubs.length === 0) {
    return {
      check: 'stub-detection',
      status: 'pass',
      message: 'No stub patterns detected',
      file: filePath,
    };
  }

  // Filter out allowed stubs
  const disallowedStubs = stubs.filter(
    stub => !isStubAllowedInContext(stub, filePath, mode)
  );

  if (disallowedStubs.length === 0) {
    return {
      check: 'stub-detection',
      status: 'pass',
      message: `${stubs.length} stub pattern(s) found but allowed in context`,
      file: filePath,
      details: stubs.map(s => `Line ${s.line}: ${s.name}`).join('\n'),
    };
  }

  // In ship mode, any disallowed stub is a failure
  if (mode === 'ship') {
    return {
      check: 'stub-detection',
      status: 'fail',
      message: `${disallowedStubs.length} unfinished code pattern(s) detected in ship mode`,
      file: filePath,
      details: disallowedStubs.map(s => `Line ${s.line}: ${s.name} - "${s.content}"`).join('\n'),
      line: disallowedStubs[0].line,
      suggestedFix: 'Complete all placeholder code before shipping',
      blockers: disallowedStubs.map(s => `${filePath}:${s.line} - ${s.name}`),
    };
  }

  // In build mode, warn about non-intent-aware stubs
  const criticalStubs = disallowedStubs.filter(s => !s.intentAware);
  if (criticalStubs.length > 0) {
    return {
      check: 'stub-detection',
      status: 'fail',
      message: `${criticalStubs.length} placeholder/unimplemented code pattern(s) detected`,
      file: filePath,
      details: criticalStubs.map(s => `Line ${s.line}: ${s.name} - "${s.content}"`).join('\n'),
      line: criticalStubs[0].line,
      suggestedFix: 'Replace placeholder code with actual implementation',
      blockers: criticalStubs.map(s => `${filePath}:${s.line} - ${s.name}`),
    };
  }

  // Only intent-aware stubs remain - warn in build mode
  return {
    check: 'stub-detection',
    status: 'warn',
    message: `${disallowedStubs.length} TODO/FIXME comment(s) detected`,
    file: filePath,
    details: disallowedStubs.map(s => `Line ${s.line}: ${s.name}`).join('\n'),
    line: disallowedStubs[0].line,
  };
}

/**
 * Validate multiple files for stubs
 */
export function validateFilesForStubs(
  files: Array<{ path: string; content: string }>,
  mode: VerificationMode
): CheckResult {
  const allResults: CheckResult[] = [];
  const failures: CheckResult[] = [];
  const warnings: CheckResult[] = [];

  for (const file of files) {
    const result = validateFileForStubs(file.content, file.path, mode);
    allResults.push(result);

    if (result.status === 'fail') {
      failures.push(result);
    } else if (result.status === 'warn') {
      warnings.push(result);
    }
  }

  if (failures.length > 0) {
    return {
      check: 'stub-detection',
      status: 'fail',
      message: `Stub patterns detected in ${failures.length} file(s)`,
      details: failures.map(f => `${f.file}: ${f.message}`).join('\n'),
      blockers: failures.flatMap(f => f.blockers || []),
      suggestedFix: 'Complete all placeholder code before proceeding',
    };
  }

  if (warnings.length > 0) {
    return {
      check: 'stub-detection',
      status: 'warn',
      message: `TODO/FIXME comments found in ${warnings.length} file(s)`,
      details: warnings.map(w => `${w.file}: ${w.message}`).join('\n'),
    };
  }

  return {
    check: 'stub-detection',
    status: 'pass',
    message: `No problematic stubs in ${files.length} file(s)`,
  };
}

/**
 * Extract new content from diff hunks for stub checking
 */
export function extractAddedLinesFromDiff(diffContent: string): string {
  const lines = diffContent.split('\n');
  const addedLines: string[] = [];

  for (const line of lines) {
    // Lines starting with + but not +++ are additions
    if (line.startsWith('+') && !line.startsWith('+++')) {
      addedLines.push(line.substring(1));
    }
  }

  return addedLines.join('\n');
}
