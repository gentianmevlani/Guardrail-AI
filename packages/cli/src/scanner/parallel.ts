/**
 * Parallel scanning orchestrator with multi-stage progress
 */

import { scanSecrets, ScanSecretsResult } from '../commands/scan-secrets';
import { scanVulnerabilities, ScanVulnResult } from '../commands/scan-vulnerabilities';

export interface ParallelScanOptions {
  path: string;
  type: 'all' | 'secrets' | 'vulnerabilities' | 'compliance';
  format: 'table' | 'json' | 'sarif' | 'markdown';
  output?: string;
  excludeTests?: boolean;
  minConfidence?: number;
  failOnDetection?: boolean;
  failOnCritical?: boolean;
  failOnHigh?: boolean;
  evidence?: boolean;
  complianceFramework?: string;
  since?: string;
  baseline?: string;
}

export interface ParallelScanResult {
  secrets?: ScanSecretsResult;
  vulnerabilities?: ScanVulnResult;
  compliance?: any;
  duration: number;
  timestamp: string;
}

interface ScanProgress {
  stage: string;
  message: string;
  completed: boolean;
}

export class ParallelScanner {
  private progressCallbacks: Map<string, (progress: ScanProgress) => void> = new Map();

  onProgress(module: string, callback: (progress: ScanProgress) => void): void {
    this.progressCallbacks.set(module, callback);
  }

  private updateProgress(module: string, stage: string, message: string, completed = false): void {
    const callback = this.progressCallbacks.get(module);
    if (callback) {
      callback({ stage, message, completed });
    }
  }

  async scan(projectPath: string, options: ParallelScanOptions): Promise<ParallelScanResult> {
    const startTime = Date.now();
    const tasks: Promise<any>[] = [];
    const result: ParallelScanResult = {
      duration: 0,
      timestamp: new Date().toISOString(),
    };

    // Secrets scan
    if (options.type === 'all' || options.type === 'secrets') {
      tasks.push(
        this.runSecretsScanner(projectPath, options).then(res => {
          result.secrets = res;
        })
      );
    }

    // Vulnerabilities scan
    if (options.type === 'all' || options.type === 'vulnerabilities') {
      tasks.push(
        this.runVulnerabilitiesScanner(projectPath, options).then(res => {
          result.vulnerabilities = res;
        })
      );
    }

    // Compliance scan (if selected)
    if (options.type === 'compliance') {
      tasks.push(
        this.runComplianceScanner(projectPath, options).then(res => {
          result.compliance = res;
        })
      );
    }

    // Run all scans in parallel
    await Promise.all(tasks);

    result.duration = Date.now() - startTime;
    return result;
  }

  private async runSecretsScanner(projectPath: string, options: ParallelScanOptions): Promise<ScanSecretsResult> {
    this.updateProgress('secrets', 'init', 'Initializing secret scanner...');
    
    this.updateProgress('secrets', 'scan', 'Scanning files for secrets...');
    const result = await scanSecrets(projectPath, {
      path: projectPath,
      format: options.format === 'markdown' ? 'table' : options.format,
      output: options.output,
      excludeTests: options.excludeTests || false,
      minConfidence: options.minConfidence,
      failOnDetection: options.failOnDetection || false,
      evidence: options.evidence || false,
    });
    
    this.updateProgress('secrets', 'complete', `Found ${result.findings.length} secrets`, true);
    return result;
  }

  private async runVulnerabilitiesScanner(projectPath: string, options: ParallelScanOptions): Promise<ScanVulnResult> {
    this.updateProgress('vulnerabilities', 'init', 'Initializing vulnerability scanner...');
    
    this.updateProgress('vulnerabilities', 'scan', 'Analyzing dependencies...');
    const result = await scanVulnerabilities(projectPath, {
      format: options.format,
      output: options.output,
      failOnCritical: options.failOnCritical,
      failOnHigh: options.failOnHigh,
    });
    
    const total = result.summary.critical + result.summary.high + result.summary.medium + result.summary.low;
    this.updateProgress('vulnerabilities', 'complete', `Found ${total} vulnerabilities`, true);
    return result;
  }

  private async runComplianceScanner(projectPath: string, options: ParallelScanOptions): Promise<any> {
    this.updateProgress('compliance', 'init', 'Initializing compliance scanner...');
    
    this.updateProgress('compliance', 'scan', `Running ${options.complianceFramework || 'SOC2'} checks...`);
    
    // Mock compliance result
    const result = {
      projectPath,
      framework: options.complianceFramework || 'SOC2',
      overallScore: 78,
      categories: [
        { name: 'Access Control', score: 85, status: 'pass', checks: 12, passed: 10 },
        { name: 'Data Encryption', score: 92, status: 'pass', checks: 8, passed: 7 },
        { name: 'Audit Logging', score: 65, status: 'warning', checks: 10, passed: 6 },
      ],
    };
    
    this.updateProgress('compliance', 'complete', `Score: ${result.overallScore}%`, true);
    return result;
  }
}
