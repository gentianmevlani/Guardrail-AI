import { prisma } from '@guardrail/database';
import { readFileSync, existsSync } from 'fs';
import { DOCKERFILE_RULES } from './rules';

export interface Vulnerability {
  id: string; // CVE ID
  severity: 'critical' | 'high' | 'medium' | 'low';
  package: string;
  installedVersion: string;
  fixedVersion?: string;
  description: string;
}

export interface DockerfileFinding {
  ruleId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  line: number;
  instruction: string;
  value: string;
  recommendation: string;
}

export interface LayerAnalysis {
  size: number;
  command: string;
  created: string;
}

export interface ContainerScanResult {
  projectId: string;
  imageName: string;
  imageTag: string;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  vulnerabilities: Vulnerability[];
  baseImage?: string;
  layers?: LayerAnalysis[];
}

export class ContainerScanner {
  /**
   * Scan Docker image for vulnerabilities
   * In production, would integrate with Trivy or Grype
   */
  async scanImage(imageName: string, tag: string, projectId: string): Promise<ContainerScanResult> {
    // Simulate vulnerability scanning
    // In production, would execute: trivy image imageName:tag --format json
    const vulnerabilities: Vulnerability[] = [];

    // Example vulnerabilities (in production, parsed from Trivy/Grype output)
    // const exampleVulns: Vulnerability[] = [
    //   {
    //     id: 'CVE-2024-1234',
    //     severity: 'high',
    //     package: 'openssl',
    //     installedVersion: '1.1.1k',
    //     fixedVersion: '1.1.1w',
    //     description: 'OpenSSL vulnerability'
    //   }
    // ];

    const summary = {
      critical: vulnerabilities.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length,
      medium: vulnerabilities.filter(v => v.severity === 'medium').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length
    };

    // Save to database
    try {
      await prisma.containerScan.create({
        data: {
          projectId
        } as any
      });
    } catch (error) {
      // Table may not exist - continue
    }

    return {
      projectId,
      imageName,
      imageTag: tag,
      summary,
      vulnerabilities
    };
  }

  /**
   * Scan Dockerfile for security issues
   */
  async scanDockerfile(dockerfilePath: string): Promise<DockerfileFinding[]> {
    if (!existsSync(dockerfilePath)) {
      throw new Error(`Dockerfile not found: ${dockerfilePath}`);
    }

    const content = readFileSync(dockerfilePath, 'utf-8');
    const lines = content.split('\n');
    const findings: DockerfileFinding[] = [];

    let hasHealthcheck = false;
    let hasUser = false;
    let fromCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;

      // Skip comments and empty lines
      if (line.startsWith('#')) {
        continue;
      }

      // Parse instruction
      const parts = line.split(/\s+/);
      const instruction = parts[0]?.toUpperCase();
      const value = parts.slice(1).join(' ');

      // Track special instructions
      if (instruction === 'HEALTHCHECK') hasHealthcheck = true;
      if (instruction === 'USER') hasUser = true;
      if (instruction === 'FROM') fromCount++;

      // Check against rules
      for (const rule of DOCKERFILE_RULES) {
        if (rule.check(instruction!, value || '')) {
          findings.push({
            ruleId: rule.id,
            title: rule.title,
            description: rule.description,
            severity: rule.severity,
            line: i + 1,
            instruction: instruction!,
            value: value || '',
            recommendation: rule.recommendation
          });
        }
      }
    }

    // Check for missing HEALTHCHECK
    if (!hasHealthcheck) {
      findings.push({
        ruleId: 'DOCKER-003',
        title: 'Missing Health Check',
        description: 'No HEALTHCHECK instruction defined',
        severity: 'low',
        line: 0,
        instruction: 'HEALTHCHECK',
        value: '',
        recommendation: 'Add HEALTHCHECK instruction'
      });
    }

    // Check for missing USER (running as root)
    if (!hasUser) {
      findings.push({
        ruleId: 'DOCKER-001',
        title: 'Running as Root',
        description: 'No USER instruction - container runs as root',
        severity: 'high',
        line: 0,
        instruction: 'USER',
        value: '',
        recommendation: 'Add USER instruction to run as non-root'
      });
    }

    // Check for multi-stage builds
    if (fromCount === 1) {
      findings.push({
        ruleId: 'DOCKER-006',
        title: 'Missing Multi-Stage Build',
        description: 'Single-stage build - consider using multi-stage',
        severity: 'low',
        line: 0,
        instruction: 'FROM',
        value: '',
        recommendation: 'Use multi-stage builds to reduce image size'
      });
    }

    return findings;
  }

  /**
   * Analyze image layers
   * In production, would use: docker history imageName:tag
   */
  // private analyzeImageLayers(_imageName: string, _tag: string): LayerAnalysis[] {
  //   // Placeholder - in production would parse docker history output
  //   return [];
  // }
}

export const containerScanner = new ContainerScanner();
