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

import * as fs from "fs";
import * as path from "path";
import {
  STRIPE_PK_TEST_PREFIX,
  STRIPE_TEST_PREFIX,
  stripeTestSkPkTestOrGenericTestKeyRegex,
} from "guardrail-security/secrets/stripe-placeholder-prefix";
import { TrafficClassifier } from "./traffic-classifier";
import { FakeSuccessDetector } from "./fake-success-detector";
import { AuthEnforcer } from "./auth-enforcer";
import {
  FakePattern,
  InterceptedRequest,
  InterceptedResponse,
  UserAction,
  FakeDetection,
  ReplayStep,
  RealityModeResult,
  RealityModeConfig,
  TrafficClassification,
  FakeSuccessResult,
} from "./types";

// Export constants that are used in the generated test
export const FAKE_DOMAIN_PATTERNS = [
  /localhost:\d+/i,
  /127\.0\.0\.1:\d+/i,
  /jsonplaceholder\.typicode\.com/i,
  /reqres\.in/i,
  /mockapi\.io/i,
  /mocky\.io/i,
  /httpbin\.org/i,
  /\.ngrok\.io/i,
  /\.ngrok-free\.app/i,
  /staging\./i,
  /\.local\//i,
  /\.test\//i,
  /api\.example\.com/i,
  /fake\.api/i,
  /demo\.api/i,
];

export const FAKE_RESPONSE_PATTERNS = [
  { pattern: /inv_demo_/i, name: "Demo invoice ID" },
  { pattern: /user_demo_/i, name: "Demo user ID" },
  { pattern: /cus_demo_/i, name: "Demo customer ID" },
  { pattern: /sub_demo_/i, name: "Demo subscription ID" },
  { pattern: new RegExp(STRIPE_TEST_PREFIX, "i"), name: "Test Stripe key" },
  {
    pattern: new RegExp(STRIPE_PK_TEST_PREFIX, "i"),
    name: "Test Stripe public key",
  },
  { pattern: /"success":\s*true.*"demo"/i, name: "Demo success response" },
  { pattern: /lorem\s+ipsum/i, name: "Lorem ipsum placeholder" },
  { pattern: /john\.doe|jane\.doe/i, name: "Placeholder name" },
  { pattern: /user@example\.com/i, name: "Placeholder email" },
  { pattern: /placeholder\.(com|jpg|png)/i, name: "Placeholder domain/image" },
  {
    pattern: /"id":\s*("demo"|"test"|"fake"|1234567890)/i,
    name: "Fake ID pattern",
  },
  { pattern: /"status":\s*"simulated"/i, name: "Simulated status" },
  { pattern: /"mock":\s*true/i, name: "Mock flag enabled" },
  { pattern: /"isDemo":\s*true/i, name: "Demo mode flag" },
];

