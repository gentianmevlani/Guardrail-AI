import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DriftAnalysis, HistoryEntry, ComplianceScanResult, RegressionItem } from './types';

export class DriftDetector {
  private historyFile: string;

  constructor(historyDir: string = '.guardrail/history') {
    const dir = join(process.cwd(), historyDir);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.historyFile = join(dir, 'compliance.jsonl');
  }

  detectDrift(currentResult: ComplianceScanResult): DriftAnalysis | undefined {
    const history = this.loadHistory();
    
    if (history.length === 0) {
      return undefined;
    }

    const previousRun = history[history.length - 1];
    const previousResults = this.loadPreviousResults(previousRun?.runId || '');

    if (!previousResults) {
      return {
        scoreDelta: 0,
        newFailures: [],
        newPasses: [],
        regressions: []
      };
    }

    const scoreDelta = currentResult.summary.score - (previousRun?.score || 0);
    const regressions = this.findRegressions(previousResults, currentResult);
    const newFailures = this.findNewFailures(previousResults, currentResult);
    const newPasses = this.findNewPasses(previousResults, currentResult);

    return {
      previousRunId: previousRun?.runId || '',
      scoreDelta,
      newFailures,
      newPasses,
      regressions
    };
  }

  saveToHistory(result: ComplianceScanResult): void {
    const entry: HistoryEntry = {
      runId: result.runId,
      timestamp: result.timestamp.toISOString(),
      framework: result.framework,
      score: result.summary.score,
      passed: result.summary.passed,
      failed: result.summary.failed,
      totalRules: result.summary.totalRules
    };

    if (!existsSync(this.historyFile)) {
      writeFileSync(this.historyFile, '');
    }

    appendFileSync(this.historyFile, JSON.stringify(entry) + '\n');

    const summaryPath = join(
      process.cwd(),
      '.guardrail/history',
      `${result.runId}-summary.json`
    );
    writeFileSync(summaryPath, JSON.stringify({
      runId: result.runId,
      timestamp: result.timestamp,
      framework: result.framework,
      summary: result.summary,
      results: result.results.map(r => ({
        controlId: r.controlId,
        passed: r.passed,
        severity: r.severity,
        message: r.message
      }))
    }, null, 2));
  }

  loadHistory(limit: number = 100): HistoryEntry[] {
    if (!existsSync(this.historyFile)) {
      return [];
    }

    const content = readFileSync(this.historyFile, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    return lines
      .slice(-limit)
      .map(line => JSON.parse(line) as HistoryEntry);
  }

  getTrend(framework: string, limit: number = 10): HistoryEntry[] {
    const history = this.loadHistory(limit * 2);
    return history
      .filter(entry => entry.framework === framework)
      .slice(-limit);
  }

  private loadPreviousResults(runId: string): ComplianceScanResult | null {
    const summaryPath = join(
      process.cwd(),
      '.guardrail/history',
      `${runId}-summary.json`
    );

    if (!existsSync(summaryPath)) {
      return null;
    }

    try {
      return JSON.parse(readFileSync(summaryPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  private findRegressions(
    previous: ComplianceScanResult,
    current: ComplianceScanResult
  ): RegressionItem[] {
    const regressions: RegressionItem[] = [];
    const prevMap = new Map(previous.results.map(r => [r.controlId, r]));

    for (const currentResult of current.results) {
      const prevResult = prevMap.get(currentResult.controlId);
      
      if (prevResult && prevResult.passed && !currentResult.passed) {
        regressions.push({
          controlId: currentResult.controlId,
          severity: currentResult.severity,
          message: currentResult.message,
          previousStatus: 'passed',
          currentStatus: 'failed'
        });
      }
    }

    return regressions.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private findNewFailures(
    previous: ComplianceScanResult,
    current: ComplianceScanResult
  ): string[] {
    const prevControlIds = new Set(previous.results.map(r => r.controlId));
    return current.results
      .filter(r => !r.passed && !prevControlIds.has(r.controlId))
      .map(r => r.controlId);
  }

  private findNewPasses(
    previous: ComplianceScanResult,
    current: ComplianceScanResult
  ): string[] {
    const prevMap = new Map(previous.results.map(r => [r.controlId, r]));
    return current.results
      .filter(r => {
        const prev = prevMap.get(r.controlId);
        return r.passed && prev && !prev.passed;
      })
      .map(r => r.controlId);
  }
}

function writeFileSync(path: string, content: string): void {
  require('fs').writeFileSync(path, content);
}
