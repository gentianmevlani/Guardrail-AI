/**
 * Secret Detector Check
 * Detects hardcoded secrets, API keys, and credentials in code
 */

import { CheckResult, SECRET_PATTERNS } from '../types';

interface SecretMatch {
  name: string;
  severity: 'critical' | 'high' | 'medium';
  line: number;
  match: string;
  redacted: string;
}

/**
 * Redact a secret for safe display
 */
function redactSecret(secret: string): string {
  if (secret.length <= 8) {
    return '*'.repeat(secret.length);
  }
  const visibleChars = Math.min(4, Math.floor(secret.length / 4));
  return secret.substring(0, visibleChars) + '*'.repeat(secret.length - visibleChars * 2) + secret.substring(secret.length - visibleChars);
}

/**
 * Detect secrets in code content
 */
function detectSecrets(content: string): SecretMatch[] {
  const matches: SecretMatch[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Skip comments (simple heuristic)
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('#') || trimmedLine.startsWith('*')) {
      // Still check for actual secrets in comments - they shouldn't be there either
    }

    for (const { name, pattern, severity } of SECRET_PATTERNS) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        // Use first capture group if available, otherwise use full match
        const matchedValue = match[1] || match[0];
        
        // Skip if it looks like a placeholder/example
        if (isLikelyPlaceholder(matchedValue)) {
          continue;
        }
        
        // For AWS Secret Key pattern, check if line contains "aws" context
        if (name === 'AWS Secret Key' && !/aws/i.test(line)) {
          continue;
        }

        matches.push({
          name,
          severity,
          line: lineNumber,
          match: matchedValue,
          redacted: redactSecret(matchedValue),
        });

        // Prevent infinite loop for zero-length matches
        if (match.index === pattern.lastIndex) {
          pattern.lastIndex++;
        }
      }
    }
  }

  // Deduplicate matches on same line with same pattern
  const unique = new Map<string, SecretMatch>();
  for (const match of matches) {
    const key = `${match.line}-${match.name}-${match.match}`;
    if (!unique.has(key)) {
      unique.set(key, match);
    }
  }

  return Array.from(unique.values());
}

/**
 * Check if a matched string is likely a placeholder/example
 */
function isLikelyPlaceholder(value: string): boolean {
  // Don't filter out AWS keys even if they contain "EXAMPLE" - they're still secrets
  if (/^AKIA[0-9A-Z]{15,16}$/.test(value)) {
    return false;
  }
  
  const placeholderPatterns = [
    /^[xX]+$/,
    /^0+$/,
    /your[-_]?api[-_]?key/i,
    /^example$/i, // Only exact match "example", not if it's part of a longer string
    /^placeholder$/i,
    /changeme/i,
    /replace[-_]?me/i,
    /insert[-_]?here/i,
    /<.*>/,
    /\$\{.*\}/,
    /{{.*}}/,
  ];

  return placeholderPatterns.some(p => p.test(value));
}

/**
 * Check if secret is in an environment variable reference (safe)
 */
function isEnvVarReference(line: string): boolean {
  return /process\.env\.[A-Z_]+/.test(line) ||
    /\$\{?[A-Z_]+\}?/.test(line) ||
    /os\.environ/.test(line) ||
    /getenv\(/.test(line);
}

/**
 * Validate file content for secrets
 */
export function validateFileForSecrets(
  content: string,
  filePath: string
): CheckResult {
  // Skip certain file types that commonly have test/example secrets
  const skipExtensions = ['.md', '.txt', '.rst', '.adoc'];
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  if (skipExtensions.includes(ext.toLowerCase())) {
    return {
      check: 'secret-detection',
      status: 'pass',
      message: 'Skipped documentation file',
      file: filePath,
    };
  }

  // Skip test fixtures/mocks
  if (filePath.includes('__mocks__') || filePath.includes('/fixtures/')) {
    return {
      check: 'secret-detection',
      status: 'pass',
      message: 'Skipped test fixture/mock file',
      file: filePath,
    };
  }

  const secrets = detectSecrets(content);

  if (secrets.length === 0) {
    return {
      check: 'secret-detection',
      status: 'pass',
      message: 'No secrets detected',
      file: filePath,
    };
  }

  // Filter out false positives from env var references
  const lines = content.split('\n');
  const realSecrets = secrets.filter(secret => {
    const line = lines[secret.line - 1] || '';
    return !isEnvVarReference(line);
  });

  if (realSecrets.length === 0) {
    return {
      check: 'secret-detection',
      status: 'pass',
      message: 'All detected patterns are environment variable references',
      file: filePath,
    };
  }

  // Group by severity
  const critical = realSecrets.filter(s => s.severity === 'critical');
  const high = realSecrets.filter(s => s.severity === 'high');
  const medium = realSecrets.filter(s => s.severity === 'medium');

  if (critical.length > 0) {
    return {
      check: 'secret-detection',
      status: 'fail',
      message: `${critical.length} CRITICAL secret(s) detected`,
      file: filePath,
      line: critical[0].line,
      details: critical.map(s => `Line ${s.line}: ${s.name} (${s.redacted})`).join('\n'),
      suggestedFix: 'Move secrets to environment variables or a secrets manager',
      blockers: critical.map(s => `${filePath}:${s.line} - Hardcoded ${s.name}`),
    };
  }

  if (high.length > 0) {
    return {
      check: 'secret-detection',
      status: 'fail',
      message: `${high.length} HIGH severity secret(s) detected`,
      file: filePath,
      line: high[0].line,
      details: high.map(s => `Line ${s.line}: ${s.name} (${s.redacted})`).join('\n'),
      suggestedFix: 'Move secrets to environment variables',
      blockers: high.map(s => `${filePath}:${s.line} - Hardcoded ${s.name}`),
    };
  }

  // Medium severity - warn
  return {
    check: 'secret-detection',
    status: 'warn',
    message: `${medium.length} potential secret(s) detected`,
    file: filePath,
    line: medium[0].line,
    details: medium.map(s => `Line ${s.line}: ${s.name} (${s.redacted})`).join('\n'),
    suggestedFix: 'Review and move to environment variables if real credentials',
  };
}

/**
 * Validate multiple files for secrets
 */
export function validateFilesForSecrets(
  files: Array<{ path: string; content: string }>
): CheckResult {
  const failures: CheckResult[] = [];
  const warnings: CheckResult[] = [];

  for (const file of files) {
    const result = validateFileForSecrets(file.content, file.path);

    if (result.status === 'fail') {
      failures.push(result);
    } else if (result.status === 'warn') {
      warnings.push(result);
    }
  }

  if (failures.length > 0) {
    return {
      check: 'secret-detection',
      status: 'fail',
      message: `Secrets detected in ${failures.length} file(s)`,
      details: failures.map(f => `${f.file}: ${f.message}`).join('\n'),
      blockers: failures.flatMap(f => f.blockers || []),
      suggestedFix: 'Move all hardcoded secrets to environment variables',
    };
  }

  if (warnings.length > 0) {
    return {
      check: 'secret-detection',
      status: 'warn',
      message: `Potential secrets in ${warnings.length} file(s)`,
      details: warnings.map(w => `${w.file}: ${w.message}`).join('\n'),
    };
  }

  return {
    check: 'secret-detection',
    status: 'pass',
    message: `No secrets found in ${files.length} file(s)`,
  };
}
