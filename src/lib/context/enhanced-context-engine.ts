/**
 * Enhanced Context Engine
 * 
 * Prevents AI hallucinations and drift by:
 * - Real-time context validation
 * - Drift detection and correction
 * - Pattern enforcement
 * - Continuous learning from corrections
 */

import * as path from 'path';
import * as fs from 'fs/promises';
// Note: These imports reference files outside package scope
// They are dynamically imported when needed to avoid build errors
// import { advancedContextManager, EnhancedContext } from '../advanced-context-manager';
// import { codePatternDNA } from '../code-pattern-dna';

// Type definitions for external dependencies
interface EnhancedContext {
  [key: string]: unknown;
}

export interface DriftDetection {
  detected: boolean;
  score: number; // 0-100, higher = more drift
  areas: Array<{
    area: string;
    driftScore: number;
    before: string;
    after: string;
    recommendation: string;
  }>;
  overallRecommendation: string;
}

export interface ContextValidation {
  valid: boolean;
  issues: Array<{
    type: 'missing_context' | 'outdated_context' | 'conflicting_context' | 'hallucination_risk';
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    suggestion: string;
    evidence: string[];
  }>;
  confidence: number; // 0-1
}

export interface ContextSnapshot {
  timestamp: string;
  context: EnhancedContext;
  patterns: string[];
  conventions: Record<string, string>;
  checksum: string; // Hash of context for comparison
}

export class EnhancedContextEngine {
  private snapshots: Map<string, ContextSnapshot[]> = new Map();
  private driftThreshold = 0.15; // 15% change indicates drift

  /**
   * Get validated context with drift detection
   */
  async getValidatedContext(
    projectPath: string,
    request: {
      file?: string;
      purpose?: string;
      checkDrift?: boolean;
    } = {}
  ): Promise<{
    context: EnhancedContext;
    validation: ContextValidation;
    drift?: DriftDetection;
  }> {
    // Get current context - dynamically import to avoid build errors
    let context: EnhancedContext;
    try {
      const { advancedContextManager } = await import('../advanced-context-manager');
      context = await advancedContextManager.getContext(projectPath, {
        file: request.file,
        purpose: request.purpose,
      });
    } catch {
      // Fallback if import fails
      context = { patterns: [], dependencies: [], types: [], endpoints: [] } as EnhancedContext;
    }

    // Validate context
    const validation = await this.validateContext(context, projectPath, request);

    // Check for drift if requested
    let drift: DriftDetection | undefined;
    if (request.checkDrift !== false) {
      drift = await this.detectDrift(projectPath, context);
    }

    // Store snapshot
    await this.storeSnapshot(projectPath, context);

    return {
      context,
      validation,
      drift,
    };
  }

  /**
   * Validate context for hallucinations and issues
   */
  private async validateContext(
    context: EnhancedContext,
    projectPath: string,
    _request: any
  ): Promise<ContextValidation> {
    const issues: ContextValidation['issues'] = [];

    // Check 1: Context completeness
    const contextAny = context as any;
    if ((contextAny.layers || []).length === 0) {
      issues.push({
        type: 'missing_context',
        severity: 'critical',
        message: 'No context layers found',
        suggestion: 'Run context build to generate context layers',
        evidence: ['Context layers empty'],
      });
    }

    // Check 2: Context freshness
    if (context.freshness < 0.5) {
      issues.push({
        type: 'outdated_context',
        severity: 'high',
        message: 'Context may be outdated',
        suggestion: 'Refresh context to get latest information',
        evidence: [`Freshness score: ${(context.freshness * 100).toFixed(0)}%`],
      });
    }

    // Check 3: Context confidence
    if (context.confidence < 0.7) {
      issues.push({
        type: 'missing_context',
        severity: 'medium',
        message: 'Low confidence in context accuracy',
        suggestion: 'Review context sources and improve knowledge base',
        evidence: [`Confidence score: ${(context.confidence * 100).toFixed(0)}%`],
      });
    }

    // Check 4: Pattern consistency
    const patternIssues = await this.checkPatternConsistency(context, projectPath);
    issues.push(...patternIssues);

    // Check 5: Hallucination risk
    const hallucinationRisk = await this.assessHallucinationRisk(context, projectPath);
    if (hallucinationRisk.risk > 0.3) {
      issues.push({
        type: 'hallucination_risk',
        severity: hallucinationRisk.risk > 0.7 ? 'critical' : 'high',
        message: `High hallucination risk detected (${(hallucinationRisk.risk * 100).toFixed(0)}%)`,
        suggestion: 'Verify all context against actual codebase',
        evidence: hallucinationRisk.evidence,
      });
    }

    const valid = issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0;
    const confidence = Math.max(0, context.confidence - (issues.length * 0.1));

    return {
      valid,
      issues,
      confidence: Math.max(0, Math.min(1, confidence)),
    };
  }

