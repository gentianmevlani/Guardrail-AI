import { readFileSync } from 'fs';
import { join, relative } from 'path';

export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  file: string;
  line: number;
  description: string;
  recommendation: string;
}

export interface Fix {
  findingId: string;
  file: string;
  line: number;
  oldCode: string;
  newCode: string;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  explanation: string;
}

export interface FixPack {
  id: string;
  category: 'quality' | 'security' | 'config';
  name: string;
  description: string;
  findings: Finding[];
  fixes: Fix[];
  estimatedRisk: 'low' | 'medium' | 'high';
  impactedFiles: string[];
  priority: number;
  confidence: number;
}

export interface ScanResult {
  findings: Finding[];
  projectPath: string;
  scanType?: string;
}

export class FixEngine {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Generate fix packs from scan results
   */
  async generateFixPacks(scanResult: ScanResult): Promise<FixPack[]> {
    const packs: FixPack[] = [];
    
    // Group findings by category
    const securityFindings = scanResult.findings.filter(f => 
      f.category.toLowerCase().includes('secret') || 
      f.category.toLowerCase().includes('vulnerability') ||
      f.category.toLowerCase().includes('security')
    );
    
    const qualityFindings = scanResult.findings.filter(f => 
      f.category.toLowerCase().includes('quality') ||
      f.category.toLowerCase().includes('code') ||
      f.category.toLowerCase().includes('smell')
    );
    
    const configFindings = scanResult.findings.filter(f => 
      f.category.toLowerCase().includes('config') ||
      f.category.toLowerCase().includes('dependency')
    );

    // Generate security fix pack
    if (securityFindings.length > 0) {
      const securityPack = await this.createSecurityFixPack(securityFindings);
      if (securityPack.fixes.length > 0) {
        packs.push(securityPack);
      }
    }

    // Generate quality fix pack
    if (qualityFindings.length > 0) {
      const qualityPack = await this.createQualityFixPack(qualityFindings);
      if (qualityPack.fixes.length > 0) {
        packs.push(qualityPack);
      }
    }

    // Generate config fix pack
    if (configFindings.length > 0) {
      const configPack = await this.createConfigFixPack(configFindings);
      if (configPack.fixes.length > 0) {
        packs.push(configPack);
      }
    }

    return packs;
  }

  private async createSecurityFixPack(findings: Finding[]): Promise<FixPack> {
    const fixes: Fix[] = [];
    const impactedFiles = new Set<string>();

    for (const finding of findings) {
      impactedFiles.add(finding.file);
      
      // Generate fix based on finding type
      if (finding.category.toLowerCase().includes('secret')) {
        const fix = this.generateSecretFix(finding);
        if (fix) fixes.push(fix);
      } else if (finding.category.toLowerCase().includes('vulnerability')) {
        const fix = this.generateVulnerabilityFix(finding);
        if (fix) fixes.push(fix);
<<<<<<< HEAD
      } else if (finding.category.toLowerCase().includes('security')) {
        const fix = this.generateSecretFix(finding) ?? this.generateVulnerabilityFix(finding);
        if (fix) fixes.push(fix);
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      }
    }

    const avgConfidence = fixes.length > 0 
      ? fixes.reduce((sum, f) => sum + f.confidence, 0) / fixes.length 
      : 0;

    return {
      id: 'security-fixes',
      category: 'security',
      name: 'Security Vulnerabilities',
      description: 'Fix hardcoded secrets and security vulnerabilities',
      findings,
      fixes,
      estimatedRisk: this.calculatePackRisk(fixes),
      impactedFiles: Array.from(impactedFiles),
      priority: 1,
      confidence: avgConfidence,
    };
  }

  private async createQualityFixPack(findings: Finding[]): Promise<FixPack> {
    const fixes: Fix[] = [];
    const impactedFiles = new Set<string>();

    for (const finding of findings) {
      impactedFiles.add(finding.file);
      const fix = this.generateQualityFix(finding);
      if (fix) fixes.push(fix);
    }

    const avgConfidence = fixes.length > 0 
      ? fixes.reduce((sum, f) => sum + f.confidence, 0) / fixes.length 
      : 0;

    return {
      id: 'quality-fixes',
      category: 'quality',
      name: 'Code Quality Improvements',
      description: 'Improve code quality and best practices',
      findings,
      fixes,
      estimatedRisk: this.calculatePackRisk(fixes),
      impactedFiles: Array.from(impactedFiles),
      priority: 2,
      confidence: avgConfidence,
    };
  }

  private async createConfigFixPack(findings: Finding[]): Promise<FixPack> {
    const fixes: Fix[] = [];
    const impactedFiles = new Set<string>();

    for (const finding of findings) {
      impactedFiles.add(finding.file);
      const fix = this.generateConfigFix(finding);
      if (fix) fixes.push(fix);
    }

    const avgConfidence = fixes.length > 0 
      ? fixes.reduce((sum, f) => sum + f.confidence, 0) / fixes.length 
      : 0;

    return {
      id: 'config-fixes',
      category: 'config',
      name: 'Configuration Updates',
      description: 'Update dependencies and configuration',
      findings,
      fixes,
      estimatedRisk: this.calculatePackRisk(fixes),
      impactedFiles: Array.from(impactedFiles),
      priority: 3,
      confidence: avgConfidence,
    };
  }

