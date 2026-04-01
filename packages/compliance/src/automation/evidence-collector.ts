import { prisma } from '@guardrail/database';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { createHash } from 'crypto';
import { ComplianceAssessmentResult } from '../frameworks/engine';

export interface EvidenceArtifact {
  id: string;
  controlId: string;
  type: 'document' | 'configuration' | 'screenshot' | 'log' | 'code' | 'test' | 'metadata';
  name: string;
  path?: string;
  content?: string;
  hash: string;
  size: number;
  timestamp: Date;
  metadata: any;
}

interface EvidenceCollection {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  frameworkId?: string;
  assessmentId?: string;
  artifacts: EvidenceArtifact[];
  summary: {
    totalArtifacts: number;
    byType: Record<string, number>;
    size: number;
    hash: string;
  };
  timestamp: Date;
}

/**
 * Evidence Collection Engine
 * 
 * Automatically collects, preserves, and manages evidence
 * for compliance assessments and audits
 */
export class EvidenceCollector {
  // Remove unused evidenceTypes as it's not currently used

  /**
   * Collect evidence for a compliance assessment
   */
  async collectForAssessment(
    projectId: string,
    frameworkId: string,
    assessment: ComplianceAssessmentResult
  ): Promise<EvidenceArtifact[]> {
    const artifacts: EvidenceArtifact[] = [];

    // Get project path
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Collect evidence for each control
    for (const control of assessment.controls) {
      const controlArtifacts = await this.collectControlEvidence(
        project.path || '',
        control.controlId,
        control
      );
      artifacts.push(...controlArtifacts);
    }

    // Store evidence collection
    const collection: EvidenceCollection = {
      id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      frameworkId,
      assessmentId: assessment.projectId,
      name: `Evidence Collection - ${new Date().toISOString()}`,
      artifacts,
      summary: {
        totalArtifacts: artifacts.length,
        byType: this.groupArtifactsByType(artifacts),
        size: this.calculateTotalSize(artifacts),
        hash: await this.calculateHash(artifacts)
      },
      timestamp: new Date()
    };

    try {
      await this.storeEvidenceCollection(collection);
    } catch (error) {
      console.warn('Could not store evidence collection in database:', error);
    }

    return artifacts;
  }

  /**
   * Collect evidence for a specific control
   */
  private async collectControlEvidence(
    projectPath: string,
    controlId: string,
    control: any
  ): Promise<EvidenceArtifact[]> {
    const artifacts: EvidenceArtifact[] = [];

    // Collect based on control category
    switch (control.category) {
      case 'data-protection':
        artifacts.push(...await this.collectDataProtectionEvidence(projectPath, controlId));
        break;
      case 'security':
        artifacts.push(...await this.collectSecurityEvidence(projectPath, controlId));
        break;
      case 'access-control':
        artifacts.push(...await this.collectAccessControlEvidence(projectPath, controlId));
        break;
      case 'incident-response':
        artifacts.push(...await this.collectIncidentResponseEvidence(projectPath, controlId));
        break;
      case 'logging':
        artifacts.push(...await this.collectLoggingEvidence(projectPath, controlId));
        break;
      default:
        artifacts.push(...await this.collectGeneralEvidence(projectPath, controlId));
    }

    // Add metadata evidence
    artifacts.push(await this.createMetadataArtifact(controlId, control));

    return artifacts;
  }

  /**
   * Collect data protection evidence
   */
  private async collectDataProtectionEvidence(
    projectPath: string,
    controlId: string
  ): Promise<EvidenceArtifact[]> {
    const artifacts: EvidenceArtifact[] = [];

    // Privacy policy documents
    const privacyDocs = [
      'PRIVACY.md',
      'privacy-policy.md',
      'docs/privacy.md',
      'docs/privacy-policy.md',
      'GDPR.md',
      'CCPA.md'
    ];

    for (const doc of privacyDocs) {
      const artifact = await this.collectDocument(projectPath, doc, controlId, 'document');
      if (artifact) artifacts.push(artifact);
    }

    // Data encryption configuration
    const encryptionConfigs = [
      '.env.example',
      'config/encryption.json',
      'config/security.json',
      'docker-compose.yml',
      'kubernetes/secrets.yaml'
    ];

    for (const config of encryptionConfigs) {
      const artifact = await this.collectConfiguration(projectPath, config, controlId);
      if (artifact) artifacts.push(artifact);
    }

    // Database schema for PII fields
    const schemaFiles = [
      'prisma/schema.prisma',
      'models/index.js',
      'migrations/',
      'src/database/schema.sql'
    ];

    for (const schema of schemaFiles) {
      const artifact = await this.collectCodeArtifact(projectPath, schema, controlId);
      if (artifact) artifacts.push(artifact);
    }

    return artifacts;
  }

