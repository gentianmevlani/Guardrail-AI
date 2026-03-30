/**
 * guardrail Security Orchestrator
 * 
 * The unified security platform that orchestrates all scanners,
 * normalizes findings, and provides deploy/no-deploy verdicts.
 * 
 * This is the "pipeline brain" that beats traditional scanners.
 */

import * as fs from 'fs';
import * as path from 'path';

import { PolicyEngine, runPolicyCheck, DeployVerdict, PolicyConfig, DEFAULT_POLICY_CONFIG } from './policy-engine';
import { SemgrepIntegration, SemgrepResult, UnifiedFinding } from './semgrep-integration';
import { SupplyChainIntegration, SupplyChainReport } from './supply-chain-integration';
import { SecretScanner, SecretScanResult } from './secret-scanner';

// ============ Types ============

export interface OrchestratorConfig {
  // Project information
  projectPath: string;
  projectName?: string;
  repoUrl?: string;
  
  // Environment
  environment: 'development' | 'staging' | 'production';
  
  // What to scan
  enabledScanners: {
    policy: boolean;
    semgrep: boolean;
    supplyChain: boolean;
    secrets: boolean;
  };
  
  // Thresholds
  thresholds: {
    maxRiskScore: number;      // 0-100, fail if exceeded
    maxCriticalFindings: number;
    maxHighFindings: number;
  };
  
  // Output
  outputDir: string;
  generateReport: boolean;
  reportFormats: ('json' | 'markdown' | 'html' | 'sarif')[];
  
  // CI integration
  ciMode: boolean;
  failOnBlockers: boolean;
}

export interface SecurityScanResult {
  // Unified findings from all scanners
  findings: UnifiedFinding[];
  
  // Individual scanner results
  policy?: DeployVerdict;
  semgrep?: SemgrepResult;
  supplyChain?: SupplyChainReport;
  secrets?: SecretScanResult;
  
  // Aggregated metrics
  metrics: {
    totalFindings: number;
    findingsBySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      info: number;
    };
    findingsByCategory: Record<string, number>;
    findingsByTool: Record<string, number>;
    riskScore: number;
    scanDuration: number;
  };
  
  // Final verdict
  verdict: {
    allowed: boolean;
    reason: string;
    blockers: string[];
    warnings: string[];
    recommendations: string[];
  };
  
  // Metadata
  metadata: {
    projectPath: string;
    projectName: string;
    environment: string;
    timestamp: string;
    gitCommit?: string;
    gitBranch?: string;
    scanners: string[];
  };
}

export interface RiskGraph {
  nodes: RiskNode[];
  edges: RiskEdge[];
  hotspots: RiskHotspot[];
}

export interface RiskNode {
  id: string;
  type: 'file' | 'package' | 'secret' | 'vulnerability' | 'finding';
  name: string;
  riskScore: number;
  metadata: Record<string, any>;
}

export interface RiskEdge {
  source: string;
  target: string;
  relationship: 'contains' | 'depends-on' | 'affects' | 'exposes';
}

export interface RiskHotspot {
  file: string;
  riskScore: number;
  findings: number;
  vulnerabilities: number;
  secrets: number;
}

// ============ Default Configuration ============

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  projectPath: process.cwd(),
  environment: 'production',
  enabledScanners: {
    policy: true,
    semgrep: true,
    supplyChain: true,
    secrets: true
  },
  thresholds: {
    maxRiskScore: 50,
    maxCriticalFindings: 0,
    maxHighFindings: 5
  },
  outputDir: '.guardrail',
  generateReport: true,
  reportFormats: ['json', 'markdown'],
  ciMode: false,
  failOnBlockers: true
};

// ============ Security Orchestrator Class ============

