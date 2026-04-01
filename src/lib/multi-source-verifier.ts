/**
 * Multi-Source Verifier
 * 
 * Verifies code against multiple sources to prevent hallucinations
 * Unique: Cross-references codebase, patterns, and conventions
 */

import * as fs from 'fs';
import * as path from 'path';
import { codebaseKnowledgeBase } from './codebase-knowledge';
import { codePatternDNA } from './code-pattern-dna';
import { apiValidator } from './api-validator';
import { advancedContextManager } from './advanced-context-manager';

export interface VerificationSource {
  name: string;
  type: 'codebase' | 'pattern' | 'convention' | 'endpoint' | 'type';
  result: 'match' | 'mismatch' | 'unknown';
  confidence: number;
  evidence: string;
}

export interface VerificationResult {
  verified: boolean;
  confidence: number; // 0-1
  sources: VerificationSource[];
  issues: Array<{
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    suggestion: string;
  }>;
  recommendations: string[];
}

class MultiSourceVerifier {
  /**
   * Verify code against multiple sources
   */
  async verify(
    code: string,
    projectPath: string,
    context?: {
      file?: string;
      purpose?: string;
    }
  ): Promise<VerificationResult> {
    const sources: VerificationSource[] = [];
    const issues: VerificationResult['issues'] = [];

    // Get knowledge base
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!knowledge) {
      return {
        verified: false,
        confidence: 0,
        sources: [],
        issues: [{
          type: 'missing-knowledge',
          severity: 'critical',
          message: 'Knowledge base not found',
          suggestion: 'Run build-knowledge first',
        }],
        recommendations: ['Run build-knowledge to enable verification'],
      };
    }

    // Source 1: Pattern verification
    const patternVerification = await this.verifyPatterns(code, knowledge);
    sources.push(patternVerification);
    if (patternVerification.result === 'mismatch') {
      issues.push({
        type: 'pattern-mismatch',
        severity: 'high',
        message: 'Code does not match project patterns',
        suggestion: patternVerification.evidence,
      });
    }

    // Source 2: Convention verification
    const conventionVerification = await this.verifyConventions(code, knowledge);
    sources.push(conventionVerification);
    if (conventionVerification.result === 'mismatch') {
      issues.push({
        type: 'convention-mismatch',
        severity: 'medium',
        message: 'Code violates project conventions',
        suggestion: conventionVerification.evidence,
      });
    }

    // Source 3: Endpoint verification
    const endpointVerification = await this.verifyEndpoints(code, projectPath);
    sources.push(endpointVerification);
    if (endpointVerification.result === 'mismatch') {
      issues.push({
        type: 'endpoint-mismatch',
        severity: 'critical',
        message: 'Uses unregistered endpoints',
        suggestion: endpointVerification.evidence,
      });
    }

    // Source 4: Type verification
    const typeVerification = await this.verifyTypes(code, knowledge);
    sources.push(typeVerification);
    if (typeVerification.result === 'mismatch') {
      issues.push({
        type: 'type-mismatch',
        severity: 'high',
        message: 'Uses invalid types',
        suggestion: typeVerification.evidence,
      });
    }

    // Source 5: Structure verification
    const structureVerification = await this.verifyStructure(code, knowledge, context);
    sources.push(structureVerification);
    if (structureVerification.result === 'mismatch') {
      issues.push({
        type: 'structure-mismatch',
        severity: 'medium',
        message: 'Code structure does not match project',
        suggestion: structureVerification.evidence,
      });
    }

    // Calculate overall confidence
    const confidence = this.calculateConfidence(sources);
    const verified = confidence > 0.7 && issues.filter(i => i.severity === 'critical').length === 0;

    // Generate recommendations
    const recommendations = this.generateRecommendations(sources, issues);

