/**
 * Hallucination Detector - Identifies potential AI hallucination risks
 * 
 * Detects inconsistencies, missing evidence, and unverified claims that
 * could lead to AI hallucinations when reading MDC files.
 */

import { ComponentSpec, RelationshipSpec, PatternSpec, MDCSpecification } from './mdc-generator';
import { VerificationResult } from './verification-engine';
import { AnchoredComponent, AnchoredRelationship, AnchoredPattern } from './source-anchor';

export interface HallucinationRisk {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'missing-evidence' | 'contradiction' | 'unverified-claim' | 'incomplete-data' | 'confidence-mismatch';
  component: string;
  field: string;
  issue: string;
  recommendation: string;
  confidence: number;
}

export interface HallucinationReport {
  risks: HallucinationRisk[];
  riskScore: number; // 0-100, higher = more risk
  recommendations: string[];
  metadata: {
    totalComponents: number;
    verifiedComponents: number;
    unverifiedComponents: number;
    averageConfidence: number;
  };
}

export class HallucinationDetector {
  /**
   * Detect hallucination risks in MDC specification
   */
  detectRisks(
    spec: MDCSpecification,
    verifications: Map<string, VerificationResult>,
    anchoredComponents?: AnchoredComponent[],
    anchoredRelationships?: AnchoredRelationship[],
    anchoredPatterns?: AnchoredPattern[]
  ): HallucinationReport {
    const risks: HallucinationRisk[] = [];

    // Check each component
    for (const component of spec.components) {
      const verification = verifications.get(`${component.path}::${component.name}`);
      
      if (!verification) {
        risks.push({
          severity: 'critical',
          type: 'missing-evidence',
          component: component.name,
          field: 'verification',
          issue: `Component ${component.name} has not been verified against source code`,
          recommendation: 'Run verification before generating MDC to ensure accuracy',
          confidence: 0.9,
        });
        continue;
      }

      // Check verification confidence
      if (verification.confidence < 0.7) {
        risks.push({
          severity: verification.confidence < 0.5 ? 'high' : 'medium',
          type: 'confidence-mismatch',
          component: component.name,
          field: 'verification',
          issue: `Component ${component.name} has low verification confidence (${Math.round(verification.confidence * 100)}%)`,
          recommendation: 'Review source code to improve verification evidence',
          confidence: 1 - verification.confidence,
        });
      }

      // Check for missing evidence
      if (verification.evidence.length === 0) {
        risks.push({
          severity: 'critical',
          type: 'missing-evidence',
          component: component.name,
          field: 'evidence',
          issue: `No source code evidence found for ${component.name}`,
          recommendation: 'Verify component exists in source code and update extraction logic',
          confidence: 0.95,
        });
      }

      // Check for contradictions
      const contradiction = this.detectContradictions(component, verification);
      if (contradiction) {
        risks.push(contradiction);
      }

      // Check anchored claims if available
      if (anchoredComponents) {
        const anchored = anchoredComponents.find(c => c.name === component.name);
        if (anchored) {
          const anchorRisks = this.checkAnchoredClaims(anchored, component);
          risks.push(...anchorRisks);
        }
      }
    }

    // Check relationships
    if (anchoredRelationships) {
      for (const rel of anchoredRelationships) {
        if (rel.verificationScore < 0.7) {
          risks.push({
            severity: 'medium',
            type: 'unverified-claim',
            component: rel.from,
            field: 'relationship',
            issue: `Relationship ${rel.from} → ${rel.to} has low verification score (${Math.round(rel.verificationScore * 100)}%)`,
            recommendation: 'Verify relationship exists in source code',
            confidence: 1 - rel.verificationScore,
          });
        }
      }
    }

    // Check patterns
    if (anchoredPatterns) {
      for (const pattern of anchoredPatterns) {
        if (pattern.verificationScore < 0.6) {
          risks.push({
            severity: 'medium',
            type: 'incomplete-data',
            component: pattern.name,
            field: 'pattern',
            issue: `Pattern ${pattern.name} has low verification (${Math.round(pattern.verificationScore * 100)}%)`,
            recommendation: 'Verify pattern indicators exist in claimed example files',
            confidence: 1 - pattern.verificationScore,
          });
        }

        // Check frequency mismatch
        if (pattern.examples.length !== pattern.frequency) {
          risks.push({
            severity: 'low',
            type: 'confidence-mismatch',
            component: pattern.name,
            field: 'frequency',
            issue: `Pattern frequency (${pattern.frequency}) doesn't match example count (${pattern.examples.length})`,
            recommendation: 'Recalculate pattern frequency based on actual occurrences',
            confidence: 0.6,
          });
        }
      }
    }

    // Check for incomplete data
    const incompleteRisks = this.detectIncompleteData(spec);
    risks.push(...incompleteRisks);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(risks);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(risks, spec);

    // Calculate metadata
    const verifiedComponents = spec.components.filter(c => {
      const ver = verifications.get(`${c.path}::${c.name}`);
      return ver && ver.confidence >= 0.7;
    }).length;

    const avgConfidence = spec.components.length > 0
      ? spec.components.reduce((sum, c) => {
          const ver = verifications.get(`${c.path}::${c.name}`);
          return sum + (ver?.confidence || 0);
        }, 0) / spec.components.length
      : 0;

    return {
      risks,
      riskScore,
      recommendations,
      metadata: {
        totalComponents: spec.components.length,
        verifiedComponents,
        unverifiedComponents: spec.components.length - verifiedComponents,
        averageConfidence: avgConfidence,
      },
    };
  }

