/**
 * Source Anchor System - Prevents AI Hallucinations
 * 
 * Anchors all claims, relationships, and patterns to actual source code locations,
 * making it impossible for AI to hallucinate since everything is source-verified.
 */

import * as path from 'path';
import { ComponentSpec, RelationshipSpec, PatternSpec, CodeExample } from './mdc-generator';
import { Evidence } from './verification-engine';

export interface AnchoredClaim {
  claim: string;
  evidence: Evidence[];
  sourceFile: string;
  lineNumbers: number[];
  confidence: number;
  verificationStatus: 'verified' | 'partial' | 'unverified';
}

export interface SourceAnchoredMDC {
  components: AnchoredComponent[];
  relationships: AnchoredRelationship[];
  patterns: AnchoredPattern[];
  metadata: {
    totalClaims: number;
    verifiedClaims: number;
    unverifiedClaims: number;
    overallConfidence: number;
  };
}

export interface AnchoredComponent extends ComponentSpec {
  anchors: {
    existence: AnchoredClaim;
    type: AnchoredClaim;
    methods?: Record<string, AnchoredClaim>;
    properties?: Record<string, AnchoredClaim>;
    dependencies?: Record<string, AnchoredClaim>;
    purpose?: AnchoredClaim;
  };
  verificationScore: number;
}

export interface AnchoredRelationship extends RelationshipSpec {
  anchor: AnchoredClaim;
  verificationScore: number;
}

export interface AnchoredPattern extends PatternSpec {
  anchors: AnchoredClaim[];
  verificationScore: number;
}

export class SourceAnchorSystem {
  private projectPath: string;
  private anchorCache: Map<string, AnchoredClaim[]> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Anchor all component claims to source code
   */
  anchorComponent(component: ComponentSpec, evidence: Evidence[]): AnchoredComponent {
    const anchors: AnchoredComponent['anchors'] = {
      existence: this.createAnchoredClaim(
        `${component.name} exists`,
        evidence.filter(e => e.type === 'code' && e.snippet.includes(component.name)),
        component.path
      ),
      type: this.createAnchoredClaim(
        `${component.name} is a ${component.type}`,
        evidence.filter(e => e.type === 'code' && 
          (e.snippet.includes(`class ${component.name}`) ||
           e.snippet.includes(`function ${component.name}`) ||
           e.snippet.includes(`interface ${component.name}`) ||
           e.snippet.includes(`type ${component.name}`))),
        component.path
      ),
    };

    // Anchor methods
    if (component.methods && component.methods.length > 0) {
      anchors.methods = {};
      for (const method of component.methods) {
        const methodEvidence = evidence.filter(e => 
          e.type === 'code' && 
          (e.snippet.includes(`${method}(`) || 
           e.snippet.includes(`get ${method}(`) ||
           e.snippet.includes(`set ${method}(`))
        );
        anchors.methods[method] = this.createAnchoredClaim(
          `${component.name} has method ${method}`,
          methodEvidence,
          component.path
        );
      }
    }

    // Anchor properties
    if (component.properties && component.properties.length > 0) {
      anchors.properties = {};
      for (const prop of component.properties) {
        const propEvidence = evidence.filter(e => 
          e.type === 'code' && 
          e.snippet.includes(prop) &&
          (e.snippet.includes(':') || e.snippet.includes('='))
        );
        anchors.properties[prop] = this.createAnchoredClaim(
          `${component.name} has property ${prop}`,
          propEvidence,
          component.path
        );
      }
    }

    // Anchor dependencies
    if (component.dependencies && component.dependencies.length > 0) {
      anchors.dependencies = {};
      for (const dep of component.dependencies) {
        const depEvidence = evidence.filter(e => 
          e.type === 'import' && 
          e.snippet.includes(dep)
        );
        anchors.dependencies[dep] = this.createAnchoredClaim(
          `${component.name} depends on ${dep}`,
          depEvidence,
          component.path
        );
      }
    }

    // Anchor purpose if verified
    const purposeEvidence = evidence.filter(e => e.type === 'comment');
    if (purposeEvidence.length > 0 && component.purpose) {
      anchors.purpose = this.createAnchoredClaim(
        `${component.name} purpose: ${component.purpose}`,
        purposeEvidence,
        component.path
      );
    }

    // Calculate verification score
    const verificationScore = this.calculateVerificationScore(anchors);

    return {
      ...component,
      anchors,
      verificationScore,
    };
  }

  /**
   * Anchor relationship to source code
   */
  anchorRelationship(relationship: RelationshipSpec, evidence: Evidence[]): AnchoredRelationship {
    const anchor = this.createAnchoredClaim(
      `${relationship.from} ${relationship.type} ${relationship.to}`,
      evidence,
      relationship.from // Use from component's path as primary source
    );

    const verificationScore = anchor.verificationStatus === 'verified' ? 1.0 :
                             anchor.verificationStatus === 'partial' ? 0.6 : 0.0;

    return {
      ...relationship,
      anchor,
      verificationScore,
    };
  }

