import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { PolicyLoader } from './policy-loader';
import { EvidenceCollector } from './evidence-collector';
import { DriftDetector } from './drift-detector';
import {
  ComplianceScanResult,
  EvaluationContext,
  ProjectConfig,
  RuleResult
} from './types';

export class ComplianceScannerEngine {
  private policyLoader: PolicyLoader;
  private evidenceCollector: EvidenceCollector;
  private driftDetector: DriftDetector;

  constructor() {
    this.policyLoader = new PolicyLoader();
    this.evidenceCollector = new EvidenceCollector();
    this.driftDetector = new DriftDetector();
  }

  async scan(
    projectPath: string,
    framework: string,
    options: { collectEvidence?: boolean; detectDrift?: boolean } = {}
  ): Promise<ComplianceScanResult> {
    const runId = this.generateRunId();
    const timestamp = new Date();

    const context = await this.buildEvaluationContext(projectPath);
    const policies = this.policyLoader.loadPolicies(framework);

    const results: RuleResult[] = [];
    const referencedFiles = new Set<string>();

    for (const policy of policies) {
      const result = await policy.evaluate(context);
      results.push(result);
      result.evidenceRefs.forEach(ref => referencedFiles.add(ref));
    }

    const summary = {
      totalRules: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      score: this.calculateScore(results)
    };

    const evidence = options.collectEvidence !== false
      ? await this.evidenceCollector.collectEvidence(runId, context, referencedFiles)
      : { runId, timestamp, artifacts: [] };

    const scanResult: ComplianceScanResult = {
      runId,
      timestamp,
      projectPath,
      framework,
      summary,
      results,
      evidence
    };

    if (options.collectEvidence !== false) {
      this.evidenceCollector.saveEvidenceManifest(runId, evidence);
    }

    if (options.detectDrift !== false) {
      scanResult.drift = this.driftDetector.detectDrift(scanResult);
      this.driftDetector.saveToHistory(scanResult);
    }

    return scanResult;
  }

  private async buildEvaluationContext(projectPath: string): Promise<EvaluationContext> {
    const files = new Map<string, string>();
    const dependencies = this.loadDependencies(projectPath);
    const config = this.analyzeProjectConfig(projectPath, dependencies);

    const filesToLoad = [
      'src/server.ts',
      'src/index.ts',
      'src/app.ts',
      'package.json'
    ];

    for (const file of filesToLoad) {
      const fullPath = join(projectPath, file);
      if (existsSync(fullPath)) {
        try {
          files.set(file, readFileSync(fullPath, 'utf-8'));
        } catch {
          // File not readable, skip
        }
      }
    }

    return {
      projectPath,
      files,
      config,
      dependencies
    };
  }

  private loadDependencies(projectPath: string): Record<string, string> {
    const packageJsonPath = join(projectPath, 'package.json');
    
    if (!existsSync(packageJsonPath)) {
      return {};
    }

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      return {
        ...packageJson.dependencies || {},
        ...packageJson.devDependencies || {}
      };
    } catch {
      return {};
    }
  }

  private analyzeProjectConfig(
    projectPath: string,
    dependencies: Record<string, string>
  ): ProjectConfig {
    const authLibs = ['passport', 'express-session', 'jsonwebtoken', 'auth0', 'next-auth'];
    const encryptionLibs = ['bcrypt', 'argon2', 'crypto-js', 'jose'];
    const loggingLibs = ['winston', 'pino', 'bunyan', 'morgan', 'log4js'];
    const monitoringLibs = ['@sentry/node', 'datadog', 'newrelic', 'prometheus'];
    const rbacLibs = ['casbin', 'accesscontrol', 'acl'];

    const hasAuth = authLibs.some(lib => lib in dependencies) ||
      existsSync(join(projectPath, 'src/auth')) ||
      existsSync(join(projectPath, 'src/middleware/auth.ts'));

    const hasEncryption = encryptionLibs.some(lib => lib in dependencies);
    const hasLogging = loggingLibs.some(lib => lib in dependencies);
    const hasMonitoring = monitoringLibs.some(lib => lib in dependencies);
    const hasRBAC = rbacLibs.some(lib => lib in dependencies);
    const hasVersionControl = existsSync(join(projectPath, '.git'));
    const hasCICD = existsSync(join(projectPath, '.github/workflows')) ||
      existsSync(join(projectPath, '.gitlab-ci.yml'));
    const hasSecrets = this.detectHardcodedSecrets(projectPath);
    const hasBackup = existsSync(join(projectPath, 'docs/backup-policy.md'));
    const hasAuditLog = this.detectAuditLogging(projectPath);

    return {
      hasAuth,
      hasEncryption,
      hasLogging,
      hasMonitoring,
      hasRBAC,
      hasVersionControl,
      hasCICD,
      hasSecrets,
      hasBackup,
      hasAuditLog
    };
  }

  private detectHardcodedSecrets(projectPath: string): boolean {
    const filesToCheck = ['src/config', 'src/server.ts', 'src/app.ts'];
    const secretPatterns = [
      /password\s*=\s*["'][^"']+["']/i,
      /api[_-]?key\s*=\s*["'][^"']+["']/i,
      /secret\s*=\s*["'][^"']+["']/i,
      /token\s*=\s*["'][^"']+["']/i
    ];

    for (const file of filesToCheck) {
      const fullPath = join(projectPath, file);
      if (existsSync(fullPath)) {
        try {
          const content = readFileSync(fullPath, 'utf-8');
          if (secretPatterns.some(pattern => pattern.test(content))) {
            return true;
          }
        } catch {
          // File not readable, skip
        }
      }
    }

    return false;
  }

  private detectAuditLogging(projectPath: string): boolean {
    const auditIndicators = ['audit', 'auditLog', 'auditTrail', 'eventLog'];
    const filesToCheck = ['src/middleware', 'src/logging', 'src/audit'];

    for (const file of filesToCheck) {
      const fullPath = join(projectPath, file);
      if (existsSync(fullPath)) {
        return true;
      }
    }

    const packageJsonPath = join(projectPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        return Object.keys(deps).some(dep =>
          auditIndicators.some(indicator => dep.toLowerCase().includes(indicator))
        );
      } catch {
        // Ignore
      }
    }

    return false;
  }

  private calculateScore(results: RuleResult[]): number {
    if (results.length === 0) return 0;

    const weights = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1
    };

    let totalWeight = 0;
    let achievedWeight = 0;

    for (const result of results) {
      const weight = weights[result.severity];
      totalWeight += weight;
      if (result.passed) {
        achievedWeight += weight;
      }
    }

    return Math.round((achievedWeight / totalWeight) * 100);
  }

  private generateRunId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(4).toString('hex');
    return `${timestamp}-${random}`;
  }

  getHistory(framework: string, limit: number = 10) {
    return this.driftDetector.getTrend(framework, limit);
  }
}
