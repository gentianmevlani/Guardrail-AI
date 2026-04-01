/**
 * Ship Badge Generator
 *
 * "One-click shareable proof that your app is real."
 *
 * Generates badges + hosted permalinks for:
 * ✅ No Mock Data Detected
 * ✅ No Localhost/Ngrok
 * ✅ All required env vars present
 * ✅ Billing not simulated
 * ✅ DB is real
 * ✅ OAuth callbacks not localhost
 *
 * Vibecoders slap this on README / landing page / Product Hunt for social proof.
 */
export interface ShipCheck {
  id: string;
  name: string;
  shortName: string;
  status: "pass" | "fail" | "warning" | "skip";
  message: string;
  details?: string[];
}
export interface ShipBadgeResult {
  projectId: string;
  projectName: string;
  verdict: "ship" | "no-ship" | "review";
  score: number;
  checks: ShipCheck[];
  badges: ShipBadges;
  timestamp: string;
  expiresAt: string;
  permalink: string;
  embedCode: string;
}
export interface ShipBadges {
  main: string;
  mockData: string;
  realApi: string;
  envVars: string;
  billing: string;
  database: string;
  oauth: string;
  combined: string;
}
export interface ShipBadgeConfig {
  projectPath: string;
  projectName?: string;
  checks?: string[];
  outputDir?: string;
  baseUrl?: string;
}
export declare class ShipBadgeGenerator {
  /**
   * Run all ship checks and generate badges
   */
  generateShipBadge(config: ShipBadgeConfig): Promise<ShipBadgeResult>;
  /**
   * Run all ship-worthiness checks
   */
  private runAllChecks;
  /**
   * Check for mock data patterns
   */
  private checkNoMockData;
  /**
   * Check for localhost/ngrok URLs
   */
  private checkNoLocalhost;
  /**
   * Check for required environment variables
   */
  private checkEnvVars;
  /**
   * Check for real billing (not demo/test)
   */
  private checkRealBilling;
  /**
   * Check for real database connection
   */
  private checkRealDatabase;
  /**
   * Check OAuth callback URLs
   */
  private checkOAuthCallbacks;
  /**
   * Calculate overall verdict
   */
  private calculateVerdict;
  /**
   * Generate all badge SVGs
   */
  private generateAllBadges;
  /**
   * Create a single check badge
   */
  private createCheckBadge;
  /**
   * Create a combined badge strip
   */
  private createCombinedBadge;
  /**
   * Create SVG badge
   */
  private createBadge;
  /**
   * Generate embed code for README
   */
  private generateEmbedCode;
  /**
   * Save badges to directory
   */
  private saveBadges;
  /**
   * Generate project ID from path
   */
  private generateProjectId;
  /**
   * Find source files
   */
  private findSourceFiles;
  /**
   * Check if file is a test file
   */
  private isTestFile;
  /**
   * Escape HTML entities
   */
  private escapeHtml;
  /**
   * Generate human-readable report
   */
  generateReport(result: ShipBadgeResult): string;
}
export declare const shipBadgeGenerator: ShipBadgeGenerator;
//# sourceMappingURL=ship-badge-generator.d.ts.map
