import type { ScanIssue } from '../types';

interface SecretPattern {
  pattern: RegExp;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  secretType: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["'`]([a-zA-Z0-9_\-]{20,})["'`]/gi,
    message: 'Hardcoded API key detected',
    severity: 'critical',
    secretType: 'api_key'
  },
  {
    pattern: /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g,
    message: 'AWS Access Key ID detected',
    severity: 'critical',
    secretType: 'aws_access_key'
  },
  {
    pattern: /(?:aws[_-]?secret|secret[_-]?key)\s*[:=]\s*["'`]([a-zA-Z0-9/+=]{40})["'`]/gi,
    message: 'AWS Secret Access Key detected',
    severity: 'critical',
    secretType: 'aws_secret'
  },
  {
    pattern: /sk-[a-zA-Z0-9]{48}/g,
    message: 'OpenAI API key detected',
    severity: 'critical',
    secretType: 'openai_key'
  },
  {
    pattern: /ghp_[a-zA-Z0-9]{36}/g,
    message: 'GitHub Personal Access Token detected',
    severity: 'critical',
    secretType: 'github_pat'
  },
  {
    pattern: /gho_[a-zA-Z0-9]{36}/g,
    message: 'GitHub OAuth Token detected',
    severity: 'critical',
    secretType: 'github_oauth'
  },
  {
    pattern: /xox[baprs]-[a-zA-Z0-9\-]{10,}/g,
    message: 'Slack token detected',
    severity: 'critical',
    secretType: 'slack_token'
  },
  {
    pattern: /sk_live_[a-zA-Z0-9]{24,}/g,
    message: 'Stripe live secret key detected',
    severity: 'critical',
    secretType: 'stripe_live'
  },
  {
    pattern: /sk_test_[a-zA-Z0-9]{24,}/g,
    message: 'Stripe test secret key detected',
    severity: 'high',
    secretType: 'stripe_test'
  },
  {
    pattern: /sq0csp-[a-zA-Z0-9\-_]{43}/g,
    message: 'Square access token detected',
    severity: 'critical',
    secretType: 'square_token'
  },
  {
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*["'`]([^"'`\s]{8,})["'`]/gi,
    message: 'Hardcoded password detected',
    severity: 'critical',
    secretType: 'password'
  },
  {
    pattern: /(?:secret|token|auth)\s*[:=]\s*["'`]([a-zA-Z0-9_\-]{16,})["'`]/gi,
    message: 'Hardcoded secret/token detected',
    severity: 'high',
    secretType: 'generic_secret'
  },
  {
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    message: 'Private key detected',
    severity: 'critical',
    secretType: 'private_key'
  },
  {
    pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@/gi,
    message: 'MongoDB connection string with credentials detected',
    severity: 'critical',
    secretType: 'mongodb_uri'
  },
  {
    pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@/gi,
    message: 'PostgreSQL connection string with credentials detected',
    severity: 'critical',
    secretType: 'postgres_uri'
  },
  {
    pattern: /mysql:\/\/[^:]+:[^@]+@/gi,
    message: 'MySQL connection string with credentials detected',
    severity: 'critical',
    secretType: 'mysql_uri'
  },
  {
    pattern: /(?:bearer|authorization)\s*[:=]\s*["'`](?:Bearer\s+)?([a-zA-Z0-9_\-\.]{20,})["'`]/gi,
    message: 'Hardcoded authorization token detected',
    severity: 'high',
    secretType: 'auth_token'
  },
  {
    pattern: /AIza[a-zA-Z0-9_\-]{35}/g,
    message: 'Google API key detected',
    severity: 'critical',
    secretType: 'google_api_key'
  },
  {
    pattern: /[a-f0-9]{32}-us\d+/g,
    message: 'Mailchimp API key detected',
    severity: 'high',
    secretType: 'mailchimp_key'
  },
  {
    pattern: /SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}/g,
    message: 'SendGrid API key detected',
    severity: 'critical',
    secretType: 'sendgrid_key'
  },
  {
    pattern: /twilio[_-]?(?:account[_-]?sid|auth[_-]?token)\s*[:=]\s*["'`]([a-zA-Z0-9]{32,})["'`]/gi,
    message: 'Twilio credentials detected',
    severity: 'critical',
    secretType: 'twilio_creds'
  }
];

const IGNORE_PATTERNS = [
  /process\.env\./,
  /import\.meta\.env\./,
  /\$\{.*\}/,
  /<%.*%>/,
  /\{\{.*\}\}/,
  /<.*>/
];

function shouldIgnoreLine(line: string): boolean {
  return IGNORE_PATTERNS.some(pattern => pattern.test(line));
}

export function detectHardcodedSecrets(content: string, filename: string): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const lines = content.split('\n');

  const isEnvFile = filename.endsWith('.env') || filename.includes('.env.');
  
  if (isEnvFile) {
    return detectEnvFileSecrets(content, filename, lines);
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    
    if (shouldIgnoreLine(line)) continue;
    if (line.trim().startsWith('//') || line.trim().startsWith('#')) continue;
    
    for (const rule of SECRET_PATTERNS) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      
      while ((match = regex.exec(line)) !== null) {
        const column = (match.index || 0) + 1;
        const snippetStart = Math.max(0, lineIndex - 1);
        const snippetEnd = Math.min(lines.length, lineIndex + 2);
        const snippet = lines.slice(snippetStart, snippetEnd).join('\n');

        issues.push({
          type: 'hardcoded_secret',
          severity: rule.severity,
          line: lineIndex + 1,
          column,
          message: rule.message,
          snippet: maskSecret(snippet),
          autoFixAvailable: true,
          suggestedFix: `process.env.${rule.secretType.toUpperCase()}`,
          ruleId: 'hardcoded-secret'
        });
        
        if (!regex.global) break;
      }
    }
  }

  return issues;
}

function detectEnvFileSecrets(content: string, filename: string, lines: string[]): ScanIssue[] {
  const issues: ScanIssue[] = [];
  
  const sensitiveKeys = [
    'PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'CREDENTIAL', 
    'AUTH', 'PRIVATE', 'API_KEY', 'ACCESS_KEY'
  ];
  
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    
    if (!line || line.startsWith('#')) continue;
    
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    
    if (!value || value === '""' || value === "''") continue;
    
    const isSensitive = sensitiveKeys.some(sk => 
      key.toUpperCase().includes(sk)
    );
    
    if (isSensitive && value.length > 0 && !value.startsWith('$')) {
      const snippetStart = Math.max(0, lineIndex - 1);
      const snippetEnd = Math.min(lines.length, lineIndex + 2);
      const snippet = lines.slice(snippetStart, snippetEnd).join('\n');
      
      issues.push({
        type: 'hardcoded_secret',
        severity: 'critical',
        line: lineIndex + 1,
        column: 1,
        message: `Sensitive value in .env file: ${key} - ensure this file is gitignored`,
        snippet: maskSecret(snippet),
        autoFixAvailable: false,
        ruleId: 'hardcoded-secret'
      });
    }
  }
  
  return issues;
}

function maskSecret(text: string): string {
  return text.replace(
    /(?:["'`])([a-zA-Z0-9_\-\/+=]{8,})(?:["'`])/g,
    (match, secret) => {
      if (secret.length <= 8) return match;
      const masked = secret.substring(0, 4) + '****' + secret.substring(secret.length - 4);
      return match.replace(secret, masked);
    }
  );
}
