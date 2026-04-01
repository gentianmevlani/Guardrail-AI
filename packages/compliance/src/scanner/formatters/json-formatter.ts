import { ComplianceScanResult } from '../types';

export class JsonFormatter {
  format(result: ComplianceScanResult, pretty: boolean = true): string {
    const output = {
      runId: result.runId,
      timestamp: result.timestamp.toISOString(),
      projectPath: result.projectPath,
      framework: result.framework,
      summary: result.summary,
      results: result.results.map(r => ({
        controlId: r.controlId,
        severity: r.severity,
        passed: r.passed,
        message: r.message,
        evidenceRefs: r.evidenceRefs,
        remediation: r.remediation,
        metadata: r.metadata
      })),
      drift: result.drift ? {
        previousRunId: result.drift.previousRunId,
        scoreDelta: result.drift.scoreDelta,
        newFailures: result.drift.newFailures,
        newPasses: result.drift.newPasses,
        regressions: result.drift.regressions
      } : undefined,
      evidence: {
        runId: result.evidence.runId,
        timestamp: result.evidence.timestamp.toISOString(),
        artifactCount: result.evidence.artifacts.length,
        artifacts: result.evidence.artifacts.map(a => ({
          type: a.type,
          path: a.path,
          description: a.description,
          metadata: a.metadata
        }))
      }
    };

    return pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);
  }
}
