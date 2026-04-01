import {
  ChainOfThoughtStep,
  ChainOfThoughtAnalysis,
} from '@guardrail/core';

/**
 * Chain of Thought Monitor — Behavioral Guardrail
 *
 * Monitors agent reasoning chains in real-time for:
 * - Reasoning drift (going off track)
 * - Infinite loops (repeating the same steps)
 * - Manipulation attempts (external injection into reasoning)
 * - Coherence degradation
 */
export class ChainOfThoughtMonitor {
  private chains: Map<string, ChainOfThoughtStep[]> = new Map();
  private readonly maxSteps: number;
  private readonly driftThreshold: number;
  private readonly loopDetectionWindow: number;

  constructor(options?: {
    maxSteps?: number;
    driftThreshold?: number;
    loopDetectionWindow?: number;
  }) {
    this.maxSteps = options?.maxSteps ?? 50;
    this.driftThreshold = options?.driftThreshold ?? 0.6;
    this.loopDetectionWindow = options?.loopDetectionWindow ?? 5;
  }

  /**
   * Record a reasoning step and analyze the chain
   */
  async recordStep(
    agentId: string,
    step: Omit<ChainOfThoughtStep, 'stepNumber' | 'timestamp'>
  ): Promise<ChainOfThoughtAnalysis> {
    const chain = this.chains.get(agentId) || [];
    const stepNumber = chain.length + 1;

    const fullStep: ChainOfThoughtStep = {
      ...step,
      stepNumber,
      timestamp: new Date(),
    };

    chain.push(fullStep);
    this.chains.set(agentId, chain);

    return this.analyze(agentId);
  }

  /**
   * Analyze the current chain of thought
   */
  async analyze(agentId: string): Promise<ChainOfThoughtAnalysis> {
    const chain = this.chains.get(agentId) || [];
    const flags: string[] = [];

    if (chain.length === 0) {
      return {
        isCoherent: true,
        steps: [],
        driftDetected: false,
        driftScore: 0,
        loopDetected: false,
        manipulationDetected: false,
        recommendation: 'continue',
        flags: [],
      };
    }

    // Check for excessive steps
    if (chain.length > this.maxSteps) {
      flags.push(`Chain exceeds maximum steps (${chain.length}/${this.maxSteps})`);
    }

    // Detect drift
    const driftScore = this.calculateDrift(chain);
    const driftDetected = driftScore > this.driftThreshold;
    if (driftDetected) {
      flags.push(`Reasoning drift detected (score: ${driftScore.toFixed(2)})`);
    }

    // Detect loops
    const loopDetected = this.detectLoop(chain);
    if (loopDetected) {
      flags.push('Reasoning loop detected — agent is repeating steps');
    }

    // Detect manipulation
    const manipulationDetected = this.detectManipulation(chain);
    if (manipulationDetected) {
      flags.push('Potential reasoning chain manipulation detected');
    }

    // Check coherence
    const isCoherent = this.checkCoherence(chain);
    if (!isCoherent) {
      flags.push('Reasoning chain shows coherence degradation');
    }

    // Check confidence degradation
    const confidenceDegrading = this.detectConfidenceDegradation(chain);
    if (confidenceDegrading) {
      flags.push('Agent confidence is progressively declining');
    }

    // Determine recommendation
    const recommendation = this.getRecommendation(
      driftDetected,
      loopDetected,
      manipulationDetected,
      isCoherent,
      chain.length
    );

    return {
      isCoherent,
      steps: chain,
      driftDetected,
      driftScore,
      loopDetected,
      manipulationDetected,
      recommendation,
      flags,
    };
  }

  /**
   * Get the current chain for an agent
   */
  getChain(agentId: string): ChainOfThoughtStep[] {
    return this.chains.get(agentId) || [];
  }

  /**
   * Reset the chain for an agent
   */
  resetChain(agentId: string): void {
    this.chains.delete(agentId);
  }

  /**
   * Reset all chains
   */
  resetAll(): void {
    this.chains.clear();
  }

  /**
   * Calculate drift from the original reasoning direction
   */
  private calculateDrift(chain: ChainOfThoughtStep[]): number {
    if (chain.length < 3) return 0;

    // Compare early steps' vocabulary with later steps
    const earlySteps = chain.slice(0, Math.max(2, Math.floor(chain.length * 0.3)));
    const lateSteps = chain.slice(-Math.max(2, Math.floor(chain.length * 0.3)));

    const earlyTokens = new Set(this.tokenize(earlySteps.map((s) => s.reasoning).join(' ')));
    const lateTokens = this.tokenize(lateSteps.map((s) => s.reasoning).join(' '));

    if (lateTokens.length === 0 || earlyTokens.size === 0) return 0;

    let overlapCount = 0;
    for (const token of lateTokens) {
      if (earlyTokens.has(token)) overlapCount++;
    }

    const overlap = overlapCount / lateTokens.length;
    // Higher drift = lower overlap (inverted)
    return 1 - Math.min(1, overlap * 1.5);
  }

