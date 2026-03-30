import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { EvidenceCollection, EvidenceArtifact, EvaluationContext } from './types';

export class EvidenceCollector {
  private evidenceDir: string;

  constructor(evidenceDir: string = '.guardrail/evidence') {
    this.evidenceDir = evidenceDir;
  }

  async collectEvidence(
    runId: string,
    context: EvaluationContext,
    referencedFiles: Set<string>
  ): Promise<EvidenceCollection> {
    const artifacts: EvidenceArtifact[] = [];
    const runDir = join(process.cwd(), this.evidenceDir, runId);

    if (!existsSync(runDir)) {
      mkdirSync(runDir, { recursive: true });
    }

    artifacts.push(await this.collectConfigSnapshot(context, runDir));
    artifacts.push(...await this.collectFileChecks(context, referencedFiles, runDir));
    artifacts.push(await this.collectDependencies(context, runDir));

    return {
      runId,
      timestamp: new Date(),
      artifacts
    };
  }

  private async collectConfigSnapshot(
    context: EvaluationContext,
    runDir: string
  ): Promise<EvidenceArtifact> {
    const sanitizedConfig = this.sanitizeConfig(context.config);
    const configPath = join(runDir, 'config-snapshot.json');
    
    writeFileSync(configPath, JSON.stringify(sanitizedConfig, null, 2));

    return {
      type: 'config',
      path: 'config-snapshot.json',
      description: 'Sanitized project configuration snapshot',
      content: JSON.stringify(sanitizedConfig),
      metadata: {
        timestamp: new Date().toISOString(),
        sanitized: true
      }
    };
  }

  private async collectFileChecks(
    context: EvaluationContext,
    referencedFiles: Set<string>,
    runDir: string
  ): Promise<EvidenceArtifact[]> {
    const artifacts: EvidenceArtifact[] = [];
    const checksPath = join(runDir, 'file-checks.json');
    const checks: Record<string, boolean> = {};

    for (const file of referencedFiles) {
      const fullPath = join(context.projectPath, file);
      checks[file] = existsSync(fullPath);
    }

    writeFileSync(checksPath, JSON.stringify(checks, null, 2));

    artifacts.push({
      type: 'file-check',
      path: 'file-checks.json',
      description: 'File presence verification results',
      content: JSON.stringify(checks),
      metadata: {
        totalFiles: referencedFiles.size,
        foundFiles: Object.values(checks).filter(Boolean).length
      }
    });

    return artifacts;
  }

  private async collectDependencies(
    context: EvaluationContext,
    runDir: string
  ): Promise<EvidenceArtifact> {
    const depsPath = join(runDir, 'dependencies.json');
    const sanitizedDeps = this.sanitizeDependencies(context.dependencies);
    
    writeFileSync(depsPath, JSON.stringify(sanitizedDeps, null, 2));

    return {
      type: 'dependency',
      path: 'dependencies.json',
      description: 'Project dependencies snapshot',
      content: JSON.stringify(sanitizedDeps),
      metadata: {
        totalDependencies: Object.keys(sanitizedDeps).length
      }
    };
  }

  private sanitizeConfig(config: any): any {
    const sanitized = { ...config };
    const sensitiveKeys = ['password', 'secret', 'key', 'token', 'apiKey', 'apiSecret'];
    
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private sanitizeDependencies(deps: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(deps).filter(([key]) => {
        return !key.includes('private') && !key.startsWith('@internal');
      })
    );
  }

  saveEvidenceManifest(runId: string, collection: EvidenceCollection): void {
    const runDir = join(process.cwd(), this.evidenceDir, runId);
    const manifestPath = join(runDir, 'manifest.json');
    
    writeFileSync(manifestPath, JSON.stringify({
      runId: collection.runId,
      timestamp: collection.timestamp,
      artifacts: collection.artifacts.map(a => ({
        type: a.type,
        path: a.path,
        description: a.description,
        metadata: a.metadata
      }))
    }, null, 2));
  }
}
