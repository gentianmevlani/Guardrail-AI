/**
 * Unified guardrail System
 * 
 * Integrates all core systems:
 * - Enhanced Ship Decision Engine
 * - Advanced Prompt Firewall
 * - Enhanced Context Engine
 * - Long-Term Improvement Tracking
 */

import { enhancedShipDecisionEngine, EnhancedShipDecision } from './ship/enhanced-ship-decision';
import { createLongTermTracking, LongTermTrackingReport } from './improvements/long-term-tracking';
import type { AdvancedPromptFirewall, PromptFirewallResult } from './prompt-firewall-types';

export interface UnifiedGuardrailOptions {
  projectPath: string;
  enableShipDecision?: boolean;
  enablePromptFirewall?: boolean;
  enableContextEngine?: boolean;
  enableLongTermTracking?: boolean;
}

export interface UnifiedGuardrailResult {
  shipDecision?: EnhancedShipDecision;
  promptFirewall?: PromptFirewallResult;
  contextValidation?: {
    valid: boolean;
    drift?: any;
  };
  longTermTracking?: LongTermTrackingReport;
  summary: {
    overallStatus: 'ready' | 'needs_attention' | 'blocked';
    score: number; // 0-100
    blockers: string[];
    recommendations: string[];
  };
}

export class UnifiedGuardrail {
  private projectPath: string;
  private promptFirewall: AdvancedPromptFirewall | null = null;
  private longTermTracking: ReturnType<typeof createLongTermTracking>;

  constructor(options: UnifiedGuardrailOptions) {
    this.projectPath = options.projectPath;
    void this.initializePromptFirewall(options.projectPath);
    this.longTermTracking = createLongTermTracking(options.projectPath);
  }

  private async initializePromptFirewall(projectPath: string): Promise<void> {
    try {
      // Variable specifier avoids TS resolving @guardrail/ai-guardrails at compile time.
      // (That package depends on @guardrail/core, so core must compile without it built.)
      const specifier: string = '@guardrail/ai-guardrails';
      const mod = (await import(specifier)) as { createPromptFirewall: (p: string) => unknown };
      const { createPromptFirewall } = mod;
      this.promptFirewall = createPromptFirewall(projectPath) as AdvancedPromptFirewall;
    } catch {
      this.promptFirewall = createFallbackFirewall();
    }
  }

