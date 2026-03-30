/**
 * Ambient types for `guardrail-security` when workspace package has no built `dist/` yet.
 */
declare module "guardrail-security" {
  export class SecretsGuardian {
    constructor();
    scanProject(
      projectPath: string,
      runId: string,
      options: Record<string, unknown>,
    ): Promise<{
      summary: {
        byRisk: { high: number; medium: number; low: number };
        totalSecrets: number;
        byType: Record<string, unknown>;
      };
      scannedFiles: number;
      totalFiles: number;
      detections: Array<{
        filePath: string;
        secretType: string;
        maskedValue: string;
        location: { line: number };
        confidence: number;
        isTest: boolean;
        recommendation: { action: string };
      }>;
    }>;
  }

  export const attackSurfaceAnalyzer: {
    analyzeProject(...args: unknown[]): Promise<unknown>;
    generateVisualization(analysis: unknown): Promise<unknown>;
  };

  export const secretsGuardian: {
    scanContent(
      content: string,
      filePath: string,
      source: string,
      options?: Record<string, unknown>,
    ): Promise<unknown>;
    scanProject(
      projectPath: string,
      projectId: string,
      options?: Record<string, unknown>,
    ): Promise<unknown>;
    getProjectReport(projectId: string): Promise<unknown>;
  };

  export const preCommitHook: {
    generateHookScript(): string;
  };

  export const licenseComplianceEngine: {
    analyzeProject(...args: unknown[]): Promise<unknown>;
    checkCompatibility(...args: unknown[]): unknown;
  };

  export const supplyChainDetector: {
    analyzePackage(...args: unknown[]): Promise<unknown>;
    detectTyposquatting(packageName: string): Promise<unknown>;
    generateSBOM(projectPath: string, projectId: string): Promise<unknown>;
  };
}