export const SILENT_FALLBACK_PATTERNS = [
  {
    pattern: /"error":\s*null.*"data":\s*\[\]/i,
    name: "Empty success on error",
  },
  {
    pattern: /catch.*return\s*\{\s*success:\s*true/i,
    name: "Success on catch",
  },
  { pattern: /"fallback":\s*true/i, name: "Fallback flag" },
];

export const DEFAULT_FAKE_PATTERNS: FakePattern[] = [
  // Fake domain patterns
  {
    id: "fake-api-domain",
    name: "Mock Backend (Domain)",
    description: "Request to a mock/staging/localhost API domain",
    severity: "critical",
    detect: (item) => {
      if (item.type !== "request") return false;
      return FAKE_DOMAIN_PATTERNS.some((p) => p.test(item.url));
    },
  },
  // Demo response patterns
  {
    id: "demo-response-data",
    name: "Mock Backend (Data)",
    description: "Response contains demo/placeholder data",
    severity: "critical",
    detect: (item) => {
      if (item.type !== "response" || !item.body) return false;
      return FAKE_RESPONSE_PATTERNS.some(({ pattern }) =>
        pattern.test(item.body!),
      );
    },
  },
  // Silent fallback
  {
    id: "silent-fallback-success",
    name: "Fake Success (Fallback)",
    description:
      "Code silently returns success on error (catch returns default)",
    severity: "warning",
    detect: (item) => {
      if (item.type !== "response" || !item.body) return false;
      return SILENT_FALLBACK_PATTERNS.some(({ pattern }) =>
        pattern.test(item.body!),
      );
    },
  },
  // HTTP status checks
  {
    id: "mock-status-code",
    name: "Mock Backend (Status)",
    description: "Response with unusual status indicating mock (418, 999)",
    severity: "warning",
    detect: (item) => {
      if (item.type !== "response") return false;
      return [418, 999, 0].includes(item.status);
    },
  },
  // Test keys in production
  {
    id: "test-api-keys",
    name: "Security Risk (Test Keys)",
    description: "Test/demo API keys detected in request or response",
    severity: "critical",
    detect: (item) => {
      const content =
        item.type === "request"
          ? JSON.stringify(item.headers) + (item.body || "")
          : item.body || "";
      return stripeTestSkPkTestOrGenericTestKeyRegex().test(content);
    },
  },
  // Billing simulation
  {
    id: "simulated-billing",
    name: "Mock Backend (Billing)",
    description: "Billing/payment response appears to be simulated",
    severity: "critical",
    detect: (item) => {
      if (item.type !== "response" || !item.body) return false;
      const billingUrls = /stripe|billing|payment|checkout|subscription/i;
      const isBillingEndpoint = billingUrls.test(item.url);
      const hasDemoData = /demo|test|simulate|fake|mock/i.test(item.body);
      return isBillingEndpoint && hasDemoData;
    },
  },
];

export class RealityScanner {
  private config: Partial<RealityModeConfig>;
  private trafficClassifier: TrafficClassifier;
  private fakeSuccessDetector: FakeSuccessDetector;
  private authEnforcer: AuthEnforcer;

  constructor(config: Partial<RealityModeConfig> = {}) {
    this.config = {
      timeout: 30000,
      patterns: DEFAULT_FAKE_PATTERNS,
      screenshotOnDetection: true,
      headless: true,
      checkAuth: true,
      ...config,
    };
    this.trafficClassifier = new TrafficClassifier(
      this.config.patterns || DEFAULT_FAKE_PATTERNS,
    );
    this.fakeSuccessDetector = new FakeSuccessDetector();
    this.authEnforcer = new AuthEnforcer();
  }

  /**
   * Generate Playwright test code for Reality Mode scanning
   */
  generatePlaywrightTest(config: {
    baseUrl: string;
    clickPaths: string[][];
    outputDir: string;
  }): string {
    const { baseUrl, clickPaths, outputDir } = config;
    const authTestCode = this.config.checkAuth
      ? this.authEnforcer.generateAuthCheckTest({ baseUrl, outputDir })
      : "";

    return `/**
 * Reality Mode - Auto-generated Playwright Test
 * 
 * This test runs your app and intercepts all network calls to detect fake data.
 * Generated by guardrail Reality Mode.
 */

import { test, expect, Page, Request, Response } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const FAKE_DOMAIN_PATTERNS = ${JSON.stringify(
      FAKE_DOMAIN_PATTERNS.map((r) => r.source),
      null,
      2,
    )};

const FAKE_RESPONSE_PATTERNS = ${JSON.stringify(FAKE_RESPONSE_PATTERNS, null, 2)};

interface Detection {
  type: string;
  severity: 'critical' | 'warning';
  url: string;
  evidence: string;
  timestamp: number;
}

interface ReplayStep {
  timestamp: number;
  type: 'request' | 'response' | 'action' | 'console';
  data: any;
  detections: Detection[];
  screenshot?: string;
}

test.describe('Reality Mode Scan', () => {
  let detections: Detection[] = [];
  let replay: ReplayStep[] = [];
  
  test.beforeEach(async ({ page }) => {
    detections = [];
    replay = [];
    
    // Capture console logs
    page.on('console', msg => {
      replay.push({
        timestamp: Date.now(),
        type: 'console',
        data: { type: msg.type(), text: msg.text() },
        detections: []
      });
    });

    // Intercept all network requests
    page.on('request', (request: Request) => {
      const url = request.url();
      // Skip static assets to reduce noise
      if (url.match(/\\.(js|css|png|jpg|svg|ico|woff|woff2|ttf)$/)) return;

      const step: ReplayStep = {
        timestamp: Date.now(),
        type: 'request',
        data: { url, method: request.method(), headers: request.headers() },
        detections: []
      };
      
      // Check for fake domains
      for (const pattern of FAKE_DOMAIN_PATTERNS) {
        if (new RegExp(pattern, 'i').test(url)) {
          const detection: Detection = {
            type: 'fake-api-domain',
            severity: 'critical',
            url,
            evidence: \`URL matches fake domain pattern: \${pattern}\`,
            timestamp: Date.now()
          };
          step.detections.push(detection);
          detections.push(detection);
        }
      }
      
      replay.push(step);
    });
    
    page.on('response', async (response: Response) => {
      const url = response.url();
      if (url.match(/\\.(js|css|png|jpg|svg|ico|woff|woff2|ttf)$/)) return;

      let body = '';
      
      try {
        body = await response.text();
      } catch (e) {
        // Some responses can't be read
      }
      
      const step: ReplayStep = {
        timestamp: Date.now(),
        type: 'response',
        data: { url, status: response.status(), bodyPreview: body.slice(0, 500) },
        detections: []
      };
      
      // Check for demo data patterns
      for (const { pattern, name } of FAKE_RESPONSE_PATTERNS) {
        if (new RegExp(pattern.source || pattern, 'i').test(body)) {
          const detection: Detection = {
            type: 'demo-response-data',
            severity: 'critical',
            url,
            evidence: \`Response contains \${name}\`,
            timestamp: Date.now()
          };
          step.detections.push(detection);
          detections.push(detection);
        }
      }
      
      replay.push(step);
    });
  });
  
  test('should detect fake data in production flow', async ({ page }) => {
    // Navigate to the app
    await page.goto('${baseUrl}');
    
    // Initial screenshot
    const initScreenshot = \`init-\${Date.now()}.png\`;
    const outputDir = '${outputDir.replace(/\\/g, "\\\\")}';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    await page.screenshot({ path: path.join(outputDir, initScreenshot) });

    replay.push({
      timestamp: Date.now(),
      type: 'action',
      data: { type: 'navigation', url: '${baseUrl}' },
      detections: [],
      screenshot: initScreenshot
    });
    
    // Execute click paths
    const clickPaths = ${JSON.stringify(clickPaths, null, 4)};
    
    for (const path of clickPaths) {
      for (const selector of path) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.click(selector);
          
          // Wait for network activity to settle
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          
          // Take screenshot after action
          const stepScreenshot = \`step-\${Date.now()}.png\`;
          await page.screenshot({ path: path.join(outputDir, stepScreenshot) });

          replay.push({
            timestamp: Date.now(),
            type: 'action',
            data: { type: 'click', selector },
            detections: [],
            screenshot: stepScreenshot
          });
          
        } catch (e) {
          // Selector not found, skip
        }
      }
    }
    
    // Save raw replay data for post-analysis
    fs.writeFileSync(
      path.join(outputDir, 'reality-replay.json'),
      JSON.stringify(replay, null, 2)
    );
    
    // Fail if critical fake data detected (NO-GO)
    // Warnings do NOT fail the build (GO/WARN)
    const criticalIssues = detections.filter(d => d.severity === 'critical');
    
    if (criticalIssues.length > 0) {
      console.log(\`\\n  🛑 NO-GO: Found \${criticalIssues.length} critical reality issues.\`);
      criticalIssues.forEach(d => console.log(\`     - \${d.evidence} (\${d.url})\`));
    }
    
    expect(criticalIssues.length, \`Found \${criticalIssues.length} critical fake data issues\`).toBe(0);
  });

  ${authTestCode}
});
`;
  }

  /**
   * Post-process the replay to apply advanced detection logic
   */
  processReplay(
    replay: ReplayStep[],
    authViolations: any[] = [],
  ): RealityModeResult {
    const trafficAnalysis: TrafficClassification[] = [];
    const fakeSuccessResults = this.fakeSuccessDetector.detect(replay);
    const detections: FakeDetection[] = [];

    // 1. Analyze Traffic (Green/Yellow/Red)
    const responseHistory = new Map<string, string>(); // url -> body hash/content
    let hasMutation = false;

    for (const step of replay) {
      if (step.type === "request") {
        const req = {
          type: "request",
          url: step.data.url,
          method: step.data.method,
          headers: step.data.headers || {},
          timestamp: step.timestamp,
        } as InterceptedRequest;

        if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
          hasMutation = true;
        }

        // Find corresponding response? (Simplification: analyze request independently first)
        const classification = this.trafficClassifier.classify(req);
        trafficAnalysis.push(classification);

        // Convert classifier reasons to detections
        if (classification.verdict === "red") {
          detections.push({
            pattern: {
              id: "traffic-classifier-red",
              name: "Fake Traffic",
              description: classification.reasons.join(", "),
              severity: "critical",
              detect: () => true,
            },
            request: req,
            timestamp: step.timestamp,
            evidence: classification.reasons.join(", "),
          });
        }
      } else if (step.type === "response") {
        const res = {
          type: "response",
          url: step.data.url,
          status: step.data.status,
          headers: {},
          body: step.data.bodyPreview,
          timestamp: step.timestamp,
        } as InterceptedResponse;

        const classification = this.trafficClassifier.classify(
          {
            type: "request",
            url: res.url,
            method: "GET",
            headers: {},
            timestamp: 0,
          },
          res,
        );
        trafficAnalysis.push(classification);

        if (classification.verdict === "red") {
          detections.push({
            pattern: {
              id: "traffic-classifier-red-res",
              name: "Fake Response",
              description: classification.reasons.join(", "),
              severity: "critical",
              detect: () => true,
            },
            response: res,
            timestamp: step.timestamp,
            evidence: classification.reasons.join(", "),
          });
        }

        // Consistency Check (Fake Mutation)
        // If we have seen this URL before, and there was a mutation, the body should ideally change
        if (
          hasMutation &&
          responseHistory.has(res.url) &&
          responseHistory.get(res.url) === res.body
        ) {
          // Ignore static assets/config
          if (
            !res.url.includes("/config") &&
            !res.url.includes("/me") &&
            !res.url.includes(".json")
          ) {
            const warning: TrafficClassification = {
              verdict: "yellow",
              score: 70,
              reasons: [
                `Data for ${res.url} did not change after a write operation (Fake Mutation?)`,
              ],
            };
            trafficAnalysis.push(warning);
          }
        }
        responseHistory.set(res.url, res.body || "");
      }
    }

    // 2. Score Calculation
    let score = 100;
    score -= detections.length * 10;
    score -= fakeSuccessResults.filter((f) => f.isFake).length * 20;
    score -= authViolations.length * 25; // Auth violations are heavy penalties

    // Penalize Red Traffic (Mock Backend / No-Wire)
    const redTraffic = trafficAnalysis.filter((t) => t.verdict === "red");
    score -= redTraffic.length * 15;

    score = Math.max(0, score);

    const verdict = score > 80 ? "real" : score > 50 ? "suspicious" : "fake";

    return {
      verdict,
      score,
      detections,
      replay,
      trafficAnalysis,
      fakeSuccessAnalysis: fakeSuccessResults,
      authViolations,
      summary: {
        totalRequests: replay.filter((r) => r.type === "request").length,
        fakeRequests: detections.length + redTraffic.length,
        totalActions: replay.filter((r) => r.type === "action").length,
        criticalIssues:
          detections.length +
          redTraffic.length +
          fakeSuccessResults.filter((f) => f.isFake).length +
          authViolations.length,
        warnings: fakeSuccessResults.filter((f) => f.isFake).length,
      },
      timestamp: new Date().toISOString(),
      duration: 0,
    };
  }

  generateReport(result: RealityModeResult): string {
    // This is now handled by ReportGenerator, but we keep a simple string version for console output if needed
    return `Reality Check Complete. Score: ${result.score}/100. Verdict: ${result.verdict.toUpperCase()}`;
  }

  generateDefaultClickPaths(): string[][] {
    return [
      // 1. Login / Auth Flow
      [
        'input[name="email"]',
        'input[name="password"]',
        'button[type="submit"]',
        '[data-testid="login-submit"]',
      ],
      // 2. Dashboard Access
      ['[href*="/dashboard"]', '[data-testid="nav-dashboard"]'],
      // 3. View Report/Runs
      ['[href*="/runs"]', '[href*="/reports"]', '[data-testid="view-report"]'],
      // 4. Open Findings/Details
      ['[data-testid="finding-item"]', 'tr[role="row"]'],
      // 5. Settings / Configuration (Write actions often live here)
      [
        '[href*="/settings"]',
        '[data-testid="nav-settings"]',
        'button:has-text("Save")',
        '[data-testid="save-changes"]',
      ],
    ];
  }
}

export const realityScanner = new RealityScanner();