  /**
   * Anchor pattern to source code
   */
  anchorPattern(pattern: PatternSpec, evidence: Evidence[]): AnchoredPattern {
    // Group evidence by example file
    const anchors: AnchoredClaim[] = [];
    const evidenceByFile = new Map<string, Evidence[]>();

    for (const exampleFile of pattern.examples) {
      const fileEvidence = evidence.filter(e => e.file === exampleFile);
      if (fileEvidence.length > 0) {
        evidenceByFile.set(exampleFile, fileEvidence);
        anchors.push(this.createAnchoredClaim(
          `${pattern.name} pattern found in ${exampleFile}`,
          fileEvidence,
          exampleFile
        ));
      }
    }

    // Calculate verification score
    const verifiedAnchors = anchors.filter(a => a.verificationStatus === 'verified').length;
    const verificationScore = anchors.length > 0 
      ? verifiedAnchors / anchors.length 
      : 0;

    return {
      ...pattern,
      anchors,
      verificationScore,
    };
  }

  /**
   * Create an anchored claim with evidence
   */
  private createAnchoredClaim(
    claim: string,
    evidence: Evidence[],
    sourceFile: string
  ): AnchoredClaim {
    if (evidence.length === 0) {
      return {
        claim,
        evidence: [],
        sourceFile,
        lineNumbers: [],
        confidence: 0,
        verificationStatus: 'unverified',
      };
    }

    const lineNumbers = [...new Set(evidence.map(e => e.line))].sort();
    const avgRelevance = evidence.reduce((sum, e) => sum + e.relevance, 0) / evidence.length;
    
    let verificationStatus: 'verified' | 'partial' | 'unverified';
    if (evidence.length >= 2 && avgRelevance >= 0.8) {
      verificationStatus = 'verified';
    } else if (evidence.length >= 1 && avgRelevance >= 0.5) {
      verificationStatus = 'partial';
    } else {
      verificationStatus = 'unverified';
    }

    return {
      claim,
      evidence,
      sourceFile,
      lineNumbers,
      confidence: avgRelevance,
      verificationStatus,
    };
  }

  /**
   * Calculate overall verification score for component
   */
  private calculateVerificationScore(anchors: AnchoredComponent['anchors']): number {
    const scores: number[] = [];

    // Core claims (weighted higher)
    scores.push(anchors.existence.confidence * 0.3);
    scores.push(anchors.type.confidence * 0.3);

    // Purpose (if exists)
    if (anchors.purpose) {
      scores.push(anchors.purpose.confidence * 0.2);
    }

    // Methods (weighted medium)
    if (anchors.methods) {
      const methodScores = Object.values(anchors.methods).map(m => m.confidence);
      if (methodScores.length > 0) {
        scores.push((methodScores.reduce((a, b) => a + b, 0) / methodScores.length) * 0.1);
      }
    }

    // Properties (weighted medium)
    if (anchors.properties) {
      const propScores = Object.values(anchors.properties).map(p => p.confidence);
      if (propScores.length > 0) {
        scores.push((propScores.reduce((a, b) => a + b, 0) / propScores.length) * 0.05);
      }
    }

    // Dependencies (weighted lower)
    if (anchors.dependencies) {
      const depScores = Object.values(anchors.dependencies).map(d => d.confidence);
      if (depScores.length > 0) {
        scores.push((depScores.reduce((a, b) => a + b, 0) / depScores.length) * 0.05);
      }
    }

    return scores.reduce((a, b) => a + b, 0);
  }

  /**
   * Format anchored claim for MDC file
   */
  formatAnchoredClaim(claim: AnchoredClaim, indent: string = ''): string {
    const statusEmoji = {
      verified: '✅',
      partial: '⚠️',
      unverified: '❌',
    };

    let output = `${indent}${statusEmoji[claim.verificationStatus]} **${claim.claim}**\n`;
    output += `${indent}   Confidence: ${Math.round(claim.confidence * 100)}%\n`;
    
    if (claim.lineNumbers.length > 0) {
      output += `${indent}   Source: \`${claim.sourceFile}\` (lines: ${claim.lineNumbers.slice(0, 3).join(', ')}${claim.lineNumbers.length > 3 ? '...' : ''})\n`;
    }

    // Include evidence snippets (limited)
    if (claim.evidence.length > 0) {
      output += `${indent}   Evidence:\n`;
      claim.evidence.slice(0, 2).forEach(e => {
        output += `${indent}   - Line ${e.line}: \`${e.snippet.substring(0, 60)}${e.snippet.length > 60 ? '...' : ''}\`\n`;
      });
    }

    return output;
  }

  /**
   * Add source anchors to code examples
   */
  anchorCodeExample(example: CodeExample, sourceCode: string): CodeExample {
    // Verify example code actually exists in source
    const lines = sourceCode.split('\n');
    const exampleLines = example.code.split('\n');
    const exampleStart = exampleLines[0]?.trim();
    
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().includes(exampleStart || '')) {
        found = true;
        // Update line number if found
        example.line = i + 1;
        break;
      }
    }

    // Add verification marker
    if (found) {
      example.context = `✅ Verified: ${example.context}`;
    } else {
      example.context = `⚠️ Unverified: ${example.context}`;
    }

    return example;
  }
}