  /**
   * Collect security evidence
   */
  private async collectSecurityEvidence(
    projectPath: string,
    controlId: string
  ): Promise<EvidenceArtifact[]> {
    const artifacts: EvidenceArtifact[] = [];

    // Security documentation
    const securityDocs = [
      'SECURITY.md',
      'docs/security.md',
      'docs/security-policy.md',
      'vulnerability-reporting.md'
    ];

    for (const doc of securityDocs) {
      const artifact = await this.collectDocument(projectPath, doc, controlId, 'document');
      if (artifact) artifacts.push(artifact);
    }

    // Security configurations
    const securityConfigs = [
      '.env.example',
      'config/security.js',
      'config/auth.js',
      'helmet.js',
      'cors.js',
      'webpack.security.js'
    ];

    for (const config of securityConfigs) {
      const artifact = await this.collectConfiguration(projectPath, config, controlId);
      if (artifact) artifacts.push(artifact);
    }

    // Security test files
    const securityTests = await this.findFilesByPattern(
      projectPath,
      '**/*.security.test.*',
      controlId
    );

    artifacts.push(...securityTests);

    // Dependency security files
    const depFiles = [
      'package-lock.json',
      'yarn.lock',
      'requirements.txt',
      'Pipfile.lock',
      'go.sum',
      'Cargo.lock'
    ];

    for (const dep of depFiles) {
      const artifact = await this.collectMetadataFile(projectPath, dep, controlId);
      if (artifact) artifacts.push(artifact);
    }

    return artifacts;
  }

  /**
   * Collect access control evidence
   */
  private async collectAccessControlEvidence(
    projectPath: string,
    controlId: string
  ): Promise<EvidenceArtifact[]> {
    const artifacts: EvidenceArtifact[] = [];

    // Auth configuration
    const authConfigs = [
      'config/auth.js',
      'config/passport.js',
      'config/jwt.js',
      'middleware/auth.js',
      'src/auth/index.js'
    ];

    for (const config of authConfigs) {
      const artifact = await this.collectCodeArtifact(projectPath, config, controlId);
      if (artifact) artifacts.push(artifact);
    }

    // RBAC definitions
    const rbacFiles = await this.findFilesByPattern(
      projectPath,
      '**/*{role,permission,rbac}*',
      controlId
    );

    artifacts.push(...rbacFiles);

    // API route protections
    const routeFiles = await this.findFilesByPattern(
      projectPath,
      '**/routes/**/*.js',
      controlId
    );

    artifacts.push(...routeFiles.slice(0, 10)); // Limit to prevent too many files

    return artifacts;
  }

  /**
   * Collect incident response evidence
   */
  private async collectIncidentResponseEvidence(
    projectPath: string,
    controlId: string
  ): Promise<EvidenceArtifact[]> {
    const artifacts: EvidenceArtifact[] = [];

    // Incident response documentation
    const irDocs = [
      'docs/incident-response.md',
      'docs/irp.md',
      'docs/emergency-procedures.md',
      'INCIDENT-RESPONSE.md'
    ];

    for (const doc of irDocs) {
      const artifact = await this.collectDocument(projectPath, doc, controlId, 'document');
      if (artifact) artifacts.push(artifact);
    }

    // Monitoring configuration
    const monitorConfigs = [
      'config/monitoring.js',
      'prometheus.yml',
      'grafana/dashboards/',
      'docker-compose.monitoring.yml'
    ];

    for (const config of monitorConfigs) {
      const artifact = await this.collectConfiguration(projectPath, config, controlId);
      if (artifact) artifacts.push(artifact);
    }

    return artifacts;
  }