  /**
   * Detect contradictions in component specification
   */
  private detectContradictions(
    component: ComponentSpec,
    verification: VerificationResult
  ): HallucinationRisk | null {
    // Check type contradictions
    for (const issue of verification.issues) {
      if (issue.type === 'incorrect' && issue.field === 'type') {
        return {
          severity: 'critical',
          type: 'contradiction',
          component: component.name,
          field: 'type',
          issue: `Type mismatch: declared as ${issue.expected}, but source shows ${issue.actual}`,
          recommendation: 'Fix type declaration to match actual source code',
          confidence: 0.95,
        };
      }
    }

    // Check method contradictions
    if (component.methods) {
      const missingMethods = verification.issues.filter(
        i => i.severity === 'error' && i.field === 'method'
      );
      
      if (missingMethods.length > 0) {
        return {
          severity: 'high',
          type: 'contradiction',
          component: component.name,
          field: 'methods',
          issue: `Declared methods not found in source: ${missingMethods.map(m => m.expected).join(', ')}`,
          recommendation: 'Remove non-existent methods or verify method names',
          confidence: 0.85,
        };
      }
    }

    // Check property contradictions
    if (component.properties) {
      const missingProperties = verification.issues.filter(
        i => i.severity === 'error' && i.field === 'property'
      );
      
      if (missingProperties.length > 0) {
        return {
          severity: 'high',
          type: 'contradiction',
          component: component.name,
          field: 'properties',
          issue: `Declared properties not found in source: ${missingProperties.map(p => p.expected).join(', ')}`,
          recommendation: 'Remove non-existent properties or verify property names',
          confidence: 0.85,
        };
      }
    }

    return null;
  }

  /**
   * Check anchored claims for risks
   */
  private checkAnchoredClaims(
    anchored: AnchoredComponent,
    original: ComponentSpec
  ): HallucinationRisk[] {
    const risks: HallucinationRisk[] = [];

    // Check unverified claims
    const unverifiedClaims = [
      { claim: anchored.anchors.existence, field: 'existence' },
      { claim: anchored.anchors.type, field: 'type' },
      ...(anchored.anchors.purpose ? [{ claim: anchored.anchors.purpose, field: 'purpose' }] : []),
    ].filter(({ claim }) => claim.verificationStatus === 'unverified');

    for (const { claim, field } of unverifiedClaims) {
      risks.push({
        severity: 'critical',
        type: 'unverified-claim',
        component: original.name,
        field,
        issue: `Claim "${claim.claim}" is unverified (no source code evidence)`,
        recommendation: 'Verify claim against source code or remove from specification',
        confidence: 0.9,
      });
    }

    // Check partial claims with low confidence
    const partialClaims = [
      { claim: anchored.anchors.existence, field: 'existence' },
      { claim: anchored.anchors.type, field: 'type' },
    ].filter(({ claim }) => 
      claim.verificationStatus === 'partial' && claim.confidence < 0.6
    );

    for (const { claim, field } of partialClaims) {
      risks.push({
        severity: 'medium',
        type: 'missing-evidence',
        component: original.name,
        field,
        issue: `Claim "${claim.claim}" has limited evidence (confidence: ${Math.round(claim.confidence * 100)}%)`,
        recommendation: 'Gather more source code evidence to improve confidence',
        confidence: 1 - claim.confidence,
      });
    }

    return risks;
  }