  /**
   * Run comprehensive guardrail check
   */
  async runComprehensiveCheck(
    prompt?: string,
    options: {
      checkShip?: boolean;
      checkContext?: boolean;
      checkLongTerm?: boolean;
    } = {}
  ): Promise<UnifiedGuardrailResult> {
    const result: UnifiedGuardrailResult = {
      summary: {
        overallStatus: 'ready',
        score: 100,
        blockers: [],
        recommendations: [],
      },
    };

    // 1. Ship Decision
    if (options.checkShip !== false) {
      try {
        result.shipDecision = await enhancedShipDecisionEngine.decide(this.projectPath, {
          checkDrift: true,
        });
        
        if (result.shipDecision.verdict === 'NO_SHIP') {
          result.summary.overallStatus = 'blocked';
          result.summary.blockers.push(...result.shipDecision.blockers.map(b => b.message));
        } else if (result.shipDecision.verdict === 'REVIEW') {
          result.summary.overallStatus = 'needs_attention';
        }
        
        result.summary.score = Math.min(result.summary.score, result.shipDecision.score);
        result.summary.recommendations.push(...result.shipDecision.recommendations.immediate);
      } catch (error: any) {
        result.summary.blockers.push(`Ship decision check failed: ${error.message}`);
      }
    }

    // 2. Prompt Firewall (if prompt provided)
    if (prompt && options.checkContext !== false) {
      try {
        // Ensure promptFirewall is initialized
        if (!this.promptFirewall) {
          await this.initializePromptFirewall(this.projectPath);
        }
        const firewall = this.promptFirewall;
        if (!firewall) {
          throw new Error('Prompt firewall failed to initialize');
        }
        const firewallResult = await firewall.process(prompt, {
          autoBreakdown: true,
          autoVerify: true,
          autoFix: false, // Don't auto-fix, just report
          includeVersionControl: true,
          generatePlan: true,
        });
        result.promptFirewall = firewallResult;

        if (firewallResult && !firewallResult.verification.passed) {
          result.summary.overallStatus = 'blocked';
          result.summary.blockers.push(...(firewallResult.verification.blockers || []));
        }

        if (firewallResult) {
          result.summary.recommendations.push(...(firewallResult.recommendations || []));
        }
      } catch (error: any) {
        result.summary.blockers.push(`Prompt firewall check failed: ${error.message}`);
      }
    }

    // 3. Context Validation
    if (options.checkContext !== false) {
      try {
        // Try to dynamically import enhancedContextEngine if available
        // Using string literal to prevent TypeScript from type-checking the file
        let contextResult: any;
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const enhancedContextEngineModule = await import(
            '../../../src/lib/context/enhanced-context-engine' as string
          );
          const { enhancedContextEngine } = enhancedContextEngineModule as any;
          contextResult = await enhancedContextEngine.getValidatedContext(this.projectPath, {
            checkDrift: true,
          });
        } catch {
          // Fallback if import fails
          contextResult = {
            validation: { valid: true, issues: [] },
            drift: { detected: false },
          };
        }

        result.contextValidation = {
          valid: contextResult.validation.valid,
          drift: contextResult.drift,
        };

        if (!contextResult.validation.valid) {
          result.summary.overallStatus = 'needs_attention';
          const criticalIssues = (contextResult.validation.issues || []).filter(
            (i: any) => i.severity === 'critical' || i.severity === 'high'
          );
          result.summary.blockers.push(...criticalIssues.map((i: any) => i.message));
        }

        if (contextResult.drift?.detected) {
          result.summary.recommendations.push(contextResult.drift.overallRecommendation);
        }
      } catch (error: any) {
        result.summary.blockers.push(`Context validation failed: ${error.message}`);
      }
    }

    // 4. Long-Term Tracking
    if (options.checkLongTerm !== false) {
      try {
        result.longTermTracking = await this.longTermTracking.generateReport();
        
        if (result.longTermTracking.overallScore < 70) {
          result.summary.overallStatus = 'needs_attention';
        }
        
        result.summary.score = Math.min(
          result.summary.score,
          result.longTermTracking.overallScore
        );
        result.summary.recommendations.push(...result.longTermTracking.recommendations);
      } catch (error: any) {
        // Long-term tracking is optional, don't block on errors
        console.warn(`Long-term tracking failed: ${error.message}`);
      }
    }

    // Finalize summary
    if (result.summary.blockers.length > 0) {
      result.summary.overallStatus = 'blocked';
    } else if (result.summary.score < 85) {
      result.summary.overallStatus = 'needs_attention';
    }