  /**
   * Collect logging evidence
   */
  private async collectLoggingEvidence(
    projectPath: string,
    controlId: string
  ): Promise<EvidenceArtifact[]> {
    const artifacts: EvidenceArtifact[] = [];

    // Logging configuration
    const logConfigs = [
      'config/logger.js',
      'config/winston.js',
      'config/log4js.js',
      'src/utils/logger.js'
    ];

    for (const config of logConfigs) {
      const artifact = await this.collectCodeArtifact(projectPath, config, controlId);
      if (artifact) artifacts.push(artifact);
    }

    // Sample log files (if they exist)
    const logFiles = await this.findFilesByPattern(
      projectPath,
      '**/*.log',
      controlId
    );

    artifacts.push(...logFiles.slice(0, 5)); // Limit to prevent too many files

    return artifacts;
  }

  /**
   * Collect general evidence
   */
  private async collectGeneralEvidence(
    projectPath: string,
    controlId: string
  ): Promise<EvidenceArtifact[]> {
    const artifacts: EvidenceArtifact[] = [];

    // README and documentation
    const docs = [
      'README.md',
      'CONTRIBUTING.md',
      'CHANGELOG.md',
      'docs/'
    ];

    for (const doc of docs) {
      const artifact = await this.collectDocument(projectPath, doc, controlId, 'document');
      if (artifact) artifacts.push(artifact);
    }

    return artifacts;
  }

