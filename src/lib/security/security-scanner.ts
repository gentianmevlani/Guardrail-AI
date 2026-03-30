import { readFile, readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { createHash } from 'crypto';
import { EventEmitter } from 'events';

export interface SecurityScanResult {
  id: string;
  timestamp: Date;
  scanType: ScanType;
  target: {
    type: 'file' | 'directory' | 'repository' | 'dependency' | 'container' | 'network';
    path?: string;
    url?: string;
    name: string;
  };
  findings: SecurityFinding[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  duration: number;
  status: 'completed' | 'failed' | 'running' | 'cancelled';
}

export interface SecurityFinding {
  id: string;
  type: FindingType;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location: {
    file?: string;
    line?: number;
    column?: number;
    function?: string;
    className?: string;
  };
  cwe?: number;
  owasp?: string;
  recommendation: string;
  references: string[];
  metadata: { [key: string]: any };
  confidence: number;
}

export type ScanType = 
  | 'sast'
  | 'dast'
  | 'dependency'
  | 'container'
  | 'infrastructure'
  | 'secrets'
  | 'malware'
  | 'compliance';

export type FindingType = 
  | 'vulnerability'
  | 'weakness'
  | 'exposure'
  | 'misconfiguration'
  | 'secret'
  | 'malware'
  | 'compliance_violation'
  | 'best_practice';

export interface ScanConfig {
  type: ScanType;
  rules: string[];
  excludePatterns: string[];
  includePatterns: string[];
  severity: ('critical' | 'high' | 'medium' | 'low' | 'info')[];
  timeout: number;
  parallel: boolean;
  maxDepth: number;
  customRules?: CustomRule[];
}

export interface CustomRule {
  id: string;
  name: string;
  type: FindingType;
  pattern: string | RegExp;
  severity: SecurityFinding['severity'];
  description: string;
  recommendation: string;
  languages?: string[];
}

export interface SecurityScanner {
  name: string;
  type: ScanType;
  version: string;
  scan(target: string, config: ScanConfig): Promise<SecurityScanResult>;
  isAvailable(): boolean;
}

export class AutomatedSecurityScanner extends EventEmitter {
  private scanners: Map<ScanType, SecurityScanner[]> = new Map();
  private scanHistory: SecurityScanResult[] = [];
  private runningScans: Map<string, SecurityScanResult> = new Map();

  constructor() {
    super();
    this.initializeScanners();
  }

  private initializeScanners(): void {
    this.scanners.set('sast', [
      new SASTScanner(),
      new SecretScanner(),
    ]);
    
    this.scanners.set('dependency', [
      new DependencyScanner(),
    ]);
    
    this.scanners.set('container', [
      new ContainerScanner(),
    ]);
    
    this.scanners.set('infrastructure', [
      new InfrastructureScanner(),
    ]);
  }

  async scan(target: string, config: ScanConfig): Promise<SecurityScanResult> {
    const scanId = this.generateScanId();
    const startTime = Date.now();
    
    const result: SecurityScanResult = {
      id: scanId,
      timestamp: new Date(),
      scanType: config.type,
      target: {
        type: 'directory',
        path: target,
        name: target.split('/').pop() || target,
      },
      findings: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
      duration: 0,
      status: 'running',
    };

    this.runningScans.set(scanId, result);
    this.emit('scan-started', result);

    try {
      const scanners = this.scanners.get(config.type) || [];
      const availableScanners = scanners.filter(s => s.isAvailable());
      
      if (availableScanners.length === 0) {
        throw new Error(`No available scanners for type: ${config.type}`);
      }

      for (const scanner of availableScanners) {
        try {
          const scannerResult = await scanner.scan(target, config);
          result.findings.push(...scannerResult.findings);
        } catch (error) {
          console.error(`Scanner ${scanner.name} failed:`, error);
          this.emit('scanner-error', { scanner: scanner.name, error });
        }
      }

      result.findings = this.deduplicateFindings(result.findings);
      this.calculateSummary(result);
      result.status = 'completed';
      
    } catch (error) {
      console.error('Scan failed:', error);
      result.status = 'failed';
      this.emit('scan-failed', { scanId, error });
    }

    result.duration = Date.now() - startTime;
    this.runningScans.delete(scanId);
    this.scanHistory.push(result);
    
    if (this.scanHistory.length > 1000) {
      this.scanHistory = this.scanHistory.slice(-500);
    }

    this.emit('scan-completed', result);
    return result;
  }

  async scanRepository(repoUrl: string, config: ScanConfig): Promise<SecurityScanResult> {
    return this.scan(repoUrl, {
      ...config,
      type: 'sast',
    });
  }

  async scanDependencies(projectPath: string, config: Partial<ScanConfig> = {}): Promise<SecurityScanResult> {
    return this.scan(projectPath, {
      type: 'dependency',
      rules: ['vulnerability', 'outdated', 'license'],
      excludePatterns: ['node_modules/**', '.git/**'],
      includePatterns: ['**/*.{js,ts,json,lock}'],
      severity: ['critical', 'high', 'medium'],
      timeout: 300000,
      parallel: true,
      maxDepth: 10,
      ...config,
    });
  }

  async scanContainer(imageName: string, config: Partial<ScanConfig> = {}): Promise<SecurityScanResult> {
    const finalConfig: ScanConfig = {
      type: 'container',
      rules: ['vulnerability', 'misconfiguration', 'secrets'],
      excludePatterns: [],
      includePatterns: ['**/*'],
      severity: ['critical', 'high', 'medium'],
      timeout: 600000,
      parallel: false,
      maxDepth: 0,
      ...config,
    };

    // Use finalConfig for scanning configuration
    console.log(`Scanning container ${imageName} with config:`, finalConfig.rules);

    const result: SecurityScanResult = {
      id: this.generateScanId(),
      timestamp: new Date(),
      scanType: 'container',
      target: {
        type: 'container',
        name: imageName,
      },
      findings: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
      duration: 0,
      status: 'running',
    };

    return result;
  }

  async scheduleRecurringScan(
    target: string,
    config: ScanConfig,
    schedule: string
  ): Promise<string> {
    const scheduleId = this.generateScanId();
    
    this.emit('scan-scheduled', { scheduleId, target, config, schedule });
    
    return scheduleId;
  }

  private deduplicateFindings(findings: SecurityFinding[]): SecurityFinding[] {
    const unique = new Map<string, SecurityFinding>();
    
    for (const finding of findings) {
      const key = `${finding.type}-${finding.location.file}-${finding.location.line}-${finding.title}`;
      
      if (!unique.has(key) || unique.get(key)!.confidence < finding.confidence) {
        unique.set(key, finding);
      }
    }
    
    return Array.from(unique.values());
  }

  private calculateSummary(result: SecurityScanResult): void {
    result.summary = {
      total: result.findings.length,
      critical: result.findings.filter(f => f.severity === 'critical').length,
      high: result.findings.filter(f => f.severity === 'high').length,
      medium: result.findings.filter(f => f.severity === 'medium').length,
      low: result.findings.filter(f => f.severity === 'low').length,
      info: result.findings.filter(f => f.severity === 'info').length,
    };
  }

  private generateScanId(): string {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getScanReport(scanId: string): Promise<SecurityScanResult | null> {
    const scan = this.scanHistory.find(s => s.id === scanId) || 
                 this.runningScans.get(scanId);
    return scan || null;
  }

  async getSecurityDashboard(): Promise<{
    totalScans: number;
    activeScans: number;
    recentFindings: SecurityFinding[];
    vulnerabilityTrend: { date: string; critical: number; high: number; medium: number }[];
    topVulnerabilities: { type: string; count: number }[];
    complianceScore: number;
  }> {
    const recentScans = this.scanHistory.slice(-30);
    const recentFindings = recentScans.flatMap(s => s.findings).slice(-50);
    
    const vulnerabilityTrend = this.calculateVulnerabilityTrend();
    const topVulnerabilities = this.calculateTopVulnerabilities();
    const complianceScore = this.calculateComplianceScore();

    return {
      totalScans: this.scanHistory.length,
      activeScans: this.runningScans.size,
      recentFindings,
      vulnerabilityTrend,
      topVulnerabilities,
      complianceScore,
    };
  }

  private calculateVulnerabilityTrend(): { date: string; critical: number; high: number; medium: number }[] {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    return last30Days.map(date => {
      const dayScans = this.scanHistory.filter(s => 
        s.timestamp.toISOString().split('T')[0] === date
      );
      
      const findings = dayScans.flatMap(s => s.findings);
      
      return {
        date,
        critical: findings.filter(f => f.severity === 'critical').length,
        high: findings.filter(f => f.severity === 'high').length,
        medium: findings.filter(f => f.severity === 'medium').length,
      };
    });
  }

  private calculateTopVulnerabilities(): { type: string; count: number }[] {
    const types: { [key: string]: number } = {};
    
    this.scanHistory.forEach(scan => {
      scan.findings.forEach(finding => {
        types[finding.type] = (types[finding.type] || 0) + 1;
      });
    });

    return Object.entries(types)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));
  }

  private calculateComplianceScore(): number {
    if (this.scanHistory.length === 0) return 100;
    
    const recentScans = this.scanHistory.slice(-10);
    const totalFindings = recentScans.reduce((sum, scan) => sum + scan.summary.total, 0);
    const criticalFindings = recentScans.reduce((sum, scan) => sum + scan.summary.critical, 0);
    const highFindings = recentScans.reduce((sum, scan) => sum + scan.summary.high, 0);
    
    let score = 100;
    score -= criticalFindings * 20;
    score -= highFindings * 10;
    score -= Math.min(totalFindings * 0.5, 20);
    
    return Math.max(0, Math.min(100, score));
  }
}

class SASTScanner implements SecurityScanner {
  name = 'SAST Scanner';
  type = 'sast' as ScanType;
  version = '1.0.0';

  async scan(target: string, config: ScanConfig): Promise<SecurityScanResult> {
    const result: SecurityScanResult = {
      id: '',
      timestamp: new Date(),
      scanType: this.type,
      target: {
        type: 'directory',
        path: target,
        name: target,
      },
      findings: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
      duration: 0,
      status: 'completed',
    };

    const files = await this.getSourceFiles(target, config);
    
    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      const findings = await this.analyzeCode(content, file, config);
      result.findings.push(...findings);
    }

    return result;
  }

  isAvailable(): boolean {
    return true;
  }

  private async getSourceFiles(target: string, config: ScanConfig): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.php', '.rb'];
    
    async function scanDirectory(dir: string, depth = 0): Promise<void> {
      if (depth > config.maxDepth) return;
      
      const entries = await readdir(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          if (!config.excludePatterns.some(pattern => fullPath.includes(pattern))) {
            await scanDirectory(fullPath, depth + 1);
          }
        } else if (extensions.includes(extname(entry))) {
          if (config.includePatterns.length === 0 || 
              config.includePatterns.some(pattern => fullPath.includes(pattern))) {
            files.push(fullPath);
          }
        }
      }
    }
    
    await scanDirectory(target);
    return files;
  }

  private async analyzeCode(content: string, filePath: string, config: ScanConfig): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      if (line.includes('eval(') || line.includes('Function(')) {
        findings.push({
          id: this.generateId(),
          type: 'vulnerability',
          severity: 'high',
          title: 'Use of eval() or Function() constructor',
          description: 'Dynamic code execution can lead to code injection vulnerabilities',
          location: {
            file: filePath,
            line: lineNumber,
          },
          cwe: 95,
          owasp: 'A03:2021 - Injection',
          recommendation: 'Avoid using eval() or Function(). Use safer alternatives',
          references: ['https://owasp.org/www-project-top-ten/2021/A03_2021-Injection'],
          metadata: {},
          confidence: 0.9,
        });
      }

      if (line.includes('innerHTML') || line.includes('outerHTML')) {
        findings.push({
          id: this.generateId(),
          type: 'vulnerability',
          severity: 'medium',
          title: 'Potential XSS vulnerability',
          description: 'Direct assignment to innerHTML can lead to XSS attacks',
          location: {
            file: filePath,
            line: lineNumber,
          },
          cwe: 79,
          owasp: 'A03:2021 - Injection',
          recommendation: 'Use textContent or sanitize HTML before assignment',
          references: ['https://owasp.org/www-project-top-ten/2021/A03_2021-Injection'],
          metadata: {},
          confidence: 0.7,
        });
      }

      if (line.includes('password') && line.includes('console.log')) {
        findings.push({
          id: this.generateId(),
          type: 'exposure',
          severity: 'critical',
          title: 'Password logged to console',
          description: 'Sensitive information (password) is being logged',
          location: {
            file: filePath,
            line: lineNumber,
          },
          cwe: 532,
          owasp: 'A02:2021 - Cryptographic Failures',
          recommendation: 'Remove logging of sensitive information',
          references: ['https://cwe.mitre.org/data/definitions/532.html'],
          metadata: {},
          confidence: 0.95,
        });
      }
    });

    return findings;
  }

  private generateId(): string {
    return createHash('sha256').update(Math.random().toString()).digest('hex').substring(0, 16);
  }
}

