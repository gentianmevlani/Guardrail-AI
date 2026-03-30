/**
 * Reality Mode - Runtime Fake Detection
 *
 * "Stop shipping pretend features. guardrail runs your app and catches the lies."
 *
 * This module spins up the app, intercepts network calls, clicks through the UI,
 * and detects:
 * - Calls to localhost, jsonplaceholder, staging domains, ngrok
 * - Routes returning demo/placeholder responses
 * - Silent fallback success patterns
 * - Mock billing and fake invoice IDs
 *
 * The killer feature: a "flight recorder" replay showing exactly what happened.
 */
export interface FakePattern {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "warning" | "info";
  detect: (request: InterceptedRequest | InterceptedResponse) => boolean;
}
export interface InterceptedRequest {
  type: "request";
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
}
export interface InterceptedResponse {
  type: "response";
  url: string;
  status: number;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
}
export interface UserAction {
  type: "click" | "input" | "navigation" | "scroll";
  selector?: string;
  value?: string;
  url?: string;
  timestamp: number;
  screenshot?: string;
}
export interface FakeDetection {
  pattern: FakePattern;
  request?: InterceptedRequest;
  response?: InterceptedResponse;
  action?: UserAction;
  timestamp: number;
  evidence: string;
}
export interface ReplayStep {
  timestamp: number;
  action?: UserAction;
  request?: InterceptedRequest;
  response?: InterceptedResponse;
  detections: FakeDetection[];
  screenshot?: string;
}
export interface RealityModeResult {
  verdict: "real" | "fake" | "suspicious";
  score: number;
  detections: FakeDetection[];
  replay: ReplayStep[];
  summary: {
    totalRequests: number;
    fakeRequests: number;
    totalActions: number;
    criticalIssues: number;
    warnings: number;
  };
  timestamp: string;
  duration: number;
}
export interface RealityModeConfig {
  baseUrl: string;
  timeout: number;
  patterns: FakePattern[];
  clickPaths: string[][];
  screenshotOnDetection: boolean;
  headless: boolean;
}
export declare const DEFAULT_FAKE_PATTERNS: FakePattern[];
export declare class RealityScanner {
  private config;
  private replay;
  private detections;
  private requests;
  private responses;
  private actions;
  constructor(config?: Partial<RealityModeConfig>);
  /**
   * Generate Playwright test code for Reality Mode scanning
   */
  generatePlaywrightTest(config: {
    baseUrl: string;
    clickPaths: string[][];
    outputDir: string;
  }): string;
  /**
   * Analyze intercepted network traffic for fake patterns
   */
  analyzeTraffic(
    requests: InterceptedRequest[],
    responses: InterceptedResponse[],
  ): FakeDetection[];
  /**
   * Generate evidence description for a detection
   */
  private getEvidence;
  /**
   * Generate a human-readable Reality Mode report
   */
  generateReport(result: RealityModeResult): string;
  /**
   * Generate common click paths for testing
   */
  generateDefaultClickPaths(): string[][];
}
export declare const realityScanner: RealityScanner;
//# sourceMappingURL=reality-scanner.d.ts.map
