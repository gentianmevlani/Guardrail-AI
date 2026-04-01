import type { ScanIssue } from '../types';

interface RuleMatch {
  pattern: RegExp;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  autoFixAvailable: boolean;
  suggestedFix?: string;
}

const MOCK_DATA_PATTERNS: RuleMatch[] = [
  {
    pattern: /lorem\s+ipsum/gi,
    message: 'Lorem ipsum placeholder text detected',
    severity: 'medium',
    autoFixAvailable: false
  },
  {
    pattern: /test@test\.com|user@example\.com|admin@admin\.com|foo@bar\.com/gi,
    message: 'Test email address detected',
    severity: 'medium',
    autoFixAvailable: true,
    suggestedFix: 'process.env.TEST_EMAIL || "user@example.com"'
  },
  {
    pattern: /123-456-7890|555-\d{3}-\d{4}|\(555\)\s*\d{3}-\d{4}/g,
    message: 'Fake phone number detected',
    severity: 'low',
    autoFixAvailable: false
  },
  {
    pattern: /["']John\s+Doe["']|["']Jane\s+Doe["']|["']Test\s+User["']/gi,
    message: 'Placeholder name detected',
    severity: 'low',
    autoFixAvailable: false
  },
  {
    pattern: /00000000-0000-0000-0000-000000000000|11111111-1111-1111-1111-111111111111/g,
    message: 'Fake UUID detected',
    severity: 'medium',
    autoFixAvailable: true,
    suggestedFix: 'crypto.randomUUID()'
  },
  {
    pattern: /["']123\s*Main\s*St(?:reet)?["']|["']456\s*Oak\s*Ave(?:nue)?["']/gi,
    message: 'Placeholder address detected',
    severity: 'low',
    autoFixAvailable: false
  },
  {
    pattern: /\$0\.00|\$1\.00|\$9\.99|\$99\.99|\$100\.00/g,
    message: 'Placeholder price detected',
    severity: 'low',
    autoFixAvailable: false
  },
  {
    pattern: /["']ACME\s+(?:Corp|Inc|Company)["']|["']Foo\s*Bar\s*Inc["']/gi,
    message: 'Placeholder company name detected',
    severity: 'low',
    autoFixAvailable: false
  },
  {
    pattern: /data:\s*\[\s*\{[^}]*(?:id|name|title):\s*["'][^"']*["'][^}]*\}(?:\s*,\s*\{[^}]*\})*\s*\]/g,
    message: 'Hardcoded mock data array detected',
    severity: 'medium',
    autoFixAvailable: false
  }
];

export function detectMockData(content: string, filename: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    
    for (const rule of MOCK_DATA_PATTERNS) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      
      while ((match = regex.exec(line)) !== null) {
        const column = (match.index || 0) + 1;
        const snippetStart = Math.max(0, lineIndex - 1);
        const snippetEnd = Math.min(lines.length, lineIndex + 2);
        const snippet = lines.slice(snippetStart, snippetEnd).join('\n');

        issues.push({
          type: 'mock_data',
          severity: rule.severity,
          line: lineIndex + 1,
          column,
          message: rule.message,
          snippet,
          autoFixAvailable: rule.autoFixAvailable,
          suggestedFix: rule.suggestedFix,
          ruleId: 'mock-data'
        });
        
        if (!regex.global) break;
      }
    }
  }

  return issues;
}