export class SecurityOrchestrator {
  private config: OrchestratorConfig;
  private policyEngine: PolicyEngine;
  private semgrep: SemgrepIntegration;
  private supplyChain: SupplyChainIntegration;
  private secretScanner: SecretScanner;
  
  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    
    // Initialize scanners
    this.policyEngine = new PolicyEngine();
    this.semgrep = new SemgrepIntegration();
    this.supplyChain = new SupplyChainIntegration();
    this.secretScanner = new SecretScanner();
  }
  
  /**
   * Run full security scan
   */
  async scan(): Promise<SecurityScanResult> {
    const startTime = Date.now();
    const findings: UnifiedFinding[] = [];
    
    console.log('\n' + '═'.repeat(60));
    console.log('🛡️  guardrail SECURITY ORCHESTRATOR');
    console.log('═'.repeat(60));
    console.log(`\n📁 Project: ${this.config.projectPath}`);
    console.log(`🌍 Environment: ${this.config.environment}`);
    console.log(`📅 Time: ${new Date().toISOString()}\n`);
    
    // Ensure output directory exists
    const outputDir = path.join(this.config.projectPath, this.config.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Run enabled scanners
    let policyResult: DeployVerdict | undefined;
    let semgrepResult: SemgrepResult | undefined;
    let supplyChainResult: SupplyChainReport | undefined;
    let secretResult: SecretScanResult | undefined;
    
    // 1. Policy checks (fast, always first)
    if (this.config.enabledScanners.policy) {
      console.log('📋 Running policy checks...');
      policyResult = await this.policyEngine.evaluate({
        projectPath: this.config.projectPath,
        environment: this.config.environment
      });
      
      // Convert policy findings to unified format
      for (const result of policyResult.results) {
        if (result.verdict === 'fail' || result.verdict === 'warn') {
          for (const finding of result.findings) {
            findings.push({
              id: `policy-${result.ruleId}-${finding.file}-${finding.line || 0}`,
              tool: 'semgrep', // Using semgrep as placeholder type
              ruleId: result.ruleId,
              severity: result.verdict === 'fail' ? 'high' : 'medium',
              category: 'policy',
              message: finding.message,
              file: finding.file,
              line: finding.line || 0,
              column: finding.column || 0,
              endLine: finding.line || 0,
              endColumn: 0,
              snippet: finding.snippet || '',
              metadata: {}
            });
          }
        }
      }
    }
    
    // 2. Semgrep SAST analysis
    if (this.config.enabledScanners.semgrep) {
      console.log('\n🔍 Running SAST analysis (Semgrep)...');
      semgrepResult = await this.semgrep.scan(this.config.projectPath);
      
      const normalizedFindings = this.semgrep.normalizeFindings(semgrepResult.findings);
      findings.push(...normalizedFindings);
    }
    
    // 3. Supply chain analysis
    if (this.config.enabledScanners.supplyChain) {
      console.log('\n📦 Running supply chain analysis...');
      supplyChainResult = await this.supplyChain.generateReport(
        this.config.projectPath,
        this.config.repoUrl
      );
      
      // Convert vulnerabilities to unified findings
      for (const vuln of supplyChainResult.vulnerabilities) {
        findings.push({
          id: `vuln-${vuln.id}`,
          tool: 'semgrep',
          ruleId: vuln.id,
          severity: vuln.severity === 'critical' ? 'critical' : 
                   vuln.severity === 'high' ? 'high' :
                   vuln.severity === 'medium' ? 'medium' : 'low',
          category: 'vulnerability',
          message: `${vuln.package}@${vuln.version}: ${vuln.description}`,
          file: 'package.json',
          line: 0,
          column: 0,
          endLine: 0,
          endColumn: 0,
          snippet: '',
          fix: vuln.fixedVersion ? `Upgrade to ${vuln.fixedVersion}` : undefined,
          metadata: {
            cwe: vuln.cwe,
            references: vuln.references
          }
        });
      }
    }
    
    // 4. Secret scanning
    if (this.config.enabledScanners.secrets) {
      console.log('\n🔐 Running secret detection...');
      secretResult = await this.secretScanner.scan(this.config.projectPath);
      
      // Convert secrets to unified findings
      for (const secret of secretResult.secrets) {
        findings.push({
          id: secret.id,
          tool: 'semgrep',
          ruleId: `secret-${secret.type}`,
          severity: secret.verified ? 'critical' : 'high',
          category: 'secret',
          message: `${secret.type}: ${secret.metadata.detector} detected potential secret`,
          file: secret.file,
          line: secret.line,
          column: 0,
          endLine: secret.line,
          endColumn: 0,
          snippet: secret.value,
          metadata: {
            secretType: secret.type,
            verified: secret.verified
          } as any
        });
      }
    }
    
    // Calculate metrics
    const metrics = this.calculateMetrics(findings, Date.now() - startTime);
    
    // Generate verdict
    const verdict = this.generateVerdict(
      findings,
      metrics,
      policyResult,
      supplyChainResult,
      secretResult
    );
    
    // Build result
    const result: SecurityScanResult = {
      findings,
      policy: policyResult,
      semgrep: semgrepResult,
      supplyChain: supplyChainResult,
      secrets: secretResult,
      metrics,
      verdict,
      metadata: {
        projectPath: this.config.projectPath,
        projectName: this.config.projectName || path.basename(this.config.projectPath),
        environment: this.config.environment,
        timestamp: new Date().toISOString(),
        gitCommit: this.getGitCommit(),
        gitBranch: this.getGitBranch(),
        scanners: Object.entries(this.config.enabledScanners)
          .filter(([, enabled]) => enabled)
          .map(([name]) => name)
      }
    };
    
    // Generate reports
    if (this.config.generateReport) {
      await this.generateReports(result, outputDir);
    }
    
    // Print summary
    this.printSummary(result);
    
    return result;
  }
  
  /**
   * Calculate aggregated metrics
   */
  private calculateMetrics(
    findings: UnifiedFinding[],
    scanDuration: number
  ): SecurityScanResult['metrics'] {
    const findingsBySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };
    
    const findingsByCategory: Record<string, number> = {};
    const findingsByTool: Record<string, number> = {};
    
    for (const finding of findings) {
      findingsBySeverity[finding.severity]++;
      findingsByCategory[finding.category] = (findingsByCategory[finding.category] || 0) + 1;
      findingsByTool[finding.tool] = (findingsByTool[finding.tool] || 0) + 1;
    }
    
    // Calculate risk score
    const riskScore = Math.min(100,
      findingsBySeverity.critical * 25 +
      findingsBySeverity.high * 10 +
      findingsBySeverity.medium * 3 +
      findingsBySeverity.low * 1
    );
    
    return {
      totalFindings: findings.length,
      findingsBySeverity,
      findingsByCategory,
      findingsByTool,
      riskScore,
      scanDuration
    };
  }
  
  /**
   * Generate final verdict
   */
  private generateVerdict(
    findings: UnifiedFinding[],
    metrics: SecurityScanResult['metrics'],
    policyResult?: DeployVerdict,
    supplyChainResult?: SupplyChainReport,
    secretResult?: SecretScanResult
  ): SecurityScanResult['verdict'] {
    const blockers: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Check thresholds
    if (metrics.riskScore > this.config.thresholds.maxRiskScore) {
      blockers.push(`Risk score ${metrics.riskScore} exceeds threshold ${this.config.thresholds.maxRiskScore}`);
    }
    
    if (metrics.findingsBySeverity.critical > this.config.thresholds.maxCriticalFindings) {
      blockers.push(`${metrics.findingsBySeverity.critical} critical findings exceed threshold ${this.config.thresholds.maxCriticalFindings}`);
    }
    
    if (metrics.findingsBySeverity.high > this.config.thresholds.maxHighFindings) {
      warnings.push(`${metrics.findingsBySeverity.high} high findings exceed threshold ${this.config.thresholds.maxHighFindings}`);
    }
    
    // Check policy results
    if (policyResult && !policyResult.allowed) {
      blockers.push(...policyResult.blockers.map(b => b.message));
    }
    
    // Check supply chain
    if (supplyChainResult && !supplyChainResult.verdict.allowed) {
      blockers.push(...supplyChainResult.verdict.blockers);
      warnings.push(...supplyChainResult.verdict.warnings);
    }
    
    // Check secrets
    if (secretResult && secretResult.riskAssessment.activeSecrets.length > 0) {
      blockers.push(`${secretResult.riskAssessment.activeSecrets.length} verified secrets detected`);
    }
    
    if (secretResult && secretResult.riskAssessment.clientSideExposure.length > 0) {
      blockers.push(`${secretResult.riskAssessment.clientSideExposure.length} secrets exposed in client-side code`);
    }
    
    // Generate recommendations
    if (metrics.findingsBySeverity.critical > 0) {
      recommendations.push('Address all critical findings before deployment');
    }
    
    if (secretResult && secretResult.rotationPlaybook.length > 0) {
      recommendations.push('Review and execute secret rotation playbook');
    }
    
    if (supplyChainResult && supplyChainResult.summary.vulnerabilityCounts.critical > 0) {
      recommendations.push('Update dependencies with critical vulnerabilities');
    }
    
    const allowed = blockers.length === 0;
    const reason = allowed
      ? 'All security checks passed'
      : `${blockers.length} blocking issue(s) detected`;
    
    return { allowed, reason, blockers, warnings, recommendations };
  }
  
  /**
   * Generate reports in various formats
   */
  private async generateReports(result: SecurityScanResult, outputDir: string): Promise<void> {
    for (const format of this.config.reportFormats) {
      const filename = `security-report.${format}`;
      const filepath = path.join(outputDir, filename);
      
      switch (format) {
        case 'json':
          fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
          break;
        case 'markdown':
          fs.writeFileSync(filepath, this.generateMarkdownReport(result));
          break;
        case 'sarif':
          fs.writeFileSync(filepath, JSON.stringify(this.generateSarifReport(result), null, 2));
          break;
        case 'html':
          fs.writeFileSync(filepath, this.generateHtmlReport(result));
          break;
      }
      
      console.log(`📄 Generated: ${filepath}`);
    }
  }
  
  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(result: SecurityScanResult): string {
    let md = `# guardrail Security Report\n\n`;
    md += `**Project:** ${result.metadata.projectName}\n`;
    md += `**Environment:** ${result.metadata.environment}\n`;
    md += `**Timestamp:** ${result.metadata.timestamp}\n`;
    md += `**Git:** ${result.metadata.gitBranch || 'unknown'}@${result.metadata.gitCommit?.substring(0, 7) || 'unknown'}\n\n`;
    
    // Verdict
    md += `## Verdict\n\n`;
    md += result.verdict.allowed 
      ? `✅ **DEPLOY ALLOWED**\n\n` 
      : `🛑 **DEPLOY BLOCKED**\n\n`;
    md += `**Risk Score:** ${result.metrics.riskScore}/100\n\n`;
    
    if (result.verdict.blockers.length > 0) {
      md += `### Blockers\n\n`;
      for (const blocker of result.verdict.blockers) {
        md += `- ❌ ${blocker}\n`;
      }
      md += '\n';
    }
    
    if (result.verdict.warnings.length > 0) {
      md += `### Warnings\n\n`;
      for (const warning of result.verdict.warnings) {
        md += `- ⚠️ ${warning}\n`;
      }
      md += '\n';
    }
    
    // Summary
    md += `## Summary\n\n`;
    md += `| Severity | Count |\n`;
    md += `|----------|-------|\n`;
    md += `| Critical | ${result.metrics.findingsBySeverity.critical} |\n`;
    md += `| High | ${result.metrics.findingsBySeverity.high} |\n`;
    md += `| Medium | ${result.metrics.findingsBySeverity.medium} |\n`;
    md += `| Low | ${result.metrics.findingsBySeverity.low} |\n`;
    md += `| **Total** | **${result.metrics.totalFindings}** |\n\n`;
    
    // Findings by category
    md += `## Findings by Category\n\n`;
    for (const [category, count] of Object.entries(result.metrics.findingsByCategory)) {
      md += `- **${category}:** ${count}\n`;
    }
    md += '\n';
    
    // Top findings
    if (result.findings.length > 0) {
      md += `## Top Findings\n\n`;
      const criticalAndHigh = result.findings
        .filter(f => f.severity === 'critical' || f.severity === 'high')
        .slice(0, 20);
      
      for (const finding of criticalAndHigh) {
        md += `### ${finding.ruleId}\n\n`;
        md += `- **Severity:** ${finding.severity.toUpperCase()}\n`;
        md += `- **File:** ${finding.file}:${finding.line}\n`;
        md += `- **Message:** ${finding.message}\n`;
        if (finding.fix) {
          md += `- **Fix:** ${finding.fix}\n`;
        }
        md += '\n';
      }
    }
    
    // Recommendations
    if (result.verdict.recommendations.length > 0) {
      md += `## Recommendations\n\n`;
      for (const rec of result.verdict.recommendations) {
        md += `1. ${rec}\n`;
      }
    }
    
    return md;
  }
  
  /**
   * Generate SARIF report (for GitHub Code Scanning)
   */
  private generateSarifReport(result: SecurityScanResult): any {
    return {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [{
        tool: {
          driver: {
            name: 'guardrail',
            version: '1.0.0',
            informationUri: 'https://guardrail.dev',
            rules: [...new Set(result.findings.map(f => f.ruleId))].map(ruleId => ({
              id: ruleId,
              name: ruleId,
              shortDescription: { text: ruleId }
            }))
          }
        },
        results: result.findings.map(f => ({
          ruleId: f.ruleId,
          level: f.severity === 'critical' || f.severity === 'high' ? 'error' : 
                 f.severity === 'medium' ? 'warning' : 'note',
          message: { text: f.message },
          locations: [{
            physicalLocation: {
              artifactLocation: { uri: f.file },
              region: {
                startLine: f.line,
                startColumn: f.column,
                endLine: f.endLine,
                endColumn: f.endColumn
              }
            }
          }]
        }))
      }]
    };
  }
  
  /**
   * Generate HTML report
   */
  private generateHtmlReport(result: SecurityScanResult): string {
    const severityColors = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#ca8a04',
      low: '#65a30d',
      info: '#0284c7'
    };
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>guardrail Security Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; padding: 2rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    h2 { font-size: 1.5rem; margin: 2rem 0 1rem; border-bottom: 1px solid #333; padding-bottom: 0.5rem; }
    .verdict { padding: 1.5rem; border-radius: 8px; margin: 1rem 0; }
    .verdict.pass { background: #14532d; border: 1px solid #22c55e; }
    .verdict.fail { background: #450a0a; border: 1px solid #dc2626; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .stat { background: #1a1a1a; padding: 1rem; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 2rem; font-weight: bold; }
    .finding { background: #1a1a1a; padding: 1rem; border-radius: 8px; margin: 0.5rem 0; border-left: 4px solid; }
    .severity-critical { border-color: ${severityColors.critical}; }
    .severity-high { border-color: ${severityColors.high}; }
    .severity-medium { border-color: ${severityColors.medium}; }
    .severity-low { border-color: ${severityColors.low}; }
    .badge { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🛡️ guardrail Security Report</h1>
    <p><strong>Project:</strong> ${result.metadata.projectName} | <strong>Environment:</strong> ${result.metadata.environment}</p>
    
    <div class="verdict ${result.verdict.allowed ? 'pass' : 'fail'}">
      <h2 style="margin:0;border:0;">${result.verdict.allowed ? '✅ DEPLOY ALLOWED' : '🛑 DEPLOY BLOCKED'}</h2>
      <p style="margin-top:0.5rem;">${result.verdict.reason}</p>
    </div>
    
    <div class="stats">
      <div class="stat"><div class="stat-value">${result.metrics.riskScore}</div><div>Risk Score</div></div>
      <div class="stat"><div class="stat-value" style="color:${severityColors.critical}">${result.metrics.findingsBySeverity.critical}</div><div>Critical</div></div>
      <div class="stat"><div class="stat-value" style="color:${severityColors.high}">${result.metrics.findingsBySeverity.high}</div><div>High</div></div>
      <div class="stat"><div class="stat-value" style="color:${severityColors.medium}">${result.metrics.findingsBySeverity.medium}</div><div>Medium</div></div>
      <div class="stat"><div class="stat-value">${result.metrics.totalFindings}</div><div>Total</div></div>
    </div>
    
    <h2>Findings</h2>
    ${result.findings.slice(0, 50).map(f => `
      <div class="finding severity-${f.severity}">
        <strong>${f.ruleId}</strong> <span class="badge" style="background:${severityColors[f.severity]}">${f.severity.toUpperCase()}</span>
        <p style="margin:0.5rem 0">${f.message}</p>
        <code style="color:#888">${f.file}:${f.line}</code>
      </div>
    `).join('')}
    
    <p style="margin-top:2rem;color:#666;text-align:center;">Generated by guardrail • ${result.metadata.timestamp}</p>
  </div>
</body>
</html>`;
  }
  
  /**
   * Print summary to console
   */
  private printSummary(result: SecurityScanResult): void {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 SECURITY SCAN SUMMARY');
    console.log('═'.repeat(60));
    
    // Verdict
    if (result.verdict.allowed) {
      console.log('\n✅ DEPLOY ALLOWED');
    } else {
      console.log('\n🛑 DEPLOY BLOCKED');
    }
    
    console.log(`\n📈 Risk Score: ${result.metrics.riskScore}/100`);
    console.log(`⏱️  Scan Duration: ${(result.metrics.scanDuration / 1000).toFixed(2)}s`);
    
    // Severity breakdown
    console.log('\n📋 Findings by Severity:');
    console.log(`   Critical: ${result.metrics.findingsBySeverity.critical}`);
    console.log(`   High:     ${result.metrics.findingsBySeverity.high}`);
    console.log(`   Medium:   ${result.metrics.findingsBySeverity.medium}`);
    console.log(`   Low:      ${result.metrics.findingsBySeverity.low}`);
    console.log(`   Total:    ${result.metrics.totalFindings}`);
    
    // Blockers
    if (result.verdict.blockers.length > 0) {
      console.log('\n❌ Blockers:');
      for (const blocker of result.verdict.blockers) {
        console.log(`   - ${blocker}`);
      }
    }
    
    // Warnings
    if (result.verdict.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      for (const warning of result.verdict.warnings) {
        console.log(`   - ${warning}`);
      }
    }
    
    // Recommendations
    if (result.verdict.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const rec of result.verdict.recommendations) {
        console.log(`   - ${rec}`);
      }
    }
    
    console.log('\n' + '═'.repeat(60) + '\n');
  }
  
  /**
   * Build risk graph
   */
  buildRiskGraph(result: SecurityScanResult): RiskGraph {
    const nodes: RiskNode[] = [];
    const edges: RiskEdge[] = [];
    const fileRisks = new Map<string, { score: number; findings: number; vulns: number; secrets: number }>();
    
    // Build file risk map
    for (const finding of result.findings) {
      const existing = fileRisks.get(finding.file) || { score: 0, findings: 0, vulns: 0, secrets: 0 };
      existing.findings++;
      existing.score += finding.severity === 'critical' ? 25 : 
                       finding.severity === 'high' ? 10 :
                       finding.severity === 'medium' ? 3 : 1;
      
      if (finding.category === 'vulnerability') existing.vulns++;
      if (finding.category === 'secret') existing.secrets++;
      
      fileRisks.set(finding.file, existing);
    }
    
    // Create file nodes
    for (const [file, risk] of fileRisks) {
      nodes.push({
        id: `file-${file}`,
        type: 'file',
        name: file,
        riskScore: Math.min(100, risk.score),
        metadata: { findings: risk.findings, vulnerabilities: risk.vulns, secrets: risk.secrets }
      });
    }
    
    // Create finding nodes and edges
    for (const finding of result.findings) {
      nodes.push({
        id: finding.id,
        type: 'finding',
        name: finding.ruleId,
        riskScore: finding.severity === 'critical' ? 100 : 
                  finding.severity === 'high' ? 75 :
                  finding.severity === 'medium' ? 50 : 25,
        metadata: { severity: finding.severity, category: finding.category }
      });
      
      edges.push({
        source: `file-${finding.file}`,
        target: finding.id,
        relationship: 'contains'
      });
    }
    
    // Identify hotspots
    const hotspots: RiskHotspot[] = Array.from(fileRisks.entries())
      .map(([file, risk]) => ({
        file,
        riskScore: Math.min(100, risk.score),
        findings: risk.findings,
        vulnerabilities: risk.vulns,
        secrets: risk.secrets
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);
    
    return { nodes, edges, hotspots };
  }
  
  // ============ Helper Methods ============
  
  private getGitCommit(): string | undefined {
    try {
      return execSync('git rev-parse HEAD', { 
        cwd: this.config.projectPath, 
        encoding: 'utf-8' 
      }).trim();
    } catch {
      return undefined;
    }
  }
  
  private getGitBranch(): string | undefined {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { 
        cwd: this.config.projectPath, 
        encoding: 'utf-8' 
      }).trim();
    } catch {
      return undefined;
    }
  }
}

// ============ CLI Entry Point ============

export async function runOrchestrator(
  projectPath: string = process.cwd(),
  options: Partial<OrchestratorConfig> = {}
): Promise<SecurityScanResult> {
  const orchestrator = new SecurityOrchestrator({
    projectPath,
    ...options
  });
  
  const result = await orchestrator.scan();
  
  // Exit with error code in CI mode if blockers found
  if (options.ciMode && options.failOnBlockers && !result.verdict.allowed) {
    process.exit(1);
  }
  
  return result;
}

// Re-export components
export { PolicyEngine, SemgrepIntegration, SupplyChainIntegration, SecretScanner };
export * from './policy-engine';
export * from './semgrep-integration';
export * from './supply-chain-integration';
export * from './secret-scanner';

function execSync(command: string, options?: any): string {
  const { execSync: exec } = require('child_process');
  return exec(command, options);
}