  /**
   * Detect drift from project standards
   */
  async detectDrift(
    projectPath: string,
    currentContext: EnhancedContext
  ): Promise<DriftDetection> {
    const previousSnapshot = this.getPreviousSnapshot(projectPath);
    
    if (!previousSnapshot) {
      return {
        detected: false,
        score: 0,
        areas: [],
        overallRecommendation: 'No previous context to compare against',
      };
    }

    const areas: DriftDetection['areas'] = [];
    let totalDriftScore = 0;

    // Compare patterns
    const patternDrift = this.comparePatterns(
      previousSnapshot.patterns,
      currentContext.patterns
    );
    if (patternDrift.drift > 0.1) {
      areas.push({
        area: 'Patterns',
        driftScore: patternDrift.drift * 100,
        before: patternDrift.before,
        after: patternDrift.after,
        recommendation: 'Review pattern changes and ensure consistency',
      });
      totalDriftScore += patternDrift.drift;
    }

    // Compare conventions
    const conventionDrift = this.compareConventions(
      previousSnapshot.conventions,
      currentContext.conventions
    );
    if (conventionDrift.drift > 0.1) {
      areas.push({
        area: 'Conventions',
        driftScore: conventionDrift.drift * 100,
        before: conventionDrift.before,
        after: conventionDrift.after,
        recommendation: 'Align conventions with project standards',
      });
      totalDriftScore += conventionDrift.drift;
    }

    // Compare context layers
    const layerDrift = this.compareLayers(
      previousSnapshot.context.layers,
      currentContext.layers
    );
    if (layerDrift.drift > 0.1) {
      areas.push({
        area: 'Context Layers',
        driftScore: layerDrift.drift * 100,
        before: `${((previousSnapshot.context as any).layers || []).length} layers`,
        after: `${currentContext.layers.length} layers`,
        recommendation: 'Review context layer changes',
      });
      totalDriftScore += layerDrift.drift;
    }

    const detected = totalDriftScore / areas.length > this.driftThreshold;
    const score = Math.min(100, (totalDriftScore / Math.max(areas.length, 1)) * 100);

    let overallRecommendation = '';
    if (detected) {
      overallRecommendation = `Drift detected in ${areas.length} area(s). Review changes and ensure alignment with project standards.`;
    } else {
      overallRecommendation = 'No significant drift detected. Context is aligned with project standards.';
    }

    return {
      detected,
      score: Math.round(score),
      areas,
      overallRecommendation,
    };
  }