    return {
      verified,
      confidence,
      sources,
      issues,
      recommendations,
    };
  }

  /**
   * Verify patterns
   */
  private async verifyPatterns(
    code: string,
    knowledge: KnowledgeBase
  ): Promise<VerificationSource> {
    const codeDNA = codePatternDNA.generateDNA(code);
    const projectPatterns = knowledge.patterns || [];

    let bestMatch = 0;
    let bestPattern = null;

    for (const pattern of projectPatterns) {
      if (pattern.examples && pattern.examples.length > 0) {
        const patternDNA = codePatternDNA.generateDNA(pattern.examples[0]);
        const similarity = this.computeSimilarity(codeDNA, patternDNA);
        
        if (similarity > bestMatch) {
          bestMatch = similarity;
          bestPattern = pattern;
        }
      }
    }

    if (bestMatch > 0.7) {
      return {
        name: 'Pattern Verification',
        type: 'pattern',
        result: 'match',
        confidence: bestMatch,
        evidence: `Matches pattern: ${bestPattern?.name || 'unknown'}`,
      };
    } else if (bestMatch > 0.4) {
      return {
        name: 'Pattern Verification',
        type: 'pattern',
        result: 'unknown',
        confidence: bestMatch,
        evidence: 'Partial pattern match',
      };
    } else {
      return {
        name: 'Pattern Verification',
        type: 'pattern',
        result: 'mismatch',
        confidence: 1 - bestMatch,
        evidence: 'Code does not match any project patterns. Review project patterns.',
      };
    }
  }

  /**
   * Verify conventions
   */
  private async verifyConventions(
    code: string,
    knowledge: KnowledgeBase
  ): Promise<VerificationSource> {
    const conventions = knowledge.architecture?.conventions || {};
    const violations: string[] = [];

    // Check naming conventions
    if (conventions.naming) {
      const naming = conventions.naming.files || 'camelCase';
      // Simplified check
      if (naming === 'camelCase' && /[A-Z]/.test(code) && !code.match(/^[a-z]/)) {
        violations.push('Naming convention violation');
      }
    }

    if (violations.length > 0) {
      return {
        name: 'Convention Verification',
        type: 'convention',
        result: 'mismatch',
        confidence: 0.8,
        evidence: violations.join(', '),
      };
    }

    return {
      name: 'Convention Verification',
      type: 'convention',
      result: 'match',
      confidence: 0.9,
      evidence: 'Follows project conventions',
    };
  }

  /**
   * Verify endpoints
   */
  private async verifyEndpoints(
    code: string,
    projectPath: string
  ): Promise<VerificationSource> {
    const apiCalls = this.extractAPICalls(code);
    const invalid: string[] = [];

    for (const call of apiCalls) {
      const isValid = await apiValidator.validateEndpoint(call.endpoint, call.method);
      if (!isValid) {
        invalid.push(`${call.method} ${call.endpoint}`);
      }
    }

    if (invalid.length > 0) {
      return {
        name: 'Endpoint Verification',
        type: 'endpoint',
        result: 'mismatch',
        confidence: 0.95,
        evidence: `Invalid endpoints: ${invalid.join(', ')}. Register with apiValidator.registerEndpoint()`,
      };
    }

    return {
      name: 'Endpoint Verification',
      type: 'endpoint',
      result: 'match',
      confidence: 1.0,
      evidence: 'All endpoints are registered',
    };
  }

  /**
   * Verify types
   */
  private async verifyTypes(
    code: string,
    knowledge: KnowledgeBase
  ): Promise<VerificationSource> {
    const types = this.extractTypes(code);
    // In production, check against knowledge base types
    return {
      name: 'Type Verification',
      type: 'type',
      result: 'unknown',
      confidence: 0.5,
      evidence: 'Type verification not fully implemented',
    };
  }

  /**
   * Verify structure
   */
  private async verifyStructure(
    code: string,
    knowledge: KnowledgeBase,
    context?: { file?: string }
  ): Promise<VerificationSource> {
    if (!context?.file) {
      return {
        name: 'Structure Verification',
        type: 'codebase',
        result: 'unknown',
        confidence: 0.5,
        evidence: 'No file context provided',
      };
    }

    // Check if file location matches structure
    const structure = knowledge.architecture.structure;
    const filePath = context.file;

    // Simplified check
    if (filePath.includes('/components/') && !code.includes('export')) {
      return {
        name: 'Structure Verification',
        type: 'codebase',
        result: 'mismatch',
        confidence: 0.7,
        evidence: 'Component files should export components',
      };
    }

    return {
      name: 'Structure Verification',
      type: 'codebase',
      result: 'match',
      confidence: 0.8,
      evidence: 'Structure matches project conventions',
    };
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(sources: VerificationSource[]): number {
    if (sources.length === 0) return 0;

    let totalConfidence = 0;
    let totalWeight = 0;

    for (const source of sources) {
      const weight = source.type === 'endpoint' ? 2 : // Endpoints are critical
                     source.type === 'pattern' ? 1.5 :
                     source.type === 'convention' ? 1 :
                     0.5;

      const confidence = source.result === 'match' ? source.confidence :
                        source.result === 'mismatch' ? 0 :
                        source.confidence * 0.5; // Unknown is half confidence

      totalConfidence += confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalConfidence / totalWeight : 0;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    sources: VerificationSource[],
    issues: VerificationResult['issues']
  ): string[] {
    const recommendations: string[] = [];

    const mismatches = sources.filter(s => s.result === 'mismatch');
    if (mismatches.length > 0) {
      recommendations.push(`⚠️ ${mismatches.length} verification mismatch(es) found`);
    }

    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push(`🔴 ${criticalIssues.length} critical issue(s) - review before using`);
    }

    const matches = sources.filter(s => s.result === 'match');
    if (matches.length === sources.length) {
      recommendations.push('✅ All verifications passed!');
    }

    return recommendations;
  }

  // Helper methods
  private extractAPICalls(code: string): Array<{ method: string; endpoint: string }> {
    const calls: Array<{ method: string; endpoint: string }> = [];
    const patterns = [
      { regex: /fetch\(['"]([^'"]+)['"]/g, method: 'GET' },
      { regex: /\.get\(['"]([^'"]+)['"]/g, method: 'GET' },
      { regex: /\.post\(['"]([^'"]+)['"]/g, method: 'POST' },
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(code)) !== null) {
        calls.push({ method: pattern.method, endpoint: match[1] });
      }
    }

    return calls;
  }

  private extractTypes(code: string): string[] {
    const types: string[] = [];
    const typeRegex = /:\s*([A-Z][a-zA-Z0-9<>[\]]+)/g;
    let match;
    while ((match = typeRegex.exec(code)) !== null) {
      types.push(match[1]);
    }
    return types;
  }

  private computeSimilarity(dna1: any, dna2: any): number {
    // Simplified - in production use proper similarity
    return 0.5;
  }
}

export const multiSourceVerifier = new MultiSourceVerifier();

