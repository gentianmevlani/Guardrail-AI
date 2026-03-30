/**
 * Verification Engine with 3-Level Evidence Ladder
 * 
 * Level 1: Lexical (fast regex/keywords) → usually WARN
 * Level 2: Structural (AST + reachability + callsite context) → can FAIL
 * Level 3: Runtime witness (probes / Playwright trace / HAR) → definitive FAIL
 */

import { RealityFinding } from './reality-sniff';

export type EvidenceLevel = 'lexical' | 'structural' | 'runtime';
export type Verdict = 'PASS' | 'FAIL' | 'WARN';

export interface Evidence {
  level: EvidenceLevel;
  strength: number; // 0-1
  data: any; // Level-specific evidence
}

export interface VerifiedFinding {
  finding: RealityFinding;
  evidence: Evidence[];
  verdict: Verdict;
  confidence: number; // 0-1
}

export class VerificationEngine {
  /**
   * Verify finding with evidence ladder
   */
  async verify(finding: RealityFinding, options: {
    enableStructural?: boolean;
    enableRuntime?: boolean;
  } = {}): Promise<VerifiedFinding> {
    const evidence: Evidence[] = [];

    // Level 1: Lexical (always done)
    const lexicalEvidence = this.lexicalVerification(finding);
    evidence.push(lexicalEvidence);

    // Level 2: Structural (if enabled)
    if (options.enableStructural) {
      const structuralEvidence = await this.structuralVerification(finding);
      if (structuralEvidence) {
        evidence.push(structuralEvidence);
      }
    }

    // Level 3: Runtime (if enabled)
    if (options.enableRuntime) {
      const runtimeEvidence = await this.runtimeVerification(finding);
      if (runtimeEvidence) {
        evidence.push(runtimeEvidence);
      }
    }

    // Determine verdict and confidence
    const { verdict, confidence } = this.calculateVerdict(evidence, finding);

    return {
      finding,
      evidence,
      verdict,
      confidence,
    };
  }

  /**
   * Level 1: Lexical verification (fast regex/keywords)
   */
  private lexicalVerification(finding: RealityFinding): Evidence {
    // Already detected by lexical scan, so this is confirmation
    return {
      level: 'lexical',
      strength: 0.6, // Moderate confidence
      data: {
        pattern: finding.evidence.pattern,
        snippet: finding.evidence.snippet,
      },
    };
  }

  /**
   * Level 2: Structural verification (AST + reachability)
   */
  private async structuralVerification(finding: RealityFinding): Promise<Evidence | null> {
    const { StructuralVerifier } = await import('./structural-verifier');
    const verifier = new StructuralVerifier();
    // Extract project path from finding file
    const projectPath = finding.file.split('/').slice(0, -1).join('/') || '.';
    return await verifier.verify(finding, projectPath);
  }

  /**
   * Level 3: Runtime verification (probes / Playwright / HAR)
   */
  private async runtimeVerification(finding: RealityFinding): Promise<Evidence | null> {
    // TODO: Implement runtime probes
    // For now, return null (not implemented)
    return null;
  }

  /**
   * Calculate verdict based on evidence
   */
  private calculateVerdict(evidence: Evidence[], finding: RealityFinding): { verdict: Verdict; confidence: number } {
    if (evidence.length === 0) {
      return { verdict: 'WARN', confidence: 0.5 };
    }

    // Check for runtime evidence (definitive)
    const runtimeEvidence = evidence.find(e => e.level === 'runtime');
    if (runtimeEvidence && runtimeEvidence.strength > 0.8) {
      return { verdict: 'FAIL', confidence: runtimeEvidence.strength };
    }

    // Check for structural evidence
    const structuralEvidence = evidence.find(e => e.level === 'structural');
    if (structuralEvidence && structuralEvidence.strength > 0.7) {
      // Can FAIL if severity is high/critical
      if (finding.severity === 'critical' || finding.severity === 'high') {
        return { verdict: 'FAIL', confidence: structuralEvidence.strength };
      }
      return { verdict: 'WARN', confidence: structuralEvidence.strength };
    }

    // Lexical only → WARN (unless critical severity)
    const lexicalEvidence = evidence.find(e => e.level === 'lexical');
    if (lexicalEvidence) {
      if (finding.severity === 'critical' && lexicalEvidence.strength > 0.7) {
        return { verdict: 'FAIL', confidence: lexicalEvidence.strength };
      }
      return { verdict: 'WARN', confidence: lexicalEvidence.strength };
    }

    return { verdict: 'WARN', confidence: 0.5 };
  }
}