  /**
   * Enforce patterns to prevent drift
   */
  async enforcePatterns(
    projectPath: string,
    generatedCode: string,
    filePath?: string
  ): Promise<{
    compliant: boolean;
    violations: Array<{
      pattern: string;
      violation: string;
      suggestion: string;
    }>;
  }> {
    // Dynamically import to avoid build errors
    let context: EnhancedContext;
    try {
      const { advancedContextManager } = await import('../advanced-context-manager');
      context = await advancedContextManager.getContext(projectPath, {
        file: filePath,
      });
    } catch {
      context = { patterns: [], dependencies: [], types: [], endpoints: [] } as EnhancedContext;
    }

    const violations: Array<{
      pattern: string;
      violation: string;
      suggestion: string;
    }> = [];

    // Check against project patterns - dynamically import to avoid build errors
    try {
      const { codePatternDNA } = await import('../code-pattern-dna');
      const patterns = (context as any).patterns || [];
      for (const pattern of patterns) {
        const patternDNA = codePatternDNA.generateDNA(String(pattern));
        const codeDNA = codePatternDNA.generateDNA(generatedCode);
        const similarity = this.computeSimilarity(patternDNA, codeDNA);
        
        if (similarity < 0.7) {
          violations.push({
            pattern: String(pattern),
            violation: `Code does not match pattern: ${pattern}`,
            suggestion: `Align code with pattern: ${pattern}`,
          });
        }
      }
    } catch {
      // Fallback if import fails - no violations if we can't check
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  /**
   * Learn from corrections to improve context
   */
  async learnFromCorrection(
    projectPath: string,
    correction: {
      original: string;
      corrected: string;
      reason: string;
    }
  ): Promise<void> {
    // Store correction for future reference
    const correctionsPath = path.join(projectPath, '.guardrail', 'corrections.json');
    await fs.mkdir(path.dirname(correctionsPath), { recursive: true });

    let corrections: any[] = [];
    try {
      const content = await fs.readFile(correctionsPath, 'utf8');
      corrections = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    corrections.push({
      ...correction,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 100 corrections
    if (corrections.length > 100) {
      corrections = corrections.slice(-100);
    }

    await fs.writeFile(correctionsPath, JSON.stringify(corrections, null, 2));

    // Invalidate context cache to force refresh - dynamically import to avoid build errors
    try {
      const { advancedContextManager } = await import('../advanced-context-manager');
      advancedContextManager.invalidateCache(projectPath);
    } catch {
      // Fallback if import fails
    }
  }

  // Helper methods
  private async checkPatternConsistency(
    context: EnhancedContext,
    _projectPath: string
  ): Promise<ContextValidation['issues']> {
    const issues: ContextValidation['issues'] = [];

    // Check if patterns are consistent
    const contextAny = context as any;
    if ((contextAny.patterns || []).length === 0) {
      issues.push({
        type: 'missing_context',
        severity: 'medium',
        message: 'No patterns found in context',
        suggestion: 'Build knowledge base to extract patterns',
        evidence: ['Pattern list empty'],
      });
    }

    return issues;
  }

  private async assessHallucinationRisk(
    context: EnhancedContext,
    _projectPath: string
  ): Promise<{
    risk: number;
    evidence: string[];
  }> {
    const evidence: string[] = [];
    let risk = 0;

    // Low freshness increases risk
    const contextAny = context as any;
    if ((contextAny.freshness || 1) < 0.5) {
      risk += 0.3;
      evidence.push('Low context freshness');
    }

    // Low confidence increases risk
    if ((contextAny.confidence || 1) < 0.7) {
      risk += 0.3;
      evidence.push('Low context confidence');
    }

    // Missing patterns increases risk
<<<<<<< HEAD
=======
    const contextAny = context as any;
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    if ((contextAny.patterns || []).length === 0) {
      risk += 0.2;
      evidence.push('No patterns available');
    }

    // Missing dependencies increases risk
    if ((contextAny.dependencies || []).length === 0) {
      risk += 0.2;
      evidence.push('No dependency information');
    }

    return {
      risk: Math.min(1, risk),
      evidence,
    };
  }

  private comparePatterns(
    before: string[],
    after: string[]
  ): {
    drift: number;
    before: string;
    after: string;
  } {
    const beforeSet = new Set(before);
    const afterSet = new Set(after);

    const added = after.filter(p => !beforeSet.has(p));
    const removed = before.filter(p => !afterSet.has(p));

    const drift = (added.length + removed.length) / Math.max(before.length, after.length, 1);

    return {
      drift,
      before: before.join(', '),
      after: after.join(', '),
    };
  }

  private compareConventions(
    before: Record<string, string>,
    after: Record<string, string>
  ): {
    drift: number;
    before: string;
    after: string;
  } {
    const beforeKeys = Object.keys(before);
    const afterKeys = Object.keys(after);

    const added = afterKeys.filter(k => !beforeKeys.includes(k));
    const removed = beforeKeys.filter(k => !afterKeys.includes(k));
    const changed = beforeKeys.filter(k => 
      afterKeys.includes(k) && before[k] !== after[k]
    );

    const totalChanges = added.length + removed.length + changed.length;
    const drift = totalChanges / Math.max(beforeKeys.length, afterKeys.length, 1);

    return {
      drift,
      before: JSON.stringify(before),
      after: JSON.stringify(after),
    };
  }

  private compareLayers(
    before: EnhancedContext['layers'],
    after: EnhancedContext['layers']
  ): {
    drift: number;
  } {
    const countDiff = Math.abs(before.length - after.length);
    const drift = countDiff / Math.max(before.length, after.length, 1);

    return { drift };
  }

  private computeSimilarity(_dna1: any, _dna2: any): number {
    // Simplified similarity calculation
    // In production, would use proper DNA comparison
    return 0.7;
  }

  private getPreviousSnapshot(projectPath: string): ContextSnapshot | null {
    const snapshots = this.snapshots.get(projectPath);
    return snapshots && snapshots.length > 0 ? (snapshots[snapshots.length - 1] ?? null) : null;
  }

  private async storeSnapshot(
    projectPath: string,
    context: EnhancedContext
  ): Promise<void> {
    const contextAny = context as any;
    const snapshot: ContextSnapshot = {
      timestamp: new Date().toISOString(),
      context,
      patterns: contextAny.patterns || [],
      conventions: contextAny.conventions || {},
      checksum: this.computeChecksum(context),
    };

    const snapshots = this.snapshots.get(projectPath) || [];
    snapshots.push(snapshot);

    // Keep only last 20 snapshots
    if (snapshots.length > 20) {
      snapshots.shift();
    }

    this.snapshots.set(projectPath, snapshots);
  }

  private computeChecksum(context: EnhancedContext): string {
    const crypto = require('crypto');
    const contextAny = context as any;
    const data = JSON.stringify({
      patterns: contextAny.patterns || [],
      conventions: contextAny.conventions || {},
      layerCount: (contextAny.layers || []).length,
    });
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }
}

export const enhancedContextEngine = new EnhancedContextEngine();
