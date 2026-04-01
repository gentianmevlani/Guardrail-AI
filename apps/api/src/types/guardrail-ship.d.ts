/**
 * Ambient types for dynamic `import("guardrail-ship")` — runtime resolves workspace package;
 * avoids pulling ship sources into apps/api `rootDir`.
 */
declare module "guardrail-ship" {
  export class ProShipScanner {
    runComprehensiveScan(
      config: Record<string, unknown>,
    ): Promise<Record<string, unknown>>;
  }

  export const shipBadgeGenerator: {
    generateShipBadge(opts: {
      projectPath: string;
      outputDir: string;
    }): Promise<{
      verdict: string;
      score: number;
      checks: unknown;
      permalink?: string;
      embedCode?: string;
    }>;
  };

  export const importGraphScanner: {
    scan(projectPath: string): Promise<{
      verdict: string;
      violations: unknown;
      scannedFiles: number;
      entrypoints: unknown;
    }>;
  };

  export const realityScanner: {
    scan(opts: {
      projectPath: string;
      baseUrl: string;
      outputDir: string;
    }): Promise<Record<string, unknown>>;
  };
}
