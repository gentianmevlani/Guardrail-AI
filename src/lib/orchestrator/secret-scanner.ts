/**
 * Secret Scanner Integration for guardrail
 * 
 * Integrates TruffleHog and Gitleaks for comprehensive secret detection.
 * Correlates findings with production reachability and rotation status.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  stripeSkLiveRegex24,
  stripeSkTestRegex24,
} from 'guardrail-security/secrets/stripe-placeholder-prefix';

// ============ Types ============

export interface SecretScannerConfig {
  // Tool paths
  trufflehogPath: string;
  gitleaksPath: string;
  
  // Scan options
  scanGitHistory: boolean;
  maxHistoryDepth: number;  // commits
  
  // Detection sensitivity
  entropy: {
    enabled: boolean;
    threshold: number;  // 3.5-4.5 is typical
  };
  
  // Known false positives
  allowlist: SecretAllowlistEntry[];
  
  // Secret rotation tracking
  rotationTracking: boolean;
}

export interface SecretAllowlistEntry {
  pattern: string;
  reason: string;
  addedAt: string;
  addedBy?: string;
}

export interface DetectedSecret {
  id: string;
  type: SecretType;
  value: string;  // Redacted
  file: string;
  line: number;
  commit?: string;
  author?: string;
  date?: string;
  entropy?: number;
  verified: boolean;
  metadata: {
    detector: string;
    confidence: 'high' | 'medium' | 'low';
    isActive?: boolean;
    lastRotated?: string;
  };
}

export type SecretType = 
  | 'aws-access-key'
  | 'aws-secret-key'
  | 'github-token'
  | 'github-oauth'
  | 'gitlab-token'
  | 'slack-token'
  | 'stripe-key'
  | 'sendgrid-key'
  | 'twilio-key'
  | 'jwt'
  | 'private-key'
  | 'ssh-key'
  | 'api-key'
  | 'password'
  | 'database-url'
  | 'generic-secret'
  | 'unknown';

export interface SecretScanResult {
  secrets: DetectedSecret[];
  stats: {
    filesScanned: number;
    commitsScanned: number;
    secretsFound: number;
    verifiedSecrets: number;
    secretsByType: Record<SecretType, number>;
    scanTime: number;
  };
  riskAssessment: {
    score: number;  // 0-100
    productionExposure: DetectedSecret[];
    clientSideExposure: DetectedSecret[];
    gitHistoryExposure: DetectedSecret[];
    activeSecrets: DetectedSecret[];
  };
  rotationPlaybook: RotationAction[];
}

export interface RotationAction {
  secretId: string;
  secretType: SecretType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  instructions: string[];
  references: string[];
}

// ============ Default Configuration ============

export const DEFAULT_SECRET_SCANNER_CONFIG: SecretScannerConfig = {
  trufflehogPath: 'trufflehog',
  gitleaksPath: 'gitleaks',
  scanGitHistory: true,
  maxHistoryDepth: 100,
  entropy: {
    enabled: true,
    threshold: 4.0
  },
  allowlist: [],
  rotationTracking: true
};

// ============ Secret Patterns ============

const SECRET_PATTERNS: Array<{ type: SecretType; pattern: RegExp; description: string }> = [
  // AWS
  { type: 'aws-access-key', pattern: /AKIA[0-9A-Z]{16}/g, description: 'AWS Access Key ID' },
  { type: 'aws-secret-key', pattern: /[A-Za-z0-9/+=]{40}/g, description: 'AWS Secret Key (requires context)' },
  
  // GitHub
  { type: 'github-token', pattern: /ghp_[a-zA-Z0-9]{36}/g, description: 'GitHub Personal Access Token' },
  { type: 'github-oauth', pattern: /gho_[a-zA-Z0-9]{36}/g, description: 'GitHub OAuth Token' },
  
  // GitLab
  { type: 'gitlab-token', pattern: /glpat-[a-zA-Z0-9\-]{20}/g, description: 'GitLab Personal Access Token' },
  
  // Slack
  { type: 'slack-token', pattern: /xox[baprs]-[a-zA-Z0-9\-]{10,}/g, description: 'Slack Token' },
  
  // Stripe
  { type: 'stripe-key', pattern: stripeSkLiveRegex24(), description: 'Stripe Live Secret Key' },
  { type: 'stripe-key', pattern: stripeSkTestRegex24(), description: 'Stripe Test Secret Key' },
  { type: 'stripe-key', pattern: /rk_live_[a-zA-Z0-9]{24,}/g, description: 'Stripe Restricted Key' },
  
  // SendGrid
  { type: 'sendgrid-key', pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g, description: 'SendGrid API Key' },
  
  // Twilio
  { type: 'twilio-key', pattern: /SK[a-f0-9]{32}/g, description: 'Twilio API Key' },
  
  // JWT
  { type: 'jwt', pattern: /eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/g, description: 'JSON Web Token' },
  
  // Private Keys
  { type: 'private-key', pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, description: 'Private Key' },
  { type: 'ssh-key', pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g, description: 'SSH Private Key' },
  
  // Database URLs
  { type: 'database-url', pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s"']+/gi, description: 'Database Connection String' },
  
  // Generic patterns
  { type: 'api-key', pattern: /api[_-]?key[_-]?[=:]["']?[a-zA-Z0-9\-_]{20,}["']?/gi, description: 'Generic API Key' },
  { type: 'password', pattern: /password[_-]?[=:]["'][^"']{8,}["']/gi, description: 'Password Assignment' }
];

// ============ Rotation Instructions ============

const ROTATION_INSTRUCTIONS: Record<SecretType, { action: string; instructions: string[]; references: string[] }> = {
  'aws-access-key': {
    action: 'Rotate AWS credentials',
    instructions: [
      '1. Go to AWS IAM Console',
      '2. Find the user associated with the access key',
      '3. Create a new access key',
      '4. Update all applications using the old key',
      '5. Deactivate and delete the old key'
    ],
    references: ['https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html']
  },
  'aws-secret-key': {
    action: 'Rotate AWS credentials',
    instructions: ['Follow AWS access key rotation procedure'],
    references: ['https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html']
  },
  'github-token': {
    action: 'Revoke and regenerate GitHub token',
    instructions: [
      '1. Go to GitHub Settings → Developer settings → Personal access tokens',
      '2. Delete the compromised token',
      '3. Generate a new token with appropriate scopes',
      '4. Update all applications using the token'
    ],
    references: ['https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens']
  },
  'github-oauth': {
    action: 'Revoke GitHub OAuth token',
    instructions: ['Revoke the OAuth app authorization and regenerate'],
    references: ['https://docs.github.com/en/apps/oauth-apps/maintaining-oauth-apps']
  },
  'gitlab-token': {
    action: 'Revoke and regenerate GitLab token',
    instructions: [
      '1. Go to GitLab → User Settings → Access Tokens',
      '2. Revoke the compromised token',
      '3. Create a new token'
    ],
    references: ['https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html']
  },
  'slack-token': {
    action: 'Regenerate Slack token',
    instructions: [
      '1. Go to Slack API → Your Apps',
      '2. Select the app',
      '3. Regenerate the token'
    ],
    references: ['https://api.slack.com/authentication/token-types']
  },
  'stripe-key': {
    action: 'Roll Stripe API keys',
    instructions: [
      '1. Go to Stripe Dashboard → Developers → API keys',
      '2. Roll the secret key',
      '3. Update all integrations with the new key'
    ],
    references: ['https://stripe.com/docs/keys']
  },
  'sendgrid-key': {
    action: 'Regenerate SendGrid API key',
    instructions: [
      '1. Go to SendGrid → Settings → API Keys',
      '2. Delete the compromised key',
      '3. Create a new API key'
    ],
    references: ['https://docs.sendgrid.com/ui/account-and-settings/api-keys']
  },
  'twilio-key': {
    action: 'Regenerate Twilio credentials',
    instructions: ['Regenerate in Twilio Console'],
    references: ['https://www.twilio.com/docs/usage/security']
  },
  'jwt': {
    action: 'Rotate JWT signing secret',
    instructions: [
      '1. Generate a new secure secret',
      '2. Update the secret in all environments',
      '3. Existing JWTs will be invalidated'
    ],
    references: ['https://jwt.io/introduction']
  },
  'private-key': {
    action: 'Generate new key pair',
    instructions: [
      '1. Generate a new private/public key pair',
      '2. Replace the public key everywhere it is used',
      '3. Securely delete the old private key'
    ],
    references: []
  },
  'ssh-key': {
    action: 'Generate new SSH key',
    instructions: [
      '1. Generate new SSH key: ssh-keygen -t ed25519',
      '2. Update authorized_keys on all servers',
      '3. Delete the compromised key'
    ],
    references: ['https://docs.github.com/en/authentication/connecting-to-github-with-ssh']
  },
  'database-url': {
    action: 'Rotate database credentials',
    instructions: [
      '1. Create new database user/password',
      '2. Update connection strings in all environments',
      '3. Remove old credentials after verification'
    ],
    references: []
  },
  'api-key': {
    action: 'Regenerate API key',
    instructions: ['Regenerate in the service\'s dashboard'],
    references: []
  },
  'password': {
    action: 'Change password',
    instructions: ['Change the password and update all usages'],
    references: []
  },
  'generic-secret': {
    action: 'Rotate secret',
    instructions: ['Identify the secret type and follow appropriate rotation procedure'],
    references: []
  },
  'unknown': {
    action: 'Investigate and rotate',
    instructions: ['Identify the secret type and determine appropriate action'],
    references: []
  }
};

// ============ Secret Scanner Class ============

export class SecretScanner {
  private config: SecretScannerConfig;
  
  constructor(config: Partial<SecretScannerConfig> = {}) {
    this.config = { ...DEFAULT_SECRET_SCANNER_CONFIG, ...config };
  }
  
  /**
   * Check which tools are installed
   */
  async checkTools(): Promise<{ trufflehog: boolean; gitleaks: boolean }> {
    const check = (cmd: string): boolean => {
      try {
        execSync(`${cmd} --version`, { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    };
    
    return {
      trufflehog: check(this.config.trufflehogPath),
      gitleaks: check(this.config.gitleaksPath)
    };
  }
  
  /**
   * Scan for secrets
   */
  async scan(targetPath: string): Promise<SecretScanResult> {
    const startTime = Date.now();
    const secrets: DetectedSecret[] = [];
    
    console.log('🔐 Scanning for secrets...');
    
    // Try TruffleHog first
    const trufflehogResults = await this.scanWithTrufflehog(targetPath);
    secrets.push(...trufflehogResults);
    
    // Then try Gitleaks
    const gitleaksResults = await this.scanWithGitleaks(targetPath);
    secrets.push(...gitleaksResults);
    
    // Fallback to regex scanning
    const regexResults = await this.scanWithRegex(targetPath);
    secrets.push(...regexResults);
    
    // Deduplicate
    const uniqueSecrets = this.deduplicateSecrets(secrets);
    
    // Filter allowlisted
    const filteredSecrets = this.filterAllowlisted(uniqueSecrets);
    
    // Assess risk
    const riskAssessment = await this.assessRisk(filteredSecrets, targetPath);
    
    // Generate rotation playbook
    const rotationPlaybook = this.generateRotationPlaybook(filteredSecrets);
    
    // Calculate stats
    const secretsByType: Record<SecretType, number> = {} as any;
    for (const secret of filteredSecrets) {
      secretsByType[secret.type] = (secretsByType[secret.type] || 0) + 1;
    }
    
    return {
      secrets: filteredSecrets,
      stats: {
        filesScanned: await this.countFiles(targetPath),
        commitsScanned: this.config.scanGitHistory ? this.config.maxHistoryDepth : 0,
        secretsFound: filteredSecrets.length,
        verifiedSecrets: filteredSecrets.filter(s => s.verified).length,
        secretsByType,
        scanTime: Date.now() - startTime
      },
      riskAssessment,
      rotationPlaybook
    };
  }
  
  /**
   * Scan with TruffleHog
   */
  private async scanWithTrufflehog(targetPath: string): Promise<DetectedSecret[]> {
    try {
      const cmd = this.config.scanGitHistory
        ? `${this.config.trufflehogPath} git file://${targetPath} --json --max-depth=${this.config.maxHistoryDepth}`
        : `${this.config.trufflehogPath} filesystem ${targetPath} --json`;
      
      const output = execSync(cmd, { 
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const results: DetectedSecret[] = [];
      
      // TruffleHog outputs newline-delimited JSON
      for (const line of output.split('\n').filter(Boolean)) {
        try {
          const finding = JSON.parse(line);
          results.push({
            id: `trufflehog-${finding.DetectorName}-${finding.SourceMetadata?.Data?.Filesystem?.file || 'unknown'}`,
            type: this.mapTrufflehogType(finding.DetectorName),
            value: this.redactSecret(finding.Raw),
            file: finding.SourceMetadata?.Data?.Filesystem?.file || 
                  finding.SourceMetadata?.Data?.Git?.file || 'unknown',
            line: finding.SourceMetadata?.Data?.Filesystem?.line || 
                  finding.SourceMetadata?.Data?.Git?.line || 0,
            commit: finding.SourceMetadata?.Data?.Git?.commit,
            author: finding.SourceMetadata?.Data?.Git?.email,
            date: finding.SourceMetadata?.Data?.Git?.timestamp,
            verified: finding.Verified || false,
            metadata: {
              detector: 'trufflehog',
              confidence: finding.Verified ? 'high' : 'medium',
              isActive: finding.Verified
            }
          });
        } catch {
          // Skip malformed lines
        }
      }
      
      return results;
    } catch {
      console.warn('⚠️ TruffleHog not available');
      return [];
    }
  }
  
  /**
   * Scan with Gitleaks
   */
  private async scanWithGitleaks(targetPath: string): Promise<DetectedSecret[]> {
    try {
      const reportFile = path.join(targetPath, '.guardrail', 'gitleaks-report.json');
      const dir = path.dirname(reportFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      execSync(
        `${this.config.gitleaksPath} detect --source="${targetPath}" --report-format=json --report-path="${reportFile}" --no-git`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      
      if (!fs.existsSync(reportFile)) {
        return [];
      }
      
      const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
      
      return (report || []).map((finding: any, i: number) => ({
        id: `gitleaks-${i}-${finding.RuleID}`,
        type: this.mapGitleaksType(finding.RuleID),
        value: this.redactSecret(finding.Secret),
        file: finding.File,
        line: finding.StartLine,
        commit: finding.Commit,
        author: finding.Author,
        date: finding.Date,
        entropy: finding.Entropy,
        verified: false,
        metadata: {
          detector: 'gitleaks',
          confidence: finding.Entropy > 4.0 ? 'high' : 'medium'
        }
      }));
    } catch {
      // Gitleaks returns non-zero when findings exist
      const reportFile = path.join(targetPath, '.guardrail', 'gitleaks-report.json');
      
      try {
        if (fs.existsSync(reportFile)) {
          const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
          
          return (report || []).map((finding: any, i: number) => ({
            id: `gitleaks-${i}-${finding.RuleID}`,
            type: this.mapGitleaksType(finding.RuleID),
            value: this.redactSecret(finding.Secret),
            file: finding.File,
            line: finding.StartLine,
            commit: finding.Commit,
            author: finding.Author,
            date: finding.Date,
            entropy: finding.Entropy,
            verified: false,
            metadata: {
              detector: 'gitleaks',
              confidence: finding.Entropy > 4.0 ? 'high' : 'medium'
            }
          }));
        }
      } catch (error) {
        // Failed to scan file - continue with other files
      }
      
      return [];
    }
  }
  
  /**
   * Fallback: Scan with regex patterns
   */
  private async scanWithRegex(targetPath: string): Promise<DetectedSecret[]> {
    const results: DetectedSecret[] = [];
    const files = this.getCodeFiles(targetPath);
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        
        for (const { type, pattern, description } of SECRET_PATTERNS) {
          for (let i = 0; i < lines.length; i++) {
            const matches = lines[i].match(pattern);
            
            if (matches) {
              for (const match of matches) {
                // Skip if in test file or example
                if (this.isTestFile(file) || lines[i].includes('example') || lines[i].includes('Example')) {
                  continue;
                }
                
                const entropy = this.calculateEntropy(match);
                
                if (this.config.entropy.enabled && entropy < this.config.entropy.threshold) {
                  continue;
                }
                
                results.push({
                  id: `regex-${type}-${path.relative(targetPath, file)}-${i + 1}`,
                  type,
                  value: this.redactSecret(match),
                  file: path.relative(targetPath, file),
                  line: i + 1,
                  entropy,
                  verified: false,
                  metadata: {
                    detector: 'regex',
                    confidence: entropy > 4.5 ? 'high' : entropy > 3.5 ? 'medium' : 'low'
                  }
                });
              }
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
    
    return results;
  }
  
  /**
   * Assess risk of detected secrets
   */
  private async assessRisk(secrets: DetectedSecret[], targetPath: string): Promise<SecretScanResult['riskAssessment']> {
    const productionExposure: DetectedSecret[] = [];
    const clientSideExposure: DetectedSecret[] = [];
    const gitHistoryExposure: DetectedSecret[] = [];
    const activeSecrets: DetectedSecret[] = [];
    
    for (const secret of secrets) {
      // Check if in production code (not test/dev)
      if (!this.isTestFile(secret.file) && !secret.file.includes('example')) {
        productionExposure.push(secret);
      }
      
      // Check if client-side exposed
      if (this.isClientSideFile(secret.file)) {
        clientSideExposure.push(secret);
      }
      
      // Check if only in git history
      if (secret.commit) {
        gitHistoryExposure.push(secret);
      }
      
      // Check if verified/active
      if (secret.verified) {
        activeSecrets.push(secret);
      }
    }
    
    // Calculate risk score
    let score = 0;
    score += activeSecrets.length * 25;
    score += clientSideExposure.length * 20;
    score += productionExposure.length * 10;
    score += gitHistoryExposure.length * 5;
    
    return {
      score: Math.min(100, score),
      productionExposure,
      clientSideExposure,
      gitHistoryExposure,
      activeSecrets
    };
  }
  
  /**
   * Generate rotation playbook
   */
  private generateRotationPlaybook(secrets: DetectedSecret[]): RotationAction[] {
    const actions: RotationAction[] = [];
    
    // Group by type and prioritize
    const byType = new Map<SecretType, DetectedSecret[]>();
    for (const secret of secrets) {
      const existing = byType.get(secret.type) || [];
      existing.push(secret);
      byType.set(secret.type, existing);
    }
    
    for (const [type, typeSecrets] of byType) {
      const template = ROTATION_INSTRUCTIONS[type];
      const hasVerified = typeSecrets.some(s => s.verified);
      const hasClientSide = typeSecrets.some(s => this.isClientSideFile(s.file));
      
      let priority: RotationAction['priority'] = 'medium';
      if (hasVerified || hasClientSide) priority = 'critical';
      else if (type.includes('aws') || type.includes('stripe')) priority = 'high';
      else if (type === 'password' || type === 'database-url') priority = 'high';
      
      actions.push({
        secretId: typeSecrets[0].id,
        secretType: type,
        priority,
        action: template.action,
        instructions: template.instructions,
        references: template.references
      });
    }
    
    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }
  
  // ============ Helper Methods ============
  
  private redactSecret(value: string): string {
    if (!value || value.length < 8) return '***';
    const visibleChars = Math.min(4, Math.floor(value.length / 4));
    return value.substring(0, visibleChars) + '...' + value.substring(value.length - visibleChars);
  }
  
  private calculateEntropy(str: string): number {
    const freq: Record<string, number> = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const len = str.length;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }
  
  private mapTrufflehogType(detector: string): SecretType {
    const mapping: Record<string, SecretType> = {
      'AWS': 'aws-access-key',
      'Github': 'github-token',
      'GitLab': 'gitlab-token',
      'Slack': 'slack-token',
      'Stripe': 'stripe-key',
      'SendGrid': 'sendgrid-key',
      'Twilio': 'twilio-key',
      'JWT': 'jwt',
      'PrivateKey': 'private-key'
    };
    return mapping[detector] || 'generic-secret';
  }
  
  private mapGitleaksType(ruleId: string): SecretType {
    const mapping: Record<string, SecretType> = {
      'aws-access-token': 'aws-access-key',
      'aws-secret-access-key': 'aws-secret-key',
      'github-pat': 'github-token',
      'github-oauth': 'github-oauth',
      'gitlab-pat': 'gitlab-token',
      'slack-token': 'slack-token',
      'stripe-api-key': 'stripe-key',
      'jwt': 'jwt',
      'private-key': 'private-key'
    };
    return mapping[ruleId] || 'generic-secret';
  }
  
  private isTestFile(file: string): boolean {
    return /(\.|_)(test|spec|mock|fixture)\./i.test(file) ||
           file.includes('__tests__') ||
           file.includes('__mocks__') ||
           file.includes('/test/') ||
           file.includes('/tests/');
  }
  
  private isClientSideFile(file: string): boolean {
    return file.includes('/pages/') ||
           file.includes('/components/') ||
           file.includes('/app/') ||
           file.includes('/src/') && !file.includes('/server/') ||
           file.endsWith('.tsx') ||
           file.endsWith('.jsx');
  }
  
  private getCodeFiles(dir: string): string[] {
    const results: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.env', '.yaml', '.yml'];
    
    const walk = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && 
                entry.name !== 'node_modules' && 
                entry.name !== 'dist' &&
                entry.name !== 'build') {
              walk(fullPath);
            }
          } else if (extensions.some(ext => entry.name.endsWith(ext))) {
            results.push(fullPath);
          }
        }
      } catch (error) {
        // Failed to scan file - continue with other files
      }
    };
    
    walk(dir);
    return results;
  }
  
  private async countFiles(dir: string): Promise<number> {
    return this.getCodeFiles(dir).length;
  }
  
  private deduplicateSecrets(secrets: DetectedSecret[]): DetectedSecret[] {
    const seen = new Set<string>();
    return secrets.filter(s => {
      const key = `${s.file}:${s.line}:${s.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  private filterAllowlisted(secrets: DetectedSecret[]): DetectedSecret[] {
    return secrets.filter(s => {
      for (const entry of this.config.allowlist) {
        if (new RegExp(entry.pattern).test(s.value) || 
            new RegExp(entry.pattern).test(s.file)) {
          return false;
        }
      }
      return true;
    });
  }
}

// ============ Export Default Instance ============

export const secretScanner = new SecretScanner();
