import type { ScanIssue } from '../types';

interface RuleMatch {
  pattern: RegExp;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  autoFixAvailable: boolean;
  suggestedFix?: string;
}

const PLACEHOLDER_API_PATTERNS: RuleMatch[] = [
  {
    pattern: /localhost:\d+/g,
    message: 'Localhost URL detected - should use environment variable',
    severity: 'high',
    autoFixAvailable: true,
    suggestedFix: 'process.env.API_URL'
  },
  {
    pattern: /127\.0\.0\.1:\d+/g,
    message: 'Localhost IP detected - should use environment variable',
    severity: 'high',
    autoFixAvailable: true,
    suggestedFix: 'process.env.API_URL'
  },
  {
    pattern: /https?:\/\/example\.com/gi,
    message: 'Example.com placeholder URL detected',
    severity: 'medium',
    autoFixAvailable: true,
    suggestedFix: 'process.env.API_URL'
  },
  {
    pattern: /https?:\/\/api\.fake\.[a-z]+/gi,
    message: 'Fake API URL detected',
    severity: 'high',
    autoFixAvailable: true,
    suggestedFix: 'process.env.API_URL'
  },
  {
    pattern: /https?:\/\/jsonplaceholder\.typicode\.com/gi,
    message: 'JSONPlaceholder test API detected - replace with real API',
    severity: 'medium',
    autoFixAvailable: false
  },
  {
    pattern: /https?:\/\/reqres\.in/gi,
    message: 'Reqres test API detected - replace with real API',
    severity: 'medium',
    autoFixAvailable: false
  },
  {
    pattern: /https?:\/\/httpbin\.org/gi,
    message: 'HTTPBin test API detected - replace with real API',
    severity: 'medium',
    autoFixAvailable: false
  },
  {
    pattern: /https?:\/\/mockapi\.io/gi,
    message: 'MockAPI.io detected - replace with real API',
    severity: 'high',
    autoFixAvailable: false
  },
  {
    pattern: /\/api\/v\d+\/(?:test|mock|fake|dummy)/gi,
    message: 'Test/mock API endpoint path detected',
    severity: 'medium',
    autoFixAvailable: false
  },
  {
    pattern: /fetch\s*\(\s*["'`]\/api\/(?:test|mock)/gi,
    message: 'Fetch call to test/mock endpoint detected',
    severity: 'medium',
    autoFixAvailable: false
  }
];

export function detectPlaceholderApi(content: string, filename: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    
    for (const rule of PLACEHOLDER_API_PATTERNS) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      
      while ((match = regex.exec(line)) !== null) {
        const column = (match.index || 0) + 1;
        const snippetStart = Math.max(0, lineIndex - 1);
        const snippetEnd = Math.min(lines.length, lineIndex + 2);
        const snippet = lines.slice(snippetStart, snippetEnd).join('\n');

        issues.push({
          type: 'placeholder_api',
          severity: rule.severity,
          line: lineIndex + 1,
          column,
          message: rule.message,
          snippet,
          autoFixAvailable: rule.autoFixAvailable,
          suggestedFix: rule.suggestedFix,
          ruleId: 'placeholder-api'
        });
        
        if (!regex.global) break;
      }
    }
  }

  return issues;
}