  private generateSecretFix(finding: Finding): Fix | null {
    try {
      const filePath = join(this.projectPath, finding.file);
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      if (finding.line <= 0 || finding.line > lines.length) {
        return null;
      }

      const oldCode = lines[finding.line - 1];
<<<<<<< HEAD
      if (oldCode === undefined) {
        return null;
      }

=======
      
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      // Generate fix based on secret type
      let newCode = oldCode;
      let explanation = '';
      let confidence = 0.7;

      if (finding.title.toLowerCase().includes('api key') || 
          finding.title.toLowerCase().includes('token')) {
        // Replace hardcoded value with environment variable
        const match = oldCode.match(/['"`]([a-zA-Z0-9_\-]{20,})['"`]/);
        if (match) {
          const secretValue = match[1];
          const varName = this.inferEnvVarName(finding.title);
          newCode = oldCode.replace(match[0], `process.env.${varName}`);
          explanation = `Replace hardcoded ${finding.title} with environment variable ${varName}`;
          confidence = 0.85;
        }
      } else if (finding.title.toLowerCase().includes('password')) {
        const varName = 'DB_PASSWORD';
        newCode = oldCode.replace(/password\s*[:=]\s*['"`][^'"`]+['"`]/i, 
          `password: process.env.${varName}`);
        explanation = `Replace hardcoded password with environment variable ${varName}`;
        confidence = 0.8;
      }

      if (newCode === oldCode) {
        // Generic fix: comment out the line
        newCode = `// TODO: Move to environment variable\n${oldCode}`;
        explanation = 'Comment out hardcoded secret and add TODO';
        confidence = 0.5;
      }

      return {
        findingId: finding.id,
        file: finding.file,
        line: finding.line,
        oldCode,
        newCode,
        confidence,
        risk: confidence > 0.7 ? 'low' : 'medium',
        explanation,
      };
    } catch {
      return null;
    }
  }

  private generateVulnerabilityFix(finding: Finding): Fix | null {
    // For dependency vulnerabilities, suggest package.json updates
    if (finding.file === 'package.json') {
      try {
        const filePath = join(this.projectPath, finding.file);
        const content = readFileSync(filePath, 'utf-8');
        const packageJson = JSON.parse(content);
        
        // Extract package name and version from recommendation
        const match = finding.recommendation.match(/Upgrade to ([^@]+)@([^\s]+)/);
        if (match) {
<<<<<<< HEAD
          const pkgName = match[1];
          const newVersion = match[2];
          if (pkgName === undefined || newVersion === undefined) {
            return null;
          }
=======
          const [, pkgName, newVersion] = match;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
          const oldVersion = packageJson.dependencies?.[pkgName] || 
                            packageJson.devDependencies?.[pkgName];
          
          if (oldVersion) {
            return {
              findingId: finding.id,
              file: finding.file,
              line: finding.line,
              oldCode: `"${pkgName}": "${oldVersion}"`,
              newCode: `"${pkgName}": "^${newVersion}"`,
              confidence: 0.9,
              risk: 'low',
              explanation: `Upgrade ${pkgName} to ${newVersion} to fix ${finding.title}`,
            };
          }
        }
      } catch {
        return null;
      }
    }
    
    return null;
  }

  private generateQualityFix(finding: Finding): Fix | null {
    try {
      const filePath = join(this.projectPath, finding.file);
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      if (finding.line <= 0 || finding.line > lines.length) {
        return null;
      }

      const oldCode = lines[finding.line - 1];
<<<<<<< HEAD
      if (oldCode === undefined) {
        return null;
      }
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      let newCode = oldCode;
      let explanation = '';
      let confidence = 0.6;

      // Example quality fixes
      if (oldCode.includes('console.log')) {
        newCode = oldCode.replace(/console\.log/g, 'logger.debug');
        explanation = 'Replace console.log with proper logger';
        confidence = 0.8;
      } else if (oldCode.includes('var ')) {
        newCode = oldCode.replace(/\bvar\b/g, 'const');
        explanation = 'Replace var with const for better scoping';
        confidence = 0.75;
      }

      if (newCode === oldCode) {
        return null;
      }

      return {
        findingId: finding.id,
        file: finding.file,
        line: finding.line,
        oldCode,
        newCode,
        confidence,
        risk: 'low',
        explanation,
      };
    } catch {
      return null;
    }
  }

  private generateConfigFix(finding: Finding): Fix | null {
    return this.generateVulnerabilityFix(finding);
  }

  private calculatePackRisk(fixes: Fix[]): 'low' | 'medium' | 'high' {
    if (fixes.length === 0) return 'low';
    
    const highRiskCount = fixes.filter(f => f.risk === 'high').length;
    const mediumRiskCount = fixes.filter(f => f.risk === 'medium').length;
    
    if (highRiskCount > fixes.length * 0.3) return 'high';
    if (mediumRiskCount > fixes.length * 0.5) return 'medium';
    return 'low';
  }

  private inferEnvVarName(title: string): string {
    const normalized = title
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    
    if (normalized.includes('API_KEY')) return 'API_KEY';
    if (normalized.includes('TOKEN')) return 'AUTH_TOKEN';
    if (normalized.includes('SECRET')) return 'SECRET_KEY';
    
    return normalized || 'SECRET_VALUE';
  }
}
