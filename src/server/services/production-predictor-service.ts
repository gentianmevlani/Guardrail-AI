/**
 * Production Predictor Service
 * 
 * Real implementation for predicting production issues.
 * Analyzes code for performance, memory, security, and scalability issues.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProductionAnomaly {
  type: 'Performance' | 'Memory' | 'Security' | 'Scalability' | 'Reliability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  impact: {
    usersAffected: number | string;
    downtime: string;
    costEstimate: string;
  };
  location: string;
  solution: string;
  evidence: string[];
}

export interface ProductionAnalysis {
  readiness: 'safe' | 'caution' | 'dangerous';
  score: number;
  anomalies: ProductionAnomaly[];
  stats: {
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    estimatedUsersAtRisk: number;
    estimatedCostImpact: string;
    potentialDowntime: string;
  };
  analyzedAt: string;
}

// Pattern detectors for production issues
interface ProductionCheck {
  pattern: RegExp;
  type: ProductionAnomaly['type'];
  severity: ProductionAnomaly['severity'];
  description: string;
  impact: Partial<ProductionAnomaly['impact']>;
  solution: string;
}

const productionChecks: ProductionCheck[] = [
  // Performance issues
  {
    pattern: /for\s*\([^)]+\)\s*\{[^}]*await\s+.*\.(find|query|select|get)/gis,
    type: 'Performance',
    severity: 'high',
    description: 'N+1 query pattern detected - sequential database queries in loop',
    impact: { usersAffected: 5000, downtime: '0 min', costEstimate: '$2,400/month in increased latency' },
    solution: 'Implement eager loading, batch queries, or use DataLoader pattern',
  },
  {
    pattern: /\.map\([^)]+\)\s*\.\s*filter|\.filter\([^)]+\)\s*\.\s*map/g,
    type: 'Performance',
    severity: 'low',
    description: 'Chained array operations causing multiple iterations',
    impact: { usersAffected: 1000, downtime: '0 min', costEstimate: '$200/month' },
    solution: 'Combine into single reduce() or use more efficient algorithm',
  },
  {
    pattern: /JSON\.parse\(.*JSON\.stringify/g,
    type: 'Performance',
    severity: 'medium',
    description: 'Deep clone using JSON serialization is slow for large objects',
    impact: { usersAffected: 2000, downtime: '0 min', costEstimate: '$500/month' },
    solution: 'Use structuredClone() or lodash.cloneDeep for better performance',
  },
  
  // Memory issues
  {
    pattern: /setInterval|setTimeout.*(?!clearInterval|clearTimeout)/g,
    type: 'Memory',
    severity: 'medium',
    description: 'Timer not properly cleaned up - potential memory leak',
    impact: { usersAffected: 1200, downtime: '15 min (restart needed)', costEstimate: '$800/month' },
    solution: 'Store timer reference and clear on cleanup/unmount',
  },
  {
    pattern: /addEventListener(?!.*removeEventListener)/g,
    type: 'Memory',
    severity: 'medium',
    description: 'Event listener without corresponding removal',
    impact: { usersAffected: 800, downtime: '10 min', costEstimate: '$400/month' },
    solution: 'Add corresponding removeEventListener on cleanup',
  },
  {
    pattern: /new\s+Array\s*\(\s*\d{6,}\s*\)|Array\s*\(\s*\d{6,}\s*\)/g,
    type: 'Memory',
    severity: 'high',
    description: 'Very large array allocation detected',
    impact: { usersAffected: 'All users', downtime: 'Potential crash', costEstimate: 'High infrastructure cost' },
    solution: 'Use streaming, pagination, or chunked processing',
  },
  
  // Security issues
  {
    pattern: /innerHTML\s*=.*\+|\$\{.*\}.*innerHTML|innerHTML.*\$\{/g,
    type: 'Security',
    severity: 'critical',
    description: 'XSS vulnerability - unsanitized content in innerHTML',
    impact: { usersAffected: 'All users', downtime: '0 min', costEstimate: 'Potential data breach' },
    solution: 'Use textContent, sanitize HTML, or use framework escaping',
  },
  {
    pattern: /\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)/gi,
    type: 'Security',
    severity: 'critical',
    description: 'SQL injection vulnerability - string interpolation in query',
    impact: { usersAffected: 'All users', downtime: '0 min', costEstimate: 'Potential data breach' },
    solution: 'Use parameterized queries or ORM with prepared statements',
  },
  {
    pattern: /eval\s*\(|new\s+Function\s*\(/g,
    type: 'Security',
    severity: 'critical',
    description: 'Dynamic code execution detected',
    impact: { usersAffected: 'All users', downtime: '0 min', costEstimate: 'Potential code injection' },
    solution: 'Remove eval/new Function, use safer alternatives',
  },
  {
    pattern: /password|secret|apikey|api_key|private_key/gi,
    type: 'Security',
    severity: 'high',
    description: 'Potential hardcoded secret or credential',
    impact: { usersAffected: 'All users', downtime: '0 min', costEstimate: 'Credential exposure risk' },
    solution: 'Use environment variables or secret management service',
  },
  
  // Scalability issues
  {
    pattern: /global\s*\.\s*\w+\s*=|window\s*\.\s*\w+\s*=/g,
    type: 'Scalability',
    severity: 'medium',
    description: 'Global state modification detected',
    impact: { usersAffected: 3000, downtime: '0 min', costEstimate: '$600/month' },
    solution: 'Use proper state management, avoid global mutations',
  },
  {
    pattern: /fs\.(read|write)FileSync/g,
    type: 'Scalability',
    severity: 'high',
    description: 'Synchronous file I/O blocks event loop',
    impact: { usersAffected: 'All concurrent users', downtime: 'Request blocking', costEstimate: '$1,500/month' },
    solution: 'Use async fs methods (fs.promises.readFile)',
  },
  
  // Reliability issues
  {
    pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g,
    type: 'Reliability',
    severity: 'high',
    description: 'Empty catch block silently swallowing errors',
    impact: { usersAffected: 2000, downtime: 'Debugging time', costEstimate: '$1,200/month in debug time' },
    solution: 'Log errors, re-throw, or handle appropriately',
  },
  {
    pattern: /\.then\([^)]+\)(?!\s*\.catch)/g,
    type: 'Reliability',
    severity: 'medium',
    description: 'Promise without error handling',
    impact: { usersAffected: 1500, downtime: 'Unhandled rejection crash', costEstimate: '$700/month' },
    solution: 'Add .catch() handler or use try/catch with async/await',
  },
];

class ProductionPredictorService {
  private excludedDirs = ['node_modules', '.git', 'dist', 'build', 'coverage', '__tests__', 'test'];
  private codeExtensions = ['.ts', '.tsx', '.js', '.jsx'];

  /**
   * Analyze a project for production readiness
   */
  async analyzeProject(directory: string): Promise<ProductionAnalysis> {
    const files = await this.getAllFiles(directory);
    const anomalies: ProductionAnomaly[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const relativePath = path.relative(directory, file);
        const fileAnomalies = this.analyzeFile(content, relativePath);
        anomalies.push(...fileAnomalies);
      } catch (error) {
        console.warn(`Failed to analyze ${file}:`, error);
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Calculate stats
    const stats = this.calculateStats(anomalies);
    
    // Determine readiness
    const { readiness, score } = this.calculateReadiness(anomalies, stats);

    return {
      readiness,
      score,
      anomalies: anomalies.slice(0, 20), // Top 20 issues
      stats,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Analyze content directly
   */
  analyzeContent(content: string, filename: string): ProductionAnomaly[] {
    return this.analyzeFile(content, filename);
  }

  /**
   * Analyze a single file
   */
  private analyzeFile(content: string, filePath: string): ProductionAnomaly[] {
    const anomalies: ProductionAnomaly[] = [];
    const lines = content.split('\n');

    for (const check of productionChecks) {
      check.pattern.lastIndex = 0;
      let match;

      while ((match = check.pattern.exec(content)) !== null) {
        // Find line number
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;

        anomalies.push({
          type: check.type,
          severity: check.severity,
          description: check.description,
          impact: {
            usersAffected: check.impact.usersAffected || 'Unknown',
            downtime: check.impact.downtime || '0 min',
            costEstimate: check.impact.costEstimate || 'Unknown',
          },
          location: `${filePath}:${lineNumber}`,
          solution: check.solution,
          evidence: [this.getCodeContext(lines, lineNumber)],
        });
      }
    }

    return anomalies;
  }

  /**
   * Get code context around a line
   */
  private getCodeContext(lines: string[], lineNumber: number): string {
    const start = Math.max(0, lineNumber - 2);
    const end = Math.min(lines.length, lineNumber + 1);
    return lines.slice(start, end).map((line, i) => 
      `${start + i + 1}: ${line}`
    ).join('\n');
  }

  /**
   * Calculate statistics
   */
  private calculateStats(anomalies: ProductionAnomaly[]): ProductionAnalysis['stats'] {
    const criticalIssues = anomalies.filter(a => a.severity === 'critical').length;
    const highIssues = anomalies.filter(a => a.severity === 'high').length;
    const mediumIssues = anomalies.filter(a => a.severity === 'medium').length;
    const lowIssues = anomalies.filter(a => a.severity === 'low').length;

    // Estimate users at risk
    let usersAtRisk = 0;
    for (const anomaly of anomalies) {
      if (typeof anomaly.impact.usersAffected === 'number') {
        usersAtRisk = Math.max(usersAtRisk, anomaly.impact.usersAffected);
      }
    }

    // Estimate cost impact
    let totalCost = 0;
    for (const anomaly of anomalies) {
      const costMatch = anomaly.impact.costEstimate.match(/\$[\d,]+/);
      if (costMatch) {
        totalCost += parseInt(costMatch[0].replace(/[$,]/g, '')) || 0;
      }
    }

    // Estimate downtime
    let maxDowntime = 0;
    for (const anomaly of anomalies) {
      const downtimeMatch = anomaly.impact.downtime.match(/(\d+)\s*min/);
      if (downtimeMatch) {
        maxDowntime = Math.max(maxDowntime, parseInt(downtimeMatch[1]));
      }
    }

    return {
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      estimatedUsersAtRisk: usersAtRisk,
      estimatedCostImpact: `$${totalCost.toLocaleString()}/month`,
      potentialDowntime: `${maxDowntime} min`,
    };
  }

  /**
   * Calculate production readiness
   */
  private calculateReadiness(
    anomalies: ProductionAnomaly[], 
    stats: ProductionAnalysis['stats']
  ): { readiness: ProductionAnalysis['readiness']; score: number } {
    let score = 100;

    // Deduct points for issues
    score -= stats.criticalIssues * 25;
    score -= stats.highIssues * 15;
    score -= stats.mediumIssues * 5;
    score -= stats.lowIssues * 2;

    score = Math.max(0, Math.min(100, score));

    let readiness: ProductionAnalysis['readiness'];
    if (stats.criticalIssues > 0 || score < 50) {
      readiness = 'dangerous';
    } else if (stats.highIssues > 2 || score < 75) {
      readiness = 'caution';
    } else {
      readiness = 'safe';
    }

    return { readiness, score };
  }

  /**
   * Get all code files in directory
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    const walk = async (directory: string) => {
      try {
        const entries = await fs.readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(directory, entry.name);

          if (entry.isDirectory()) {
            if (!this.excludedDirs.includes(entry.name) && !entry.name.startsWith('.')) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            if (this.codeExtensions.some(ext => entry.name.endsWith(ext))) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.warn(`Error reading ${directory}:`, error);
      }
    };

    await walk(dir);
    return files;
  }
}

export const productionPredictorService = new ProductionPredictorService();
