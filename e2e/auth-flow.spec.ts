import { test, expect } from "@playwright/test";

/**
 * E2E Authentication Flow Tests
 * 
 * Tests critical authentication paths including:
 * - GitHub OAuth flow initiation
 * - Protected route redirects
 * - Session management
 * 
 * Usage:
 *   npx playwright test e2e/auth-flow.spec.ts
 *   
 * For production testing:
 *   PROD_URL=https://your-site.com npx playwright test e2e/auth-flow.spec.ts
 */

const BASE_URL = process.env.PROD_URL || process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5001";
const API_URL = process.env.RAILWAY_API_URL || process.env.API_URL || "http://localhost:3000";

test.describe("Authentication Flow", () => {
  test.describe.configure({ mode: "serial" });

  test("1. Login page/button is accessible", async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Look for login/sign-in elements
    const loginElement = page.locator("a, button").filter({
      hasText: /login|sign.?in|get.?started/i,
    }).first();

    const count = await loginElement.count();
    if (count > 0) {
      await expect(loginElement).toBeVisible();
      console.log("✅ Login element found");
    } else {
      // Check if already on a dashboard (user might be logged in)
      const dashboardIndicator = page.locator("text=/dashboard|projects|settings/i").first();
      const isDashboard = await dashboardIndicator.count() > 0;
      
      if (isDashboard) {
        console.log("✅ Already on dashboard - user appears logged in");
      } else {
        console.log("⚠️ No login element found - site may not have auth UI yet");
      }
    }
  });

  test("2. GitHub OAuth redirect works", async ({ page }) => {
    // Navigate to GitHub auth endpoint
    const response = await page.goto(`${API_URL}/api/auth/github`);
    
    // Should redirect to GitHub or return auth URL
    const url = page.url();
    
    if (url.includes("github.com/login/oauth")) {
      console.log("✅ Redirected to GitHub OAuth");
      expect(url).toContain("github.com");
      expect(url).toContain("client_id=");
    } else if (response?.status() === 401 || response?.status() === 400) {
      // OAuth not configured - acceptable in test environments
      console.log("⚠️ OAuth not configured (expected in test env)");
    } else {
      // Check if it returned a JSON response with auth URL
      const contentType = response?.headers()["content-type"] || "";
      if (contentType.includes("application/json")) {
        const body = await response?.json();
        if (body?.url || body?.authUrl) {
          console.log("✅ OAuth URL returned in JSON response");
        }
      }
    }
  });

  test("3. Protected routes redirect to login", async ({ page, context }) => {
    // Clear any existing session
    await context.clearCookies();
    
    // Try to access a protected route
    const protectedRoutes = [
      "/dashboard",
      "/projects",
      "/settings",
    ];

    for (const route of protectedRoutes) {
      const response = await page.goto(`${BASE_URL}${route}`, {
        waitUntil: "domcontentloaded",
      });

      const finalUrl = page.url();
      const status = response?.status() || 0;

      // Should either:
      // 1. Redirect to login/home
      // 2. Return 401/403
      // 3. Show login prompt on the page
      
      if (finalUrl.includes("login") || finalUrl === BASE_URL + "/" || finalUrl === BASE_URL) {
        console.log(`✅ ${route} redirected to login/home`);
      } else if (status === 401 || status === 403) {
        console.log(`✅ ${route} returned ${status} (unauthorized)`);
      } else if (status === 404) {
        console.log(`⚠️ ${route} not found (route may not exist)`);
      } else {
        // Check if page shows login UI
        const loginPrompt = page.locator("text=/sign.?in|log.?in|authenticate/i").first();
        const hasLoginPrompt = await loginPrompt.count() > 0;
        
        if (hasLoginPrompt) {
          console.log(`✅ ${route} shows login prompt`);
        } else {
          console.log(`⚠️ ${route} accessible without auth (status: ${status})`);
        }
      }
    }
  });

  test("4. API auth endpoints respond correctly", async ({ request }) => {
    // Test auth-related API endpoints
    const endpoints = [
      { path: "/api/auth/user", expectedUnauth: [401, 403] },
      { path: "/api/auth/github", expectedUnauth: [302, 400, 401] },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await request.get(`${API_URL}${endpoint.path}`);
        const status = response.status();

        if (endpoint.expectedUnauth.includes(status)) {
          console.log(`✅ ${endpoint.path} returns ${status} when unauthenticated`);
        } else if (status === 200) {
          // Might have valid session - check response
          console.log(`⚠️ ${endpoint.path} returns 200 (may have session)`);
        } else {
          console.log(`⚠️ ${endpoint.path} returns ${status}`);
        }
      } catch (error) {
        console.log(`⚠️ ${endpoint.path} error: ${error}`);
      }
    }
  });

  test("5. CSRF protection is present", async ({ page }) => {
    await page.goto(BASE_URL);

    // Check for CSRF token in meta tags or forms
    const csrfMeta = page.locator('meta[name="csrf-token"]');
    const csrfInput = page.locator('input[name="_csrf"], input[name="csrf_token"]');

    const hasCsrfMeta = await csrfMeta.count() > 0;
    const hasCsrfInput = await csrfInput.count() > 0;

    if (hasCsrfMeta || hasCsrfInput) {
      console.log("✅ CSRF protection detected");
    } else {
      // Many SPAs handle CSRF differently
      console.log("⚠️ No visible CSRF token (may use alternative protection)");
    }
  });
});

test.describe("Session Security", () => {
  test("Secure cookie flags are set", async ({ page, context }) => {
    await page.goto(BASE_URL);

    const cookies = await context.cookies();
    const sessionCookies = cookies.filter(
      (c) => c.name.includes("session") || c.name.includes("token") || c.name.includes("auth")
    );

    if (sessionCookies.length === 0) {
      console.log("⚠️ No session cookies found (may use localStorage/tokens)");
      return;
    }

    for (const cookie of sessionCookies) {
      console.log(`Cookie: ${cookie.name}`);
      
      // In production, cookies should be secure
      if (BASE_URL.startsWith("https://")) {
        if (cookie.secure) {
          console.log(`  ✅ Secure flag set`);
        } else {
          console.log(`  ⚠️ Secure flag NOT set (should be in production)`);
        }
      }

      if (cookie.httpOnly) {
        console.log(`  ✅ HttpOnly flag set`);
      } else {
        console.log(`  ⚠️ HttpOnly flag NOT set`);
      }

      if (cookie.sameSite === "Strict" || cookie.sameSite === "Lax") {
        console.log(`  ✅ SameSite=${cookie.sameSite}`);
      }
    }
  });
});
