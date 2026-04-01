import type { ScanIssue } from '../types';

interface DebugPattern {
  pattern: RegExp;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  language: string[];
  autoFixAvailable: boolean;
}

const DEBUG_PATTERNS: DebugPattern[] = [
  {
    pattern: /console\.log\s*\(/g,
    message: 'console.log statement detected - remove before production',
    severity: 'low',
    language: ['javascript', 'typescript'],
    autoFixAvailable: true
  },
  {
    pattern: /console\.debug\s*\(/g,
    message: 'console.debug statement detected - remove before production',
    severity: 'low',
    language: ['javascript', 'typescript'],
    autoFixAvailable: true
  },
  {
    pattern: /console\.info\s*\(/g,
    message: 'console.info statement detected - consider using proper logging',
    severity: 'low',
    language: ['javascript', 'typescript'],
    autoFixAvailable: true
  },
  {
    pattern: /console\.warn\s*\(/g,
    message: 'console.warn statement detected - consider using proper logging',
    severity: 'low',
    language: ['javascript', 'typescript'],
    autoFixAvailable: false
  },
  {
    pattern: /console\.error\s*\(/g,
    message: 'console.error statement detected - consider using proper error handling',
    severity: 'low',
    language: ['javascript', 'typescript'],
    autoFixAvailable: false
  },
  {
    pattern: /console\.trace\s*\(/g,
    message: 'console.trace statement detected - remove before production',
    severity: 'medium',
    language: ['javascript', 'typescript'],
    autoFixAvailable: true
  },
  {
    pattern: /console\.table\s*\(/g,
    message: 'console.table statement detected - remove before production',
    severity: 'low',
    language: ['javascript', 'typescript'],
    autoFixAvailable: true
  },
  {
    pattern: /\bdebugger\b/g,
    message: 'debugger statement detected - remove before production',
    severity: 'high',
    language: ['javascript', 'typescript'],
    autoFixAvailable: true
  },
  {
    pattern: /print\s*\(/g,
    message: 'print() statement detected - remove before production',
    severity: 'low',
    language: ['python'],
    autoFixAvailable: true
  },
  {
    pattern: /pprint\s*\(/g,
    message: 'pprint() statement detected - remove before production',
    severity: 'low',
    language: ['python'],
    autoFixAvailable: true
  },
  {
    pattern: /breakpoint\s*\(\)/g,
    message: 'breakpoint() statement detected - remove before production',
    severity: 'high',
    language: ['python'],
    autoFixAvailable: true
  },
  {
    pattern: /import\s+pdb|pdb\.set_trace\s*\(\)/g,
    message: 'Python debugger (pdb) detected - remove before production',
    severity: 'high',
    language: ['python'],
    autoFixAvailable: true
  },
  {
    pattern: /import\s+ipdb|ipdb\.set_trace\s*\(\)/g,
    message: 'IPython debugger (ipdb) detected - remove before production',
    severity: 'high',
    language: ['python'],
    autoFixAvailable: true
  },
  {
    pattern: /alert\s*\(/g,
    message: 'alert() statement detected - remove before production',
    severity: 'medium',
    language: ['javascript', 'typescript'],
    autoFixAvailable: true
  }
];

const TODO_PATTERNS: DebugPattern[] = [
  {
    pattern: /\/\/\s*TODO\s*:/gi,
    message: 'TODO comment detected - address before production',
    severity: 'low',
    language: ['javascript', 'typescript'],
    autoFixAvailable: false
  },
  {
    pattern: /\/\/\s*FIXME\s*:/gi,
    message: 'FIXME comment detected - fix before production',
    severity: 'medium',
    language: ['javascript', 'typescript'],
    autoFixAvailable: false
  },
  {
    pattern: /\/\/\s*HACK\s*:/gi,
    message: 'HACK comment detected - refactor before production',
    severity: 'medium',
    language: ['javascript', 'typescript'],
    autoFixAvailable: false
  },
  {
    pattern: /\/\/\s*XXX\s*:/gi,
    message: 'XXX comment detected - review before production',
    severity: 'medium',
    language: ['javascript', 'typescript'],
    autoFixAvailable: false
  },
  {
    pattern: /\/\/\s*BUG\s*:/gi,
    message: 'BUG comment detected - fix before production',
    severity: 'high',
    language: ['javascript', 'typescript'],
    autoFixAvailable: false
  },
  {
    pattern: /#\s*TODO\s*:/gi,
    message: 'TODO comment detected - address before production',
    severity: 'low',
    language: ['python', 'yaml'],
    autoFixAvailable: false
  },
  {
    pattern: /#\s*FIXME\s*:/gi,
    message: 'FIXME comment detected - fix before production',
    severity: 'medium',
    language: ['python', 'yaml'],
    autoFixAvailable: false
  },
  {
    pattern: /#\s*HACK\s*:/gi,
    message: 'HACK comment detected - refactor before production',
    severity: 'medium',
    language: ['python', 'yaml'],
    autoFixAvailable: false
  }
];

function getLanguageFromFilename(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  const langMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.yaml': 'yaml',
    '.yml': 'yaml'
  };
  return langMap[ext] || 'unknown';
}

export function detectDebugCode(content: string, filename: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const lines = content.split('\n');
  const language = getLanguageFromFilename(filename);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    
    for (const rule of DEBUG_PATTERNS) {
      if (!rule.language.includes(language) && !rule.language.includes('typescript')) continue;
      
      let match: RegExpExecArray | null;
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      
      while ((match = regex.exec(line)) !== null) {
        const column = (match.index || 0) + 1;
        const snippetStart = Math.max(0, lineIndex - 1);
        const snippetEnd = Math.min(lines.length, lineIndex + 2);
        const snippet = lines.slice(snippetStart, snippetEnd).join('\n');

        issues.push({
          type: rule.message.includes('debugger') ? 'debug_code' : 'console_log',
          severity: rule.severity,
          line: lineIndex + 1,
          column,
          message: rule.message,
          snippet,
          autoFixAvailable: rule.autoFixAvailable,
          suggestedFix: rule.autoFixAvailable ? '' : undefined,
          ruleId: 'debug-code'
        });
        
        if (!regex.global) break;
      }
    }
  }

  return issues;
}

export function detectTodoFixme(content: string, filename: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const lines = content.split('\n');
  const language = getLanguageFromFilename(filename);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    
    for (const rule of TODO_PATTERNS) {
      if (!rule.language.includes(language) && language !== 'unknown') continue;
      
      let match: RegExpExecArray | null;
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      
      while ((match = regex.exec(line)) !== null) {
        const column = (match.index || 0) + 1;
        const snippetStart = Math.max(0, lineIndex - 1);
        const snippetEnd = Math.min(lines.length, lineIndex + 2);
        const snippet = lines.slice(snippetStart, snippetEnd).join('\n');

        issues.push({
          type: 'todo_fixme',
          severity: rule.severity,
          line: lineIndex + 1,
          column,
          message: rule.message,
          snippet,
          autoFixAvailable: false,
          ruleId: 'todo-fixme'
        });
        
        if (!regex.global) break;
      }
    }
  }

  return issues;
}