class SecretScanner implements SecurityScanner {
  name = 'Secret Scanner';
  type = 'secrets' as ScanType;
  version = '1.0.0';

  async scan(target: string, config: ScanConfig): Promise<SecurityScanResult> {
    const result: SecurityScanResult = {
      id: '',
      timestamp: new Date(),
      scanType: this.type,
      target: {
        type: 'directory',
        path: target,
        name: target,
      },
      findings: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
      duration: 0,
      status: 'completed',
    };

    return result;
  }

  isAvailable(): boolean {
    return true;
  }
}

class DependencyScanner implements SecurityScanner {
  name = 'Dependency Scanner';
  type = 'dependency' as ScanType;
  version = '1.0.0';

  async scan(target: string, config: ScanConfig): Promise<SecurityScanResult> {
    const result: SecurityScanResult = {
      id: '',
      timestamp: new Date(),
      scanType: this.type,
      target: {
        type: 'directory',
        path: target,
        name: target,
      },
      findings: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
      duration: 0,
      status: 'completed',
    };

    return result;
  }

  isAvailable(): boolean {
    return true;
  }
}

class ContainerScanner implements SecurityScanner {
  name = 'Container Scanner';
  type = 'container' as ScanType;
  version = '1.0.0';

  async scan(target: string, config: ScanConfig): Promise<SecurityScanResult> {
    const result: SecurityScanResult = {
      id: '',
      timestamp: new Date(),
      scanType: this.type,
      target: {
        type: 'container',
        name: target,
      },
      findings: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
      duration: 0,
      status: 'completed',
    };

    return result;
  }

  isAvailable(): boolean {
    return false;
  }
}

class InfrastructureScanner implements SecurityScanner {
  name = 'Infrastructure Scanner';
  type = 'infrastructure' as ScanType;
  version = '1.0.0';

  async scan(target: string, config: ScanConfig): Promise<SecurityScanResult> {
    const result: SecurityScanResult = {
      id: '',
      timestamp: new Date(),
      scanType: this.type,
      target: {
        type: 'directory',
        path: target,
        name: target,
      },
      findings: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
      duration: 0,
      status: 'completed',
    };

    return result;
  }

  isAvailable(): boolean {
    return true;
  }
}

export const securityScanner = new AutomatedSecurityScanner();