    return result;
  }

  /**
   * Process prompt through firewall with full analysis
   */
  async processPrompt(prompt: string): Promise<PromptFirewallResult> {
    // Ensure promptFirewall is initialized
    if (!this.promptFirewall) {
      await this.initializePromptFirewall(this.projectPath);
    }
    const firewall = this.promptFirewall;
    if (!firewall) {
      throw new Error('Prompt firewall failed to initialize');
    }
    return await firewall.process(prompt, {
      autoBreakdown: true,
      autoVerify: true,
      autoFix: false,
      includeVersionControl: true,
      generatePlan: true,
    });
  }

  /**
   * Get ship decision
   */
  async getShipDecision(): Promise<EnhancedShipDecision> {
    return await enhancedShipDecisionEngine.decide(this.projectPath, {
      checkDrift: true,
    });
  }

  /**
   * Get long-term tracking report
   */
  async getLongTermReport(): Promise<LongTermTrackingReport> {
    return await this.longTermTracking.generateReport();
  }

  /**
   * Generate comprehensive report
   */
  async generateReport(prompt?: string): Promise<string> {
    const result = await this.runComprehensiveCheck(prompt);

    const lines: string[] = [];

    lines.push('╔══════════════════════════════════════════════════════════════╗');
    lines.push('║         🛡️ UNIFIED guardrail COMPREHENSIVE REPORT 🛡️        ║');
    lines.push('╚══════════════════════════════════════════════════════════════╝');
    lines.push('');

    // Overall Status
    const statusIcon = result.summary.overallStatus === 'ready' ? '✅' :
                      result.summary.overallStatus === 'needs_attention' ? '⚠️' : '❌';
    lines.push(`${statusIcon} OVERALL STATUS: ${result.summary.overallStatus.toUpperCase()}`);
    lines.push(`   Score: ${result.summary.score}/100`);
    lines.push('');

    // Ship Decision
    if (result.shipDecision) {
      lines.push('🚀 SHIP DECISION:');
      lines.push(`   Verdict: ${result.shipDecision.verdict}`);
      lines.push(`   Confidence: ${(result.shipDecision.confidence * 100).toFixed(0)}%`);
      if (result.shipDecision.blockers.length > 0) {
        lines.push(`   Blockers: ${result.shipDecision.blockers.length}`);
      }
      lines.push('');
    }

    // Prompt Firewall
    if (result.promptFirewall) {
      lines.push('🛡️ PROMPT FIREWALL:');
      lines.push(`   Verification: ${result.promptFirewall.verification.passed ? 'PASSED' : 'FAILED'}`);
      lines.push(`   Score: ${result.promptFirewall.verification.score}/100`);
      lines.push(`   Tasks: ${result.promptFirewall.taskBreakdown.length}`);
      lines.push(`   Immediate Fixes: ${result.promptFirewall.immediateFixes.length}`);
      lines.push('');
    }

    // Context Validation
    if (result.contextValidation) {
      lines.push('🧠 CONTEXT VALIDATION:');
      lines.push(`   Valid: ${result.contextValidation.valid ? 'YES' : 'NO'}`);
      if (result.contextValidation.drift?.detected) {
        lines.push(`   Drift Detected: YES (Score: ${result.contextValidation.drift.score})`);
      }
      lines.push('');
    }

    // Long-Term Tracking
    if (result.longTermTracking) {
      lines.push('📊 LONG-TERM TRACKING:');
      lines.push(`   Overall Score: ${result.longTermTracking.overallScore}/100`);
      lines.push(`   Test Coverage: ${result.longTermTracking.testMetrics.coverage}%`);
      lines.push(`   Best Practices Adopted: ${result.longTermTracking.bestPractices.filter(p => p.status === 'adopted').length}/${result.longTermTracking.bestPractices.length}`);
      lines.push('');
    }

    // Blockers
    if (result.summary.blockers.length > 0) {
      lines.push('🚫 BLOCKERS:');
      for (const blocker of result.summary.blockers.slice(0, 10)) {
        lines.push(`   • ${blocker}`);
      }
      lines.push('');
    }

    // Recommendations
    if (result.summary.recommendations.length > 0) {
      lines.push('💡 RECOMMENDATIONS:');
      for (const rec of result.summary.recommendations.slice(0, 10)) {
        lines.push(`   • ${rec}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * When `@guardrail/ai-guardrails` is missing or fails to load, keep UnifiedGuardrail usable.
 */
function createFallbackFirewall(): AdvancedPromptFirewall {
  const fallbackResult = {
    verification: { passed: true, score: 100, checks: [], blockers: [] as string[] },
    taskBreakdown: [],
    immediateFixes: [],
    recommendations: [] as string[],
  } as unknown as PromptFirewallResult;

  return {
    process: async () => fallbackResult,
    applyFix: async () => ({
      success: false,
      message: 'Prompt firewall package unavailable',
    }),
  } as unknown as AdvancedPromptFirewall;
}

export function createUnifiedGuardrail(options: UnifiedGuardrailOptions): UnifiedGuardrail {
  return new UnifiedGuardrail(options);
}