  /**
   * Detect if the agent is stuck in a loop
   */
  private detectLoop(chain: ChainOfThoughtStep[]): boolean {
    if (chain.length < this.loopDetectionWindow * 2) return false;

    const recentSteps = chain.slice(-this.loopDetectionWindow);
    const previousSteps = chain.slice(
      -this.loopDetectionWindow * 2,
      -this.loopDetectionWindow
    );

    // Compare reasoning text similarity between windows
    for (const recent of recentSteps) {
      for (const previous of previousSteps) {
        const similarity = this.textSimilarity(recent.reasoning, previous.reasoning);
        if (similarity > 0.85) return true;
      }
    }

    // Check for action repetition
    const recentActions = recentSteps
      .filter((s) => s.action)
      .map((s) => s.action!);
    const previousActions = previousSteps
      .filter((s) => s.action)
      .map((s) => s.action!);

    if (recentActions.length >= 3 && previousActions.length >= 3) {
      const actionStr1 = recentActions.join('|');
      const actionStr2 = previousActions.join('|');
      if (actionStr1 === actionStr2) return true;
    }

    return false;
  }

  /**
   * Detect potential manipulation of the reasoning chain
   */
  private detectManipulation(chain: ChainOfThoughtStep[]): boolean {
    for (const step of chain) {
      const reasoning = step.reasoning.toLowerCase();

      // Detect injected instructions in reasoning
      const manipulationPatterns = [
        /ignore (?:all |any )?(?:previous|prior) (?:steps|reasoning|instructions)/i,
        /override (?:the |your )?(?:current|previous) (?:goal|objective|task)/i,
        /new (?:objective|goal|instruction|directive):/i,
        /disregard (?:the |your )?(?:original|initial|current) (?:task|goal|instructions)/i,
        /\[system\]/i,
        /\[admin\]/i,
        /\[override\]/i,
      ];

      for (const pattern of manipulationPatterns) {
        if (pattern.test(reasoning)) return true;
      }

      // Detect sudden radical goal changes
      if (step.stepNumber > 3) {
        const prevStep = chain[step.stepNumber - 2];
        if (prevStep) {
          const similarity = this.textSimilarity(step.reasoning, prevStep.reasoning);
          if (similarity < 0.1 && step.confidence > 0.8) {
            // Sudden complete change with high confidence is suspicious
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check overall chain coherence
   */
  private checkCoherence(chain: ChainOfThoughtStep[]): boolean {
    if (chain.length < 3) return true;

    // Check sequential coherence (adjacent steps should share context)
    let incoherentPairs = 0;
    for (let i = 1; i < chain.length; i++) {
      const similarity = this.textSimilarity(
        chain[i - 1]!.reasoning,
        chain[i]!.reasoning
      );
      if (similarity < 0.1) incoherentPairs++;
    }

    // More than 30% incoherent transitions = not coherent
    return incoherentPairs / (chain.length - 1) < 0.3;
  }

  /**
   * Detect progressive confidence degradation
   */
  private detectConfidenceDegradation(chain: ChainOfThoughtStep[]): boolean {
    if (chain.length < 5) return false;

    const recentSteps = chain.slice(-5);
    let declining = 0;

    for (let i = 1; i < recentSteps.length; i++) {
      if (recentSteps[i]!.confidence < recentSteps[i - 1]!.confidence) {
        declining++;
      }
    }

    // 4 out of 4 consecutive declines = concerning
    return declining >= 4;
  }

  private getRecommendation(
    driftDetected: boolean,
    loopDetected: boolean,
    manipulationDetected: boolean,
    isCoherent: boolean,
    stepCount: number
  ): 'continue' | 'redirect' | 'halt' | 'review' {
    if (manipulationDetected) return 'halt';
    if (loopDetected && driftDetected) return 'halt';
    if (loopDetected) return 'redirect';
    if (driftDetected) return 'redirect';
    if (!isCoherent) return 'review';
    if (stepCount > this.maxSteps) return 'halt';
    return 'continue';
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);
  }

  private textSimilarity(a: string, b: string): number {
    const tokensA = this.tokenize(a);
    const tokensB = new Set(this.tokenize(b));

    if (tokensA.length === 0 || tokensB.size === 0) return 0;

    let matches = 0;
    for (const token of tokensA) {
      if (tokensB.has(token)) matches++;
    }

    return matches / Math.max(tokensA.length, tokensB.size);
  }
}

export const chainOfThoughtMonitor = new ChainOfThoughtMonitor();
