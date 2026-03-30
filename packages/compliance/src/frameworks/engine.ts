import { prisma } from '@guardrail/database';
import { SOC2_FRAMEWORK } from './soc2';
import { GDPR_FRAMEWORK } from './gdpr';
import { HIPAA_FRAMEWORK } from './hipaa';
import { PCI_FRAMEWORK } from './pci';

export interface ComplianceControl {
  id: string;
  title: string;
  description: string;
  category: string;
  requirements: string[];
  automatedChecks?: AutomatedCheck[];
  manualSteps?: string[];
}

export interface AutomatedCheck {
  id: string;
  description: string;
  check: (projectPath: string) => Promise<CheckResult>;
}

export interface CheckResult {
  passed: boolean;
  details: string;
  evidence?: any;
}

export interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  description: string;
  controls: ComplianceControl[];
}

export interface ControlAssessment {
  controlId: string;
  title: string;
  status: 'compliant' | 'partial' | 'non-compliant' | 'not-assessed';
  score: number; // 0-100
  findings: string[];
  evidence: any[];
  gaps: string[];
}

export interface ComplianceGap {
  controlId: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

export interface ComplianceEvidence {
  controlId: string;
  type: string;
  description: string;
  data: any;
  timestamp: Date;
}

export interface ComplianceAssessmentResult {
  projectId: string;
  frameworkId: string;
  summary: {
    totalControls: number;
    compliant: number;
    partial: number;
    nonCompliant: number;
    score: number; // 0-100
  };
  controls: ControlAssessment[];
  gaps: ComplianceGap[];
  evidence: ComplianceEvidence[];
}

export class ComplianceAutomationEngine {
  private frameworks: Map<string, ComplianceFramework>;

  constructor() {
    this.frameworks = new Map();
    this.loadFrameworks();
  }

  /**
   * Load all compliance frameworks
   */
  private loadFrameworks(): void {
    this.frameworks.set('soc2', SOC2_FRAMEWORK);
    this.frameworks.set('gdpr', GDPR_FRAMEWORK);
    this.frameworks.set('hipaa', HIPAA_FRAMEWORK);
    this.frameworks.set('pci', PCI_FRAMEWORK);
  }

  /**
   * Get available frameworks
   */
  getFrameworks(): ComplianceFramework[] {
    return Array.from(this.frameworks.values());
  }

  /**
   * Get specific framework
   */
  getFramework(frameworkId: string): ComplianceFramework | undefined {
    return this.frameworks.get(frameworkId);
  }

  /**
   * Run compliance assessment
   */
  async assess(projectPath: string, frameworkId: string, projectId: string): Promise<ComplianceAssessmentResult> {
    const framework = this.frameworks.get(frameworkId);

    if (!framework) {
      throw new Error(`Framework ${frameworkId} not found`);
    }

    const controlAssessments: ControlAssessment[] = [];
    const allGaps: ComplianceGap[] = [];
    const allEvidence: ComplianceEvidence[] = [];

    // Assess each control
    for (const control of framework.controls) {
      const assessment = await this.assessControl(projectPath, control);
      controlAssessments.push(assessment);

      // Generate evidence
      const evidence = await this.generateEvidence(projectPath, frameworkId, control.id);
      allEvidence.push(...evidence);

      // Identify gaps
      if (assessment.status === 'non-compliant' || assessment.status === 'partial') {
        allGaps.push(...assessment.gaps.map(gap => ({
          controlId: control.id,
          severity: this.determineGapSeverity(control.category),
          description: gap,
          recommendation: this.getRecommendation(control.id, gap)
        })));
      }
    }

    // Calculate summary
    const summary = {
      totalControls: controlAssessments.length,
      compliant: controlAssessments.filter(a => a.status === 'compliant').length,
      partial: controlAssessments.filter(a => a.status === 'partial').length,
      nonCompliant: controlAssessments.filter(a => a.status === 'non-compliant').length,
      score: this.calculateOverallScore(controlAssessments)
    };

    const result: ComplianceAssessmentResult = {
      projectId,
      frameworkId,
      summary,
      controls: controlAssessments,
      gaps: allGaps,
      evidence: allEvidence
    };

    // Save to database
    await prisma.complianceAssessment.create({
      data: {
        projectId,
        frameworkId,
        summary: summary as any,
        controls: controlAssessments as any,
        gaps: allGaps as any,
        evidence: allEvidence as any
      }
    });

    return result;
  }

  /**
   * Assess single control
   */
  private async assessControl(projectPath: string, control: ComplianceControl): Promise<ControlAssessment> {
    const findings: string[] = [];
    const evidence: any[] = [];
    const gaps: string[] = [];
    let passedChecks = 0;
    let totalChecks = control.automatedChecks?.length || 0;

    // Run automated checks
    if (control.automatedChecks) {
      for (const check of control.automatedChecks) {
        try {
          const result = await this.runCheck(projectPath, check);

          if (result.passed) {
            passedChecks++;
            findings.push(`✓ ${check.description}`);
          } else {
            findings.push(`✗ ${check.description}: ${result.details}`);
            gaps.push(result.details);
          }

          if (result.evidence) {
            evidence.push(result.evidence);
          }
        } catch (error) {
          findings.push(`✗ ${check.description}: Error running check`);
        }
      }
    }

    // Calculate score and status
    const score = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;
    let status: 'compliant' | 'partial' | 'non-compliant' | 'not-assessed';

    if (totalChecks === 0) {
      status = 'not-assessed';
    } else if (score === 100) {
      status = 'compliant';
    } else if (score >= 50) {
      status = 'partial';
    } else {
      status = 'non-compliant';
    }

    return {
      controlId: control.id,
      title: control.title,
      status,
      score,
      findings,
      evidence,
      gaps
    };
  }

  /**
   * Run automated check
   */
  private async runCheck(projectPath: string, check: AutomatedCheck): Promise<CheckResult> {
    return await check.check(projectPath);
  }

  /**
   * Generate evidence for control
   */
  async generateEvidence(projectPath: string, _frameworkId: string, _controlId: string): Promise<ComplianceEvidence[]> {
    const evidence: ComplianceEvidence[] = [];

    // Generate evidence based on control type
    // This is a simplified version - in production would collect actual artifacts

    evidence.push({
      controlId: _controlId,
      type: 'automated-scan',
      description: `Automated compliance scan for ${_controlId}`,
      data: {
        timestamp: new Date(),
        projectPath
      },
      timestamp: new Date()
    });

    return evidence;
  }

  /**
   * Calculate overall compliance score
   */
  private calculateOverallScore(assessments: ControlAssessment[]): number {
    if (assessments.length === 0) return 0;

    const totalScore = assessments.reduce((sum, a) => sum + a.score, 0);
    return Math.round(totalScore / assessments.length);
  }

  /**
   * Determine gap severity based on control category
   */
  private determineGapSeverity(category: string): 'high' | 'medium' | 'low' {
    const highSeverityCategories = ['access-control', 'data-protection', 'security'];
    const mediumSeverityCategories = ['logging', 'monitoring', 'change-management'];

    if (highSeverityCategories.includes(category)) {
      return 'high';
    } else if (mediumSeverityCategories.includes(category)) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get recommendation for gap
   */
  private getRecommendation(_controlId: string, gap: string): string {
    // In production, would have specific recommendations for each control
    return `Implement controls to address: ${gap}`;
  }
}

export const complianceAutomationEngine = new ComplianceAutomationEngine();
