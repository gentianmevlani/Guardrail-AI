import type {
    IssueSeverity,
    IssueType,
    LocalScanResult,
    ScanIssue,
    ScanProgress,
    ScanSummary,
    WorkerMessage,
    WorkerResponse
} from '../lib/scanner/types';

const ctx: Worker = self as unknown as Worker;

function getLanguageFromExtension(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  const langMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.json': 'json',
    '.env': 'env',
    '.yaml': 'yaml',
    '.yml': 'yaml'
  };
  return langMap[ext] || 'text';
}

interface RuleMatch {
  pattern: RegExp;
  message: string;
  severity: IssueSeverity;
  autoFixAvailable: boolean;
  suggestedFix?: string;
}

const MOCK_DATA_PATTERNS: RuleMatch[] = [
  { pattern: /lorem\s+ipsum/gi, message: 'Lorem ipsum placeholder text detected', severity: 'medium', autoFixAvailable: false },
  { pattern: /test@test\.com|user@example\.com|admin@admin\.com|foo@bar\.com/gi, message: 'Test email address detected', severity: 'medium', autoFixAvailable: true, suggestedFix: 'process.env.TEST_EMAIL' },
  { pattern: /123-456-7890|555-\d{3}-\d{4}|\(555\)\s*\d{3}-\d{4}/g, message: 'Fake phone number detected', severity: 'low', autoFixAvailable: false },
  { pattern: /["']John\s+Doe["']|["']Jane\s+Doe["']|["']Test\s+User["']/gi, message: 'Placeholder name detected', severity: 'low', autoFixAvailable: false },
  { pattern: /00000000-0000-0000-0000-000000000000|11111111-1111-1111-1111-111111111111/g, message: 'Fake UUID detected', severity: 'medium', autoFixAvailable: true, suggestedFix: 'crypto.randomUUID()' },
];

const PLACEHOLDER_API_PATTERNS: RuleMatch[] = [
  { pattern: /localhost:\d+/g, message: 'Localhost URL detected - use environment variable', severity: 'high', autoFixAvailable: true, suggestedFix: 'process.env.API_URL' },
  { pattern: /127\.0\.0\.1:\d+/g, message: 'Localhost IP detected - use environment variable', severity: 'high', autoFixAvailable: true, suggestedFix: 'process.env.API_URL' },
  { pattern: /https?:\/\/example\.com/gi, message: 'Example.com placeholder URL detected', severity: 'medium', autoFixAvailable: true, suggestedFix: 'process.env.API_URL' },
  { pattern: /https?:\/\/api\.fake\.[a-z]+/gi, message: 'Fake API URL detected', severity: 'high', autoFixAvailable: true, suggestedFix: 'process.env.API_URL' },
  { pattern: /https?:\/\/jsonplaceholder\.typicode\.com/gi, message: 'JSONPlaceholder test API detected', severity: 'medium', autoFixAvailable: false },
  { pattern: /https?:\/\/reqres\.in/gi, message: 'Reqres test API detected', severity: 'medium', autoFixAvailable: false },
  { pattern: /https?:\/\/httpbin\.org/gi, message: 'HTTPBin test API detected', severity: 'medium', autoFixAvailable: false },
];

const SECRET_PATTERNS: RuleMatch[] = [
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["'`]([a-zA-Z0-9_\-]{20,})["'`]/gi, message: 'Hardcoded API key detected', severity: 'critical', autoFixAvailable: true, suggestedFix: 'process.env.API_KEY' },
  { pattern: /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g, message: 'AWS Access Key ID detected', severity: 'critical', autoFixAvailable: true, suggestedFix: 'process.env.AWS_ACCESS_KEY_ID' },
  { pattern: /sk-[a-zA-Z0-9]{48}/g, message: 'OpenAI API key detected', severity: 'critical', autoFixAvailable: true, suggestedFix: 'process.env.OPENAI_API_KEY' },
  { pattern: /ghp_[a-zA-Z0-9]{36}/g, message: 'GitHub Personal Access Token detected', severity: 'critical', autoFixAvailable: true, suggestedFix: 'process.env.GITHUB_TOKEN' },
  { pattern: /xox[baprs]-[a-zA-Z0-9\-]{10,}/g, message: 'Slack token detected', severity: 'critical', autoFixAvailable: true, suggestedFix: 'process.env.SLACK_TOKEN' },
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/g, message: 'Stripe live secret key detected', severity: 'critical', autoFixAvailable: true, suggestedFix: 'process.env.STRIPE_SECRET_KEY' },
  { pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'`]([^"'`\s]{8,})["'`]/gi, message: 'Hardcoded password detected', severity: 'critical', autoFixAvailable: true, suggestedFix: 'process.env.PASSWORD' },
  { pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g, message: 'Private key detected', severity: 'critical', autoFixAvailable: false },
  { pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@/gi, message: 'MongoDB connection string with credentials', severity: 'critical', autoFixAvailable: true, suggestedFix: 'process.env.MONGODB_URI' },
  { pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@/gi, message: 'PostgreSQL connection string with credentials', severity: 'critical', autoFixAvailable: true, suggestedFix: 'process.env.DATABASE_URL' },
];

