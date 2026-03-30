import { prisma } from '@guardrail/database';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { PII_PATTERNS, PII_FIELD_PATTERNS, PII_TEST_VALUES, NON_PII_CONTEXT_INDICATORS } from './patterns';
import { dataFlowTracker, PIIFinding, DataFlow } from './data-flow';

export interface PIIDetectionResult {
  projectId: string;
  summary: {
    totalFindings: number;
    byCategory: Record<string, number>;
    riskLevel: 'high' | 'medium' | 'low';
  };
  findings: PIIFinding[];
  dataFlows: DataFlow[];
  recommendations: string[];
}

export class PIIDetector {
  /**
   * Detect PII in entire project
   */
  async detectPII(projectPath: string, projectId: string): Promise<PIIDetectionResult> {
    const allFindings: PIIFinding[] = [];

    // Find all source files
    const sourceFiles = this.findSourceFiles(projectPath);

    // Scan each file
    for (const filePath of sourceFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const findings = this.scanContent(content, filePath);
        allFindings.push(...findings);

        // Also scan for PII field names
        const fieldFindings = this.scanFieldNames(content, filePath);
        allFindings.push(...fieldFindings);
      } catch (error) {
        console.error(`Error scanning file ${filePath}:`, error);
      }
    }

    // Track data flows
    const dataFlows = await this.trackPIIDataFlows(projectPath, allFindings);

    // Generate recommendations
    const recommendations = this.generateRecommendations(allFindings, dataFlows);

    // Calculate summary
    const byCategory: Record<string, number> = {};
    for (const finding of allFindings) {
      byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;
    }

    const highSeverityCount = allFindings.filter(f => f.severity === 'high').length;
    const riskLevel: 'high' | 'medium' | 'low' =
      highSeverityCount > 5 ? 'high' :
      highSeverityCount > 0 ? 'medium' : 'low';

    const result: PIIDetectionResult = {
      projectId,
      summary: {
        totalFindings: allFindings.length,
        byCategory,
        riskLevel
      },
      findings: allFindings,
      dataFlows,
      recommendations
    };

    // Save to database
    try {
      await prisma.pIIDetection.create({
        data: {
          projectId
        } as any
      });
    } catch (error) {
      // Table may not exist - continue
    }

    return result;
  }

  /**
   * Scan file content for PII patterns
   */
  private scanContent(content: string, filePath: string): PIIFinding[] {
    const findings: PIIFinding[] = [];
    const lines = content.split('\n');

    for (const pattern of PII_PATTERNS) {
      let match;
      while ((match = pattern.pattern.exec(content)) !== null) {
        const value = match[0];

        // Skip test values
        if (this.isTestValue(value)) {
          continue;
        }

        // Get line and column
        const position = this.getLineAndColumn(content, match.index);

        // Get context
        const context = this.getContext(lines, position.line);

        // Skip if in non-PII context
        if (this.isNonPIIContext(context)) {
          continue;
        }

        findings.push({
          category: pattern.category,
          value: this.maskValue(value, pattern.category),
          location: {
            file: filePath,
            line: position.line + 1,
            column: position.column
          },
          context,
          severity: pattern.severity
        });
      }

      // Reset lastIndex for global regex
      pattern.pattern.lastIndex = 0;
    }

    return findings;
  }

  /**
   * Scan AST for PII field names
   */
  private scanFieldNames(content: string, filePath: string): PIIFinding[] {
    const findings: PIIFinding[] = [];
    const lines = content.split('\n');

    // Simple pattern matching for field names
    // In production, would use proper AST parsing

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      for (const fieldPattern of PII_FIELD_PATTERNS) {
        const matches = line.matchAll(fieldPattern.pattern);

        for (const match of matches) {
          const fieldName = match[0];
          const context = this.getContext(lines, i);

          // Skip if in comments or strings
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
            continue;
          }

          findings.push({
            category: fieldPattern.category,
            value: fieldName,
            location: {
              file: filePath,
              line: i + 1,
              column: match.index || 0
            },
            context,
            severity: fieldPattern.severity
          });
        }
      }
    }

    return findings;
  }

  /**
   * Track data flows for PII
   */
  private async trackPIIDataFlows(_projectPath: string, findings: PIIFinding[]): Promise<DataFlow[]> {
    // Use data flow tracker to analyze flows
    return dataFlowTracker.analyzeDataFlows(findings);
  }

  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(findings: PIIFinding[], dataFlows: DataFlow[]): string[] {
    const recommendations: string[] = [];

    // Count findings by category
    const bySeverity = {
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length
    };

    if (bySeverity.high > 0) {
      recommendations.push(`🔴 Found ${bySeverity.high} high-severity PII findings - immediate action required`);
      recommendations.push('Implement encryption for sensitive data fields');
      recommendations.push('Review and minimize PII storage');
    }

    // Check for unencrypted storage
    const unencryptedStorage = dataFlows.some(flow =>
      flow.storage.some(s => !s.encrypted)
    );

    if (unencryptedStorage) {
      recommendations.push('⚠️ PII detected in unencrypted storage - enable encryption at rest');
    }

    // Check for external transfers
    const hasExternalTransfers = dataFlows.some(flow => flow.externalTransfers.length > 0);

    if (hasExternalTransfers) {
      recommendations.push('📡 PII transferred to external systems - ensure proper data processing agreements');
    }

    // General recommendations
    if (findings.length > 0) {
      recommendations.push('Implement data retention policies');
      recommendations.push('Add user consent mechanisms for PII collection');
      recommendations.push('Consider pseudonymization or anonymization techniques');
      recommendations.push('Implement access controls for PII data');
      recommendations.push('Add audit logging for PII access');
    }

    return recommendations;
  }

  /**
   * Find source files in project
   */
  private findSourceFiles(dir: string): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rb', '.php'];

    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules' && entry !== 'dist') {
          files.push(...this.findSourceFiles(fullPath));
        } else if (stat.isFile()) {
          if (extensions.some(ext => entry.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignore permission errors
    }

    return files;
  }

  /**
   * Check if value is a test value
   */
  private isTestValue(value: string): boolean {
    return PII_TEST_VALUES.some(test => value.includes(test));
  }

  /**
   * Check if context indicates non-PII usage
   */
  private isNonPIIContext(context: string): boolean {
    const lowerContext = context.toLowerCase();
    return NON_PII_CONTEXT_INDICATORS.some(indicator =>
      lowerContext.includes(indicator)
    );
  }

  /**
   * Get line and column from position
   */
  private getLineAndColumn(content: string, position: number): { line: number; column: number } {
    const lines = content.substring(0, position).split('\n');
    const lastLine = lines[lines.length - 1] || '';
    return {
      line: lines.length - 1,
      column: lastLine.length
    };
  }

  /**
   * Get context around a line
   */
  private getContext(lines: string[], lineIndex: number, contextSize: number = 2): string {
    const start = Math.max(0, lineIndex - contextSize);
    const end = Math.min(lines.length, lineIndex + contextSize + 1);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Mask sensitive value
   */
  private maskValue(value: string, category: string): string {
    if (category === 'email') {
      const parts = value.split('@');
      const local = parts[0];
      const domain = parts[1];
      if (local && domain) {
        return `${local.charAt(0)}***@${domain}`;
      }
      return '***@***.com';
    }

    if (category === 'phone') {
      return `***-***-${value.slice(-4)}`;
    }

    if (category === 'ssn' || category === 'credit-card') {
      return `***-**-${value.slice(-4)}`;
    }

    return `${value.slice(0, 3)}***`;
  }
}

export const piiDetector = new PIIDetector();