  /**
   * Detect incomplete data in specification
   */
  private detectIncompleteData(spec: MDCSpecification): HallucinationRisk[] {
    const risks: HallucinationRisk[] = [];

    // Check for components without purpose
    const componentsWithoutPurpose = spec.components.filter(c => 
      !c.purpose || c.purpose === 'Component extracted from codebase'
    );

    if (componentsWithoutPurpose.length > 0) {
      risks.push({
        severity: 'low',
        type: 'incomplete-data',
        component: 'multiple',
        field: 'purpose',
        issue: `${componentsWithoutPurpose.length} components missing purpose/description`,
        recommendation: 'Add JSDoc comments or extract purpose from usage patterns',
        confidence: 0.7,
      });
    }

    // Check for missing relationships
    const componentsWithNoRelationships = spec.components.filter(c =>
      spec.relationships.filter(r => r.from === c.name || r.to === c.name).length === 0
    );

    if (componentsWithNoRelationships.length > spec.components.length * 0.3) {
      risks.push({
        severity: 'low',
        type: 'incomplete-data',
        component: 'multiple',
        field: 'relationships',
        issue: `${componentsWithNoRelationships.length} components have no documented relationships`,
        recommendation: 'Analyze imports and usage to discover relationships',
        confidence: 0.6,
      });
    }

    // Check for empty patterns
    if (spec.patterns.length === 0 && spec.components.length > 10) {
      risks.push({
        severity: 'low',
        type: 'incomplete-data',
        component: 'specification',
        field: 'patterns',
        issue: 'No architectural patterns detected in codebase',
        recommendation: 'Improve pattern detection or manually document patterns',
        confidence: 0.5,
      });
    }

    return risks;
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(risks: HallucinationRisk[]): number {
    if (risks.length === 0) return 0;

    const severityWeights = {
      critical: 1.0,
      high: 0.7,
      medium: 0.4,
      low: 0.2,
    };

    const weightedScore = risks.reduce((sum, risk) => {
      return sum + (severityWeights[risk.severity] * risk.confidence);
    }, 0);

    // Normalize to 0-100
    return Math.min(100, (weightedScore / risks.length) * 100);
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    risks: HallucinationRisk[],
    spec: MDCSpecification
  ): string[] {
    const recommendations: string[] = [];

    const criticalRisks = risks.filter(r => r.severity === 'critical');
    if (criticalRisks.length > 0) {
      recommendations.push(
        `🚨 CRITICAL: Fix ${criticalRisks.length} critical verification issues before using MDC files`
      );
    }

    const unverifiedCount = risks.filter(r => r.type === 'unverified-claim').length;
    if (unverifiedCount > 0) {
      recommendations.push(
        `⚠️ Verify ${unverifiedCount} unverified claims against source code`
      );
    }

    const contradictionCount = risks.filter(r => r.type === 'contradiction').length;
    if (contradictionCount > 0) {
      recommendations.push(
        `🔧 Fix ${contradictionCount} contradictions between specification and source code`
      );
    }

    if (spec.metadata.confidence < 0.8) {
      recommendations.push(
        `📊 Overall confidence is ${Math.round(spec.metadata.confidence * 100)}% - consider improving verification`
      );
    }

    // Specific recommendations
    const specificRecommendations = [...new Set(risks.map(r => r.recommendation))];
    recommendations.push(...specificRecommendations.slice(0, 5));

    return recommendations;
  }

  /**
   * Generate risk summary for MDC file
   */
  formatRiskSummary(report: HallucinationReport): string {
    let output = `\n## 🔍 Verification & Risk Assessment\n\n`;
    output += `**Overall Risk Score:** ${Math.round(report.riskScore)}/100\n`;
    output += `**Components Verified:** ${report.metadata.verifiedComponents}/${report.metadata.totalComponents} (${Math.round(report.metadata.verifiedComponents / report.metadata.totalComponents * 100)}%)\n`;
    output += `**Average Confidence:** ${Math.round(report.metadata.averageConfidence * 100)}%\n\n`;

    if (report.risks.length > 0) {
      output += `### ⚠️ Detected Risks (${report.risks.length})\n\n`;
      
      const bySeverity = {
        critical: report.risks.filter(r => r.severity === 'critical'),
        high: report.risks.filter(r => r.severity === 'high'),
        medium: report.risks.filter(r => r.severity === 'medium'),
        low: report.risks.filter(r => r.severity === 'low'),
      };

      for (const [severity, risks] of Object.entries(bySeverity)) {
        if (risks.length > 0) {
          const emoji = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : severity === 'medium' ? '⚡' : 'ℹ️';
          output += `#### ${emoji} ${severity.toUpperCase()} (${risks.length})\n\n`;
          
          risks.slice(0, 5).forEach(risk => {
            output += `- **${risk.component}** (${risk.field}): ${risk.issue}\n`;
            output += `  → ${risk.recommendation}\n`;
          });
          output += `\n`;
        }
      }
    } else {
      output += `✅ **No significant risks detected** - All claims are well-verified\n\n`;
    }

    if (report.recommendations.length > 0) {
      output += `### 💡 Recommendations\n\n`;
      report.recommendations.forEach(rec => {
        output += `- ${rec}\n`;
      });
      output += `\n`;
    }

    return output;
  }
}

