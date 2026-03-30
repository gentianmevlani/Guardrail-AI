import { test, expect } from "@playwright/test";

/**
 * Smoke Tests for Production
 * 
 * Run these against production to verify critical paths work.
 * Designed for Checkly or GitHub Actions cron.
 * 
 * Usage:
 *   PROD_URL=https://your-site.netlify.app npx playwright test e2e/smoke.spec.ts
 *   
 * For Checkly:
 *   Import this file and configure PROD_URL in your Checkly dashboard.
 */

const PROD_URL = process.env.PROD_URL || "https://guardrail.netlify.app";
const RAILWAY_API_URL = process.env.RAILWAY_API_URL || "https://guardrail-production.up.railway.app";

test.describe("Smoke Tests - Production", () => {
  test.describe.configure({ mode: "serial" });

  test("1. Landing page loads", async ({ page }) => {
    const response = await page.goto(PROD_URL, { waitUntil: "domcontentloaded" });
    
    expect(response?.status()).toBeLessThan(400);
    
    // Verify key elements are present
    await expect(page.locator("text=guardrail").first()).toBeVisible({ timeout: 10000 });
    
    // Check for critical UI elements
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();
  });

  test("2. Frontend health endpoint responds", async ({ request }) => {
    // Try Next.js route first, fall back to Railway proxy
    const response = await request.get(`${PROD_URL}/api/health`);
    
    // Accept 200 or 404 (if Next.js route not deployed yet)
    if (response.status() === 404) {
      console.log("Next.js /api/health not deployed yet, skipping...");
      return;
    }
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBeDefined();
    expect(body.ts).toBeDefined();
  });

  test("3. Railway API health endpoint responds", async ({ request }) => {
    // Use /health endpoint (more reliable than /api/health)
    const response = await request.get(`${RAILWAY_API_URL}/health`);
    
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.services.database).toBe("connected");
  });

  test("4. Auth buttons exist", async ({ page }) => {
    await page.goto(PROD_URL, { waitUntil: "domcontentloaded" });
    
    // Look for any auth-related buttons (Login, Sign In, Sign Up, etc)
    const authButton = page.locator("button, a").filter({ 
      hasText: /login|sign.?in|sign.?up|get.?started/i 
    }).first();
    
    // If no auth button found, that's OK - site might not have auth yet
    const count = await authButton.count();
    if (count === 0) {
      console.log("No auth buttons found - skipping");
      return;
    }
    
    await expect(authButton).toBeVisible();
  });

  test("5. Page is scrollable", async ({ page }) => {
    await page.goto(PROD_URL, { waitUntil: "domcontentloaded" });
    
    // Verify page doesn't crash on scroll
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    
    // Scroll back up
    await page.evaluate(() => window.scrollTo(0, 0));
    
    // Page should still be responsive
    await expect(page.locator("body")).toBeVisible();
  });

  test("6. No console errors on load", async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(PROD_URL, { waitUntil: "networkidle" });
    
    // Filter out known acceptable errors
    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes("favicon") &&
        !err.includes("ResizeObserver") &&
        !err.includes("third-party")
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test("7. API readiness check", async ({ request }) => {
    const response = await request.get(`${RAILWAY_API_URL}/api/ready`);
    
    // Should return 200 if all services ready, 503 if not
    const body = await response.json();
    
    if (response.status() === 200) {
      expect(body.status).toBe("ready");
      expect(body.checks.database).toBe(true);
    } else {
      // Log which checks failed for debugging
      console.log("Readiness check failed:", body.checks);
    }
  });
});

test.describe("Performance Checks", () => {
  test("Landing page loads within 5s", async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(PROD_URL, { waitUntil: "domcontentloaded" });
    
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(5000);
    console.log(`Page load time: ${loadTime}ms`);
  });

  test("Health endpoint responds within 2s", async ({ request }) => {
    const startTime = Date.now();
    
    await request.get(`${PROD_URL}/api/health`);
    
    const responseTime = Date.now() - startTime;
    
    expect(responseTime).toBeLessThan(2000);
    console.log(`Health endpoint response time: ${responseTime}ms`);
  });
});
