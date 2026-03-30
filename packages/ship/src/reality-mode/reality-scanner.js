"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.realityScanner =
  exports.RealityScanner =
  exports.DEFAULT_FAKE_PATTERNS =
    void 0;
const {
  STRIPE_PK_TEST_PREFIX,
  STRIPE_TEST_PREFIX,
  stripeTestSkPkTestOrGenericTestKeyRegex,
} = require("../../../../bin/runners/lib/stripe-scan-patterns.js");
const FAKE_DOMAIN_PATTERNS = [
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
const FAKE_RESPONSE_PATTERNS = [
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
const SILENT_FALLBACK_PATTERNS = [
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
exports.DEFAULT_FAKE_PATTERNS = [
  // Fake domain patterns
  {
    id: "fake-api-domain",
    name: "Fake API Domain",
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
    name: "Demo Response Data",
    description: "Response contains demo/placeholder data",
    severity: "critical",
    detect: (item) => {
      if (item.type !== "response" || !item.body) return false;
      return FAKE_RESPONSE_PATTERNS.some(({ pattern }) =>
        pattern.test(item.body),
      );
    },
  },
  // Silent fallback
  {
    id: "silent-fallback-success",
    name: "Silent Fallback Success",
    description:
      "Code silently returns success on error (catch returns default)",
    severity: "warning",
    detect: (item) => {
      if (item.type !== "response" || !item.body) return false;
      return SILENT_FALLBACK_PATTERNS.some(({ pattern }) =>
        pattern.test(item.body),
      );
    },
  },
  // HTTP status checks
  {
    id: "mock-status-code",
    name: "Mock Status Code",
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
    name: "Test API Keys",
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
    name: "Simulated Billing",
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
class RealityScanner {
  config;
  replay = [];
  detections = [];
  requests = [];
  responses = [];
  actions = [];
  constructor(config = {}) {
    this.config = {
      timeout: 30000,
      patterns: exports.DEFAULT_FAKE_PATTERNS,
      screenshotOnDetection: true,
      headless: true,
      ...config,
    };
  }
  /**
   * Generate Playwright test code for Reality Mode scanning
   */
  generatePlaywrightTest(config) {
    const { baseUrl, clickPaths, outputDir } = config;
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
  type: 'fake-domain' | 'demo-data' | 'simulated-billing' | 'test-keys';
  url: string;
  evidence: string;
  timestamp: number;
}

interface ReplayStep {
  timestamp: number;
  type: 'request' | 'response' | 'action';
  data: any;
  detections: Detection[];
}

test.describe('Reality Mode Scan', () => {
  let detections: Detection[] = [];
  let replay: ReplayStep[] = [];
  
  test.beforeEach(async ({ page }) => {
    detections = [];
    replay = [];
    
    // Intercept all network requests
    page.on('request', (request: Request) => {
      const url = request.url();
      const step: ReplayStep = {
        timestamp: Date.now(),
        type: 'request',
        data: { url, method: request.method() },
        detections: []
      };
      
      // Check for fake domains
      for (const pattern of FAKE_DOMAIN_PATTERNS) {
        if (new RegExp(pattern, 'i').test(url)) {
          const detection: Detection = {
            type: 'fake-domain',
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
            type: 'demo-data',
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
    
    replay.push({
      timestamp: Date.now(),
      type: 'action',
      data: { type: 'navigation', url: '${baseUrl}' },
      detections: []
    });
    
    // Execute click paths
    const clickPaths = ${JSON.stringify(clickPaths, null, 4)};
    
    for (const path of clickPaths) {
      for (const selector of path) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.click(selector);
          
          replay.push({
            timestamp: Date.now(),
            type: 'action',
            data: { type: 'click', selector },
            detections: []
          });
          
          // Wait for network activity to settle
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        } catch (e) {
          // Selector not found, skip
        }
      }
    }
    
    // Save results
    const result = {
      verdict: detections.length > 0 ? 'fake' : 'real',
      score: Math.max(0, 100 - detections.length * 10),
      detections,
      replay,
      summary: {
        totalRequests: replay.filter(r => r.type === 'request').length,
        fakeRequests: detections.filter(d => d.type === 'fake-domain').length,
        totalActions: replay.filter(r => r.type === 'action').length,
        criticalIssues: detections.length
      },
      timestamp: new Date().toISOString()
    };
    
    // Write results
    const outputDir = '${outputDir.replace(/\\/g, "\\\\")}';
    await fs.promises.mkdir(outputDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(outputDir, 'reality-mode-result.json'),
      JSON.stringify(result, null, 2)
    );
    
    // Generate human-readable report
    const report = generateReport(result);
    await fs.promises.writeFile(
      path.join(outputDir, 'reality-mode-report.txt'),
      report
    );
    
    // Fail if fake data detected
    expect(detections.length, \`Found \${detections.length} fake data issues\`).toBe(0);
  });
});

function generateReport(result: any): string {
  const lines: string[] = [];
  
  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║            🔍 Reality Mode Scan Results 🔍                   ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');
  
  if (result.verdict === 'real') {
    lines.push('✅ VERDICT: REAL - No fake data detected!');
    lines.push('');
    lines.push('   Your app is shipping real features.');
  } else {
    lines.push('❌ VERDICT: FAKE - Fake data detected!');
    lines.push('');
    lines.push(\`   Found \${result.detections.length} issues that indicate fake/mock data.\`);
    lines.push('');
    lines.push('─'.repeat(64));
    lines.push('');
    lines.push('DETECTIONS:');
    lines.push('');
    
    for (const detection of result.detections) {
      lines.push(\`   ❌ \${detection.type.toUpperCase()}\`);
      lines.push(\`      URL: \${detection.url}\`);
      lines.push(\`      Evidence: \${detection.evidence}\`);
      lines.push('');
    }
  }
  
  lines.push('─'.repeat(64));
  lines.push(\`Score: \${result.score}/100\`);
  lines.push(\`Total requests intercepted: \${result.summary.totalRequests}\`);
  lines.push(\`Actions performed: \${result.summary.totalActions}\`);
  lines.push(\`Generated: \${result.timestamp}\`);
  
  return lines.join('\\n');
}
`;
  }
  /**
   * Analyze intercepted network traffic for fake patterns
   */
  analyzeTraffic(requests, responses) {
    const detections = [];
    const patterns = this.config.patterns || exports.DEFAULT_FAKE_PATTERNS;
    for (const request of requests) {
      for (const pattern of patterns) {
        if (pattern.detect(request)) {
          detections.push({
            pattern,
            request,
            timestamp: request.timestamp,
            evidence: this.getEvidence(request, pattern),
          });
        }
      }
    }
    for (const response of responses) {
      for (const pattern of patterns) {
        if (pattern.detect(response)) {
          detections.push({
            pattern,
            response,
            timestamp: response.timestamp,
            evidence: this.getEvidence(response, pattern),
          });
        }
      }
    }
    return detections;
  }
  /**
   * Generate evidence description for a detection
   */
  getEvidence(item, pattern) {
    if (item.type === "request") {
      if (pattern.id === "fake-api-domain") {
        const matched = FAKE_DOMAIN_PATTERNS.find((p) => p.test(item.url));
        return `Request URL "${item.url}" matches fake domain pattern`;
      }
      return `Request to ${item.url} flagged by ${pattern.name}`;
    } else {
      if (pattern.id === "demo-response-data" && item.body) {
        const matched = FAKE_RESPONSE_PATTERNS.find(({ pattern }) =>
          pattern.test(item.body),
        );
        return `Response contains ${matched?.name || "demo data"}`;
      }
      return `Response from ${item.url} flagged by ${pattern.name}`;
    }
  }
  /**
   * Generate a human-readable Reality Mode report
   */
  generateReport(result) {
    const lines = [];
    lines.push(
      "╔══════════════════════════════════════════════════════════════╗",
    );
    lines.push(
      "║            🔍 Reality Mode Scan Results 🔍                   ║",
    );
    lines.push(
      "╚══════════════════════════════════════════════════════════════╝",
    );
    lines.push("");
    const verdictEmoji =
      result.verdict === "real"
        ? "✅"
        : result.verdict === "fake"
          ? "❌"
          : "⚠️";
    const verdictText = result.verdict.toUpperCase();
    lines.push(`${verdictEmoji} VERDICT: ${verdictText}`);
    lines.push(`   Reality Score: ${result.score}/100`);
    lines.push("");
    if (result.verdict === "real") {
      lines.push("   🎉 Congratulations! Your app is shipping real features.");
      lines.push(
        "   No fake data, mock APIs, or placeholder content detected.",
      );
    } else {
      lines.push(`   Found ${result.summary.criticalIssues} critical issues`);
      lines.push(`   Found ${result.summary.warnings} warnings`);
      lines.push("");
      lines.push("─".repeat(64));
      lines.push("");
      lines.push("DETECTIONS:");
      lines.push("");
      for (const detection of result.detections) {
        const icon = detection.pattern.severity === "critical" ? "🚨" : "⚠️";
        lines.push(`${icon} ${detection.pattern.name}`);
        lines.push(`   ${detection.pattern.description}`);
        lines.push(`   Evidence: ${detection.evidence}`);
        if (detection.request) {
          lines.push(`   URL: ${detection.request.url}`);
        }
        if (detection.response) {
          lines.push(`   URL: ${detection.response.url}`);
        }
        lines.push("");
      }
    }
    lines.push("─".repeat(64));
    lines.push("");
    lines.push("SUMMARY:");
    lines.push(
      `   Total requests intercepted: ${result.summary.totalRequests}`,
    );
    lines.push(`   Fake/mock requests: ${result.summary.fakeRequests}`);
    lines.push(`   User actions performed: ${result.summary.totalActions}`);
    lines.push(`   Scan duration: ${result.duration}ms`);
    lines.push("");
    lines.push(`Generated: ${result.timestamp}`);
    return lines.join("\n");
  }
  /**
   * Generate common click paths for testing
   */
  generateDefaultClickPaths() {
    return [
      // Auth flow
      ['[data-testid="login-button"]', '[data-testid="signup-button"]'],
      // Navigation
      ["nav a", "header a", '[role="navigation"] a'],
      // Main actions
      [
        'button[type="submit"]',
        ".cta-button",
        '[data-testid="primary-action"]',
      ],
      // Dashboard/billing
      ['[href*="dashboard"]', '[href*="billing"]', '[href*="settings"]'],
      // Checkout flow
      [
        '[data-testid="add-to-cart"]',
        '[data-testid="checkout"]',
        '[data-testid="pay"]',
      ],
    ];
  }
}
exports.RealityScanner = RealityScanner;
exports.realityScanner = new RealityScanner();