const DEBUG_PATTERNS: RuleMatch[] = [
  { pattern: /console\.log\s*\(/g, message: 'console.log statement - remove before production', severity: 'low', autoFixAvailable: true },
  { pattern: /console\.debug\s*\(/g, message: 'console.debug statement - remove before production', severity: 'low', autoFixAvailable: true },
  { pattern: /console\.trace\s*\(/g, message: 'console.trace statement - remove before production', severity: 'medium', autoFixAvailable: true },
  { pattern: /\bdebugger\b/g, message: 'debugger statement - remove before production', severity: 'high', autoFixAvailable: true },
  { pattern: /print\s*\(/g, message: 'print() statement - remove before production', severity: 'low', autoFixAvailable: true },
  { pattern: /breakpoint\s*\(\)/g, message: 'breakpoint() statement - remove before production', severity: 'high', autoFixAvailable: true },
  { pattern: /alert\s*\(/g, message: 'alert() statement - remove before production', severity: 'medium', autoFixAvailable: true },
];

const TODO_PATTERNS: RuleMatch[] = [
  { pattern: /\/\/\s*TODO\s*:/gi, message: 'TODO comment - address before production', severity: 'low', autoFixAvailable: false },
  { pattern: /\/\/\s*FIXME\s*:/gi, message: 'FIXME comment - fix before production', severity: 'medium', autoFixAvailable: false },
  { pattern: /\/\/\s*HACK\s*:/gi, message: 'HACK comment - refactor before production', severity: 'medium', autoFixAvailable: false },
  { pattern: /\/\/\s*BUG\s*:/gi, message: 'BUG comment - fix before production', severity: 'high', autoFixAvailable: false },
  { pattern: /#\s*TODO\s*:/gi, message: 'TODO comment - address before production', severity: 'low', autoFixAvailable: false },
  { pattern: /#\s*FIXME\s*:/gi, message: 'FIXME comment - fix before production', severity: 'medium', autoFixAvailable: false },
];

function detectPatterns(
  content: string, 
  lines: string[], 
  patterns: RuleMatch[], 
  issueType: IssueType,
  ruleId: string
): ScanIssue[] {
  const issues: ScanIssue[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    
    if (line.trim().startsWith('//') && issueType === 'hardcoded_secret') continue;
    if (line.includes('process.env.') || line.includes('import.meta.env.')) continue;
    
    for (const rule of patterns) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      
      while ((match = regex.exec(line)) !== null) {
        const column = (match.index || 0) + 1;
        const snippetStart = Math.max(0, lineIndex - 1);
        const snippetEnd = Math.min(lines.length, lineIndex + 2);
        const snippet = lines.slice(snippetStart, snippetEnd).join('\n');

        issues.push({
          type: issueType,
          severity: rule.severity,
          line: lineIndex + 1,
          column,
          message: rule.message,
          snippet,
          autoFixAvailable: rule.autoFixAvailable,
          suggestedFix: rule.suggestedFix,
          ruleId
        });
        
        if (!regex.global) break;
      }
    }
  }

  return issues;
}

function scanFileContent(name: string, content: string, relativePath: string): LocalScanResult {
  const startTime = performance.now();
  const issues: ScanIssue[] = [];
  const lines = content.split('\n');
  const language = getLanguageFromExtension(name);

  issues.push(...detectPatterns(content, lines, MOCK_DATA_PATTERNS, 'mock_data', 'mock-data'));
  issues.push(...detectPatterns(content, lines, PLACEHOLDER_API_PATTERNS, 'placeholder_api', 'placeholder-api'));
  issues.push(...detectPatterns(content, lines, SECRET_PATTERNS, 'hardcoded_secret', 'hardcoded-secret'));
  
  if (['javascript', 'typescript', 'python'].includes(language)) {
    issues.push(...detectPatterns(content, lines, DEBUG_PATTERNS, 'console_log', 'debug-code'));
  }
  
  issues.push(...detectPatterns(content, lines, TODO_PATTERNS, 'todo_fixme', 'todo-fixme'));

  issues.sort((a, b) => {
    const severityOrder: Record<IssueSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.line - b.line;
  });

  return {
    file: name,
    relativePath,
    language,
    issues,
    scannedAt: Date.now(),
    parseTime: performance.now() - startTime
  };
}

function calculateSummary(results: LocalScanResult[], duration: number): ScanSummary {
  const bySeverity: Record<IssueSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const byType: Record<IssueType, number> = { 
    mock_data: 0, placeholder_api: 0, hardcoded_secret: 0, todo_fixme: 0, console_log: 0, debug_code: 0 
  };
  
  let totalIssues = 0;
  let filesWithIssues = 0;

  for (const result of results) {
    if (result.issues.length > 0) filesWithIssues++;
    
    for (const issue of result.issues) {
      totalIssues++;
      bySeverity[issue.severity]++;
      byType[issue.type]++;
    }
  }

  return {
    totalFiles: results.length,
    totalIssues,
    bySeverity,
    byType,
    scanDuration: duration,
    filesWithIssues
  };
}

ctx.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, files } = event.data;

  if (type === 'cancel') {
    return;
  }

  if (type === 'scan' && files) {
    const startTime = performance.now();
    const results: LocalScanResult[] = [];
    let issuesFound = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const progress: ScanProgress = {
        phase: 'scanning',
        currentFile: file.relativePath,
        filesProcessed: i,
        totalFiles: files.length,
        issuesFound,
        percentage: Math.round((i / files.length) * 100)
      };
      
      ctx.postMessage({ type: 'progress', progress } as WorkerResponse);

      const result = scanFileContent(file.name, file.content, file.relativePath);
      results.push(result);
      issuesFound += result.issues.length;

      ctx.postMessage({ type: 'result', result } as WorkerResponse);
    }

    const duration = performance.now() - startTime;
    const summary = calculateSummary(results, duration);

    ctx.postMessage({ 
      type: 'complete', 
      summary,
      progress: {
        phase: 'complete',
        currentFile: '',
        filesProcessed: files.length,
        totalFiles: files.length,
        issuesFound,
        percentage: 100
      }
    } as WorkerResponse);
  }
};

export { };