  /**
   * Collect a document artifact
   */
  private async collectDocument(
    projectPath: string,
    relativePath: string,
    controlId: string,
    type: EvidenceArtifact['type']
  ): Promise<EvidenceArtifact | null> {
    const fullPath = join(projectPath, relativePath);

    if (!existsSync(fullPath)) {
      return null;
    }

    try {
      const content = readFileSync(fullPath, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');
      const stats = statSync(fullPath);

      // Redact sensitive information
      const redactedContent = this.redactSensitiveData(content);

      return {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        controlId,
        type,
        name: basename(relativePath),
        path: relativePath,
        content: redactedContent,
        hash,
        size: stats.size,
        timestamp: new Date(),
        metadata: {
          extension: extname(relativePath),
          lastModified: stats.mtime
        }
      };
    } catch (error) {
      console.error(`Failed to collect document ${relativePath}:`, error);
      return null;
    }
  }

  /**
   * Collect a configuration artifact
   */
  private async collectConfiguration(
    projectPath: string,
    relativePath: string,
    controlId: string
  ): Promise<EvidenceArtifact | null> {
    const fullPath = join(projectPath, relativePath);

    if (!existsSync(fullPath)) {
      return null;
    }

    try {
      let content = readFileSync(fullPath, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');
      const stats = statSync(fullPath);

      // Redact sensitive values
      content = this.redactConfiguration(content);

      return {
        id: `cfg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        controlId,
        type: 'configuration',
        name: basename(relativePath),
        path: relativePath,
        content,
        hash,
        size: stats.size,
        timestamp: new Date(),
        metadata: {
          extension: extname(relativePath),
          lastModified: stats.mtime
        }
      };
    } catch (error) {
      console.error(`Failed to collect configuration ${relativePath}:`, error);
      return null;
    }
  }

  /**
   * Collect a code artifact
   */
  private async collectCodeArtifact(
    projectPath: string,
    relativePath: string,
    controlId: string
  ): Promise<EvidenceArtifact | null> {
    const fullPath = join(projectPath, relativePath);

    if (!existsSync(fullPath)) {
      return null;
    }

    try {
      const content = readFileSync(fullPath, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');
      const stats = statSync(fullPath);

      return {
        id: `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        controlId,
        type: 'code',
        name: basename(relativePath),
        path: relativePath,
        content,
        hash,
        size: stats.size,
        timestamp: new Date(),
        metadata: {
          extension: extname(relativePath),
          language: this.detectLanguage(relativePath),
          lastModified: stats.mtime
        }
      };
    } catch (error) {
      console.error(`Failed to collect code artifact ${relativePath}:`, error);
      return null;
    }
  }

  /**
   * Collect metadata file
   */
  private async collectMetadataFile(
    projectPath: string,
    relativePath: string,
    controlId: string
  ): Promise<EvidenceArtifact | null> {
    const fullPath = join(projectPath, relativePath);

    if (!existsSync(fullPath)) {
      return null;
    }

    try {
      const content = readFileSync(fullPath, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');
      const stats = statSync(fullPath);

      return {
        id: `meta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        controlId,
        type: 'metadata',
        name: basename(relativePath),
        path: relativePath,
        content,
        hash,
        size: stats.size,
        timestamp: new Date(),
        metadata: {
          extension: extname(relativePath),
          lastModified: stats.mtime
        }
      };
    } catch (error) {
      console.error(`Failed to collect metadata ${relativePath}:`, error);
      return null;
    }
  }

  /**
   * Find files by pattern
   */
  private async findFilesByPattern(
    projectPath: string,
    pattern: string,
    controlId: string
  ): Promise<EvidenceArtifact[]> {
    const artifacts: EvidenceArtifact[] = [];

    try {
      // Simple glob implementation - in production use a proper glob library
      const files = this.globFiles(projectPath, pattern);

      for (const file of files.slice(0, 20)) { // Limit results
        const artifact = await this.collectCodeArtifact(
          projectPath,
          file.replace(projectPath + '/', ''),
          controlId
        );
        if (artifact) artifacts.push(artifact);
      }
    } catch (error) {
      console.error(`Failed to find files with pattern ${pattern}:`, error);
    }

    return artifacts;
  }

  /**
   * Simple glob implementation
   */
  private globFiles(basePath: string, pattern: string): string[] {
    const files: string[] = [];
    const parts = pattern.split('/');

    const search = (dir: string, index: number) => {
      if (index === parts.length) {
        files.push(dir);
        return;
      }

      const part = parts[index];
      
      if (!existsSync(dir)) return;

      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const stats = statSync(fullPath);

        if (stats.isDirectory() && index < parts.length - 1) {
          search(fullPath, index + 1);
        } else if (stats.isFile() && part && this.matchesPattern(item, part)) {
          files.push(fullPath);
        }
      }
    };

    search(basePath, 0);
    return files;
  }

  /**
   * Check if filename matches pattern
   */
  private matchesPattern(filename: string, pattern: string): boolean {
    if (pattern === '**') return true;
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filename);
    }
    return filename === pattern;
  }

  /**
   * Create metadata artifact
   */
  private async createMetadataArtifact(
    controlId: string,
    control: any
  ): Promise<EvidenceArtifact> {
    const metadata = {
      controlId,
      requirements: control.requirements,
      assessmentStatus: control.status,
      assessmentScore: control.score,
      findings: control.findings,
      gaps: control.gaps
    };

    const content = JSON.stringify(metadata, null, 2);
    const hash = createHash('sha256').update(content).digest('hex');

    return {
      id: `meta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      controlId,
      type: 'metadata',
      name: `control-${controlId}-metadata.json`,
      content,
      hash,
      size: content.length,
      timestamp: new Date(),
      metadata: {
        format: 'json',
        generated: true
      }
    };
  }

  /**
   * Redact sensitive data from content
   */
  private redactSensitiveData(content: string): string {
    // Redact common sensitive patterns
    return content
      .replace(/password["\s]*[:=]["\s]*[^"'\s]+/gi, 'password: "[REDACTED]"')
      .replace(/secret["\s]*[:=]["\s]*[^"'\s]+/gi, 'secret: "[REDACTED]"')
      .replace(/key["\s]*[:=]["\s]*[^"'\s]+/gi, 'key: "[REDACTED]"')
      .replace(/token["\s]*[:=]["\s]*[^"'\s]+/gi, 'token: "[REDACTED]"')
      .replace(/api[_-]?key["\s]*[:=]["\s]*[^"'\s]+/gi, 'api_key: "[REDACTED]"')
      .replace(/[A-Za-z0-9]{32,}/g, '[REDACTED]'); // Redact long strings (potential keys)
  }

  /**
   * Redact sensitive configuration values
   */
  private redactConfiguration(content: string): string {
    return this.redactSensitiveData(content);
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filename: string): string {
    const ext = extname(filename).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rb': 'ruby',
      '.php': 'php',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.sh': 'shell',
      '.sql': 'sql',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.json': 'json',
      '.toml': 'toml',
      '.ini': 'ini'
    };

    return languageMap[ext] || 'unknown';
  }

  /**
   * Group artifacts by type
   */
  private groupArtifactsByType(artifacts: EvidenceArtifact[]): Record<string, number> {
    const byType: Record<string, number> = {};

    for (const artifact of artifacts) {
      byType[artifact.type] = (byType[artifact.type] || 0) + 1;
    }

    return byType;
  }

  /**
   * Calculate total size of artifacts
   */
  private calculateTotalSize(artifacts: EvidenceArtifact[]): number {
    let totalSize = 0;

    for (const artifact of artifacts) {
      totalSize += artifact.size;
    }

    return totalSize;
  }

  /**
   * Calculate hash of artifacts
   */
  private async calculateHash(artifacts: EvidenceArtifact[]): Promise<string> {
    const hash = createHash('sha256');

    for (const artifact of artifacts) {
      hash.update(artifact.content || '');
    }

    return hash.digest('hex');
  }

  /**
   * Store evidence collection in database
   */
  private async storeEvidenceCollection(collection: EvidenceCollection): Promise<void> {
    // Store in database
    try {
      // @ts-ignore - evidenceCollection may not exist in schema yet
      await prisma.evidenceCollection.create({
        data: {
          projectId: collection.projectId,
          name: `Evidence for ${collection.frameworkId}`,
          description: `Collected on ${new Date().toISOString()}`,
          artifacts: collection.artifacts as any,
          metadata: {
            frameworkId: collection.frameworkId,
            assessmentId: collection.assessmentId,
            totalArtifacts: collection.summary.totalArtifacts
          }
        }
      });
    } catch (error) {
      console.warn('Could not store evidence collection in database:', error);
    }
  }

  /**
   * Retrieve evidence collection
   */
  async getEvidenceCollection(collectionId: string): Promise<EvidenceCollection | null> {
    try {
      const collection = await prisma.evidenceCollection.findUnique({
        where: { id: collectionId }
      });

      if (!collection) return null;

      return {
        id: collection.id,
        projectId: collection.projectId,
        name: collection.name,
        description: collection.description || undefined,
        frameworkId: (collection.metadata as any)?.frameworkId,
        assessmentId: (collection.metadata as any)?.assessmentId,
        artifacts: (collection.artifacts as any) || [],
        summary: {
          totalArtifacts: (collection.metadata as any)?.totalArtifacts || 0,
          byType: (collection.metadata as any)?.byType || {},
          size: (collection.metadata as any)?.size || 0,
          hash: (collection.metadata as any)?.hash || ''
        },
        timestamp: collection.createdAt
      };
    } catch (error) {
      console.warn('Could not retrieve evidence collection from database:', error);
      return null;
    }
  }

  /**
   * List evidence collections for a project
   */
  async listEvidenceCollections(projectId: string): Promise<EvidenceCollection[]> {
    try {
      const collections = await prisma.evidenceCollection.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' }
      });

      return collections.map((c: any) => ({
        id: c.id,
        projectId: c.projectId,
        name: c.name,
        description: c.description,
        frameworkId: (c.metadata as any)?.frameworkId,
        assessmentId: (c.metadata as any)?.assessmentId,
        artifacts: c.artifacts as EvidenceArtifact[],
        summary: {
          totalArtifacts: (c.metadata as any)?.totalArtifacts || 0,
          byType: (c.metadata as any)?.byType || {},
          size: (c.metadata as any)?.size || 0,
          hash: (c.metadata as any)?.hash || ''
        },
        timestamp: c.createdAt
      }));
    } catch (error) {
      console.warn('Could not list evidence collections from database:', error);
      return [];
    }
  }
}

// Export singleton instance
export const evidenceCollector = new EvidenceCollector();
