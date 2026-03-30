import { ComplianceScanResult, RuleResult } from '../types';

export class TableFormatter {
  format(result: ComplianceScanResult): string {
    const lines: string[] = [];

    lines.push('');
    lines.push('═'.repeat(80));
    lines.push(`  COMPLIANCE SCAN REPORT - ${result.framework.toUpperCase()}`);
    lines.push('═'.repeat(80));
    lines.push('');

    lines.push(`Run ID:       ${result.runId}`);
    lines.push(`Timestamp:    ${result.timestamp.toISOString()}`);
    lines.push(`Project Path: ${result.projectPath}`);
    lines.push('');

    lines.push('─'.repeat(80));
    lines.push('  SUMMARY');
    lines.push('─'.repeat(80));
    lines.push('');
    lines.push(`Total Rules:  ${result.summary.totalRules}`);
    lines.push(`Passed:       ${result.summary.passed} (${this.percentage(result.summary.passed, result.summary.totalRules)}%)`);
    lines.push(`Failed:       ${result.summary.failed} (${this.percentage(result.summary.failed, result.summary.totalRules)}%)`);
    lines.push(`Score:        ${result.summary.score}/100 ${this.getScoreEmoji(result.summary.score)}`);
    lines.push('');

    if (result.drift) {
      lines.push('─'.repeat(80));
      lines.push('  DRIFT ANALYSIS');
      lines.push('─'.repeat(80));
      lines.push('');
      
      if (result.drift.previousRunId) {
        lines.push(`Previous Run: ${result.drift.previousRunId}`);
        lines.push(`Score Delta:  ${result.drift.scoreDelta > 0 ? '+' : ''}${result.drift.scoreDelta}`);
        lines.push('');

        if (result.drift.regressions.length > 0) {
          lines.push(`⚠️  REGRESSIONS (${result.drift.regressions.length}):`);
          for (const reg of result.drift.regressions.slice(0, 5)) {
            lines.push(`  • [${reg.severity.toUpperCase()}] ${reg.controlId}: ${reg.message}`);
          }
          if (result.drift.regressions.length > 5) {
            lines.push(`  ... and ${result.drift.regressions.length - 5} more`);
          }
          lines.push('');
        }

        if (result.drift.newPasses.length > 0) {
          lines.push(`✅ NEW PASSES (${result.drift.newPasses.length}): ${result.drift.newPasses.slice(0, 3).join(', ')}`);
          lines.push('');
        }
      } else {
        lines.push('No previous run found for drift comparison.');
        lines.push('');
      }
    }

    lines.push('─'.repeat(80));
    lines.push('  DETAILED RESULTS');
    lines.push('─'.repeat(80));
    lines.push('');

    const criticalFailures = result.results.filter(r => !r.passed && r.severity === 'critical');
    const highFailures = result.results.filter(r => !r.passed && r.severity === 'high');
    const mediumFailures = result.results.filter(r => !r.passed && r.severity === 'medium');
    const lowFailures = result.results.filter(r => !r.passed && r.severity === 'low');

    if (criticalFailures.length > 0) {
      lines.push('🔴 CRITICAL FAILURES:');
      lines.push('');
      criticalFailures.forEach(r => lines.push(...this.formatResult(r)));
    }

    if (highFailures.length > 0) {
      lines.push('🟠 HIGH SEVERITY FAILURES:');
      lines.push('');
      highFailures.forEach(r => lines.push(...this.formatResult(r)));
    }

    if (mediumFailures.length > 0) {
      lines.push('🟡 MEDIUM SEVERITY FAILURES:');
      lines.push('');
      mediumFailures.forEach(r => lines.push(...this.formatResult(r)));
    }

    if (lowFailures.length > 0) {
      lines.push('🔵 LOW SEVERITY FAILURES:');
      lines.push('');
      lowFailures.forEach(r => lines.push(...this.formatResult(r)));
    }

    const passes = result.results.filter(r => r.passed);
    if (passes.length > 0) {
      lines.push('✅ PASSED CONTROLS:');
      lines.push('');
      passes.forEach(r => {
        lines.push(`  ✓ ${r.controlId}: ${r.message}`);
      });
      lines.push('');
    }

    if (result.evidence.artifacts.length > 0) {
      lines.push('─'.repeat(80));
      lines.push('  EVIDENCE COLLECTED');
      lines.push('─'.repeat(80));
      lines.push('');
      lines.push(`Evidence Directory: .guardrail/evidence/${result.runId}/`);
      lines.push(`Total Artifacts:    ${result.evidence.artifacts.length}`);
      lines.push('');
      result.evidence.artifacts.forEach(artifact => {
        lines.push(`  • ${artifact.type}: ${artifact.description}`);
        lines.push(`    Path: ${artifact.path}`);
      });
      lines.push('');
    }

    lines.push('═'.repeat(80));
    lines.push('');

    return lines.join('\n');
  }

  private formatResult(result: RuleResult): string[] {
    const lines: string[] = [];
    
    lines.push(`  Control: ${result.controlId}`);
    lines.push(`  Status:  ${result.passed ? '✓ PASS' : '✗ FAIL'}`);
    lines.push(`  Message: ${result.message}`);
    
    if (result.evidenceRefs.length > 0) {
      lines.push(`  Evidence: ${result.evidenceRefs.join(', ')}`);
    }
    
    if (!result.passed) {
      lines.push(`  Remediation: ${result.remediation}`);
    }
    
    lines.push('');
    
    return lines;
  }

  private percentage(value: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  private getScoreEmoji(score: number): string {
    if (score >= 90) return '🟢';
    if (score >= 70) return '🟡';
    if (score >= 50) return '🟠';
    return '🔴';
  }
}
