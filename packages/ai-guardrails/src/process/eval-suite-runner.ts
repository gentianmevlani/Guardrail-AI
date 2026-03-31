import { EventEmitter } from 'events';
import {
  EvalCase,
  EvalSuiteConfig,
  EvalResult,
  EvalSuiteResult,
} from '@guardrail/core';

/**
 * Eval Suite Runner — Process Guardrail
 *
 * Orchestrates evaluation suites to systematically test guardrail
 * effectiveness. Supports parallel execution, custom scorers,
 * pass thresholds, and structured reporting.
 */
export class EvalSuiteRunner extends EventEmitter {
  private suites: Map<string, EvalSuiteConfig> = new Map();
  private history: EvalSuiteResult[] = [];
  private evaluator: EvalHandler | null = null;

  /**
   * Set the evaluation handler that runs each test case
   */
  setEvaluator(handler: EvalHandler): void {
    this.evaluator = handler;
  }

  /**
   * Register an eval suite
   */
  registerSuite(suite: EvalSuiteConfig): void {
    this.suites.set(suite.id, suite);
  }

  /**
   * Remove a suite
   */
  removeSuite(suiteId: string): boolean {
    return this.suites.delete(suiteId);
  }

  /**
   * Run a specific eval suite
   */
  async runSuite(suiteId: string): Promise<EvalSuiteResult> {
    const suite = this.suites.get(suiteId);
    if (!suite) throw new Error(`Suite ${suiteId} not found`);
    if (!this.evaluator) throw new Error('No evaluator set — call setEvaluator() first');

    const startTime = Date.now();
    const results: EvalResult[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    if (suite.parallelExecution) {
      const promises = suite.cases.map((tc) =>
        this.runCase(tc, suite.timeout).catch((err) => ({
          caseId: tc.id,
          passed: false,
          score: 0,
          actualOutput: '',
          reasoning: `Error: ${err instanceof Error ? err.message : String(err)}`,
          duration: 0,
          metrics: {},
        } as EvalResult))
      );
      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);
    } else {
      for (const tc of suite.cases) {
        try {
          const result = await this.runCase(tc, suite.timeout);
          results.push(result);
          this.emit('case-complete', result);
        } catch (err) {
          results.push({
            caseId: tc.id,
            passed: false,
            score: 0,
            actualOutput: '',
            reasoning: `Error: ${err instanceof Error ? err.message : String(err)}`,
            duration: 0,
            metrics: {},
          });
        }
      }
    }

    for (const r of results) {
      if (r.score < 0) { skipped++; }
      else if (r.passed) { passed++; }
      else { failed++; }
    }

    const scores = results.filter((r) => r.score >= 0).map((r) => r.score);
    const overallScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    const suiteResult: EvalSuiteResult = {
      suiteId: suite.id,
      suiteName: suite.name,
      totalCases: suite.cases.length,
      passed,
      failed,
      skipped,
      overallScore,
      passRate: suite.cases.length > 0 ? passed / (suite.cases.length - skipped) : 0,
      results,
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };

    this.history.push(suiteResult);
    this.emit('suite-complete', suiteResult);

    return suiteResult;
  }

  /**
   * Run all registered suites
   */
  async runAll(): Promise<EvalSuiteResult[]> {
    const results: EvalSuiteResult[] = [];
    for (const suiteId of this.suites.keys()) {
      const result = await this.runSuite(suiteId);
      results.push(result);
    }
    return results;
  }

  /**
   * Run suites by tag (runs all cases that match at least one tag)
   */
  async runByTag(tags: string[]): Promise<EvalSuiteResult[]> {
    const results: EvalSuiteResult[] = [];

    for (const [suiteId, suite] of this.suites.entries()) {
      const filteredCases = suite.cases.filter((c) =>
        c.tags.some((t) => tags.includes(t))
      );

      if (filteredCases.length > 0) {
        const filteredSuite = { ...suite, cases: filteredCases };
        this.suites.set(suiteId, filteredSuite);
        const result = await this.runSuite(suiteId);
        this.suites.set(suiteId, suite); // Restore original
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get all registered suites
   */
  getSuites(): EvalSuiteConfig[] {
    return Array.from(this.suites.values());
  }

  /**
   * Get result history
   */
  getHistory(): EvalSuiteResult[] {
    return [...this.history];
  }

  /**
   * Compare two suite runs
   */
  compareRuns(
    resultA: EvalSuiteResult,
    resultB: EvalSuiteResult
  ): {
    scoreDelta: number;
    passRateDelta: number;
    regressions: string[];
    improvements: string[];
  } {
    const regressions: string[] = [];
    const improvements: string[] = [];

    for (const resultB_case of resultB.results) {
      const resultA_case = resultA.results.find((r) => r.caseId === resultB_case.caseId);
      if (!resultA_case) continue;

      if (resultA_case.passed && !resultB_case.passed) {
        regressions.push(`${resultB_case.caseId}: was passing, now failing`);
      } else if (!resultA_case.passed && resultB_case.passed) {
        improvements.push(`${resultB_case.caseId}: was failing, now passing`);
      }
    }

    return {
      scoreDelta: resultB.overallScore - resultA.overallScore,
      passRateDelta: resultB.passRate - resultA.passRate,
      regressions,
      improvements,
    };
  }

  private async runCase(tc: EvalCase, timeout: number): Promise<EvalResult> {
    if (!this.evaluator) throw new Error('No evaluator set');

    const startTime = Date.now();

    const resultPromise = this.evaluator(tc);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Case ${tc.id} timed out after ${timeout}ms`)), timeout)
    );

    const result = await Promise.race([resultPromise, timeoutPromise]);
    result.duration = Date.now() - startTime;

    return result;
  }
}

type EvalHandler = (testCase: EvalCase) => Promise<EvalResult>;

export const evalSuiteRunner = new EvalSuiteRunner();
