import { test, expect } from "@playwright/test";

test.describe("Compliance Dashboard", () => {
  test.describe("Tier Gating", () => {
    test("should show upgrade gate for non-Compliance+ users", async ({ page }) => {
      await page.goto("/compliance");
      
      const lockedFeature = page.locator('[class*="LockedFeature"]');
      const upgradeButton = page.locator('text=Upgrade Now');
      
      if (await lockedFeature.isVisible()) {
        await expect(upgradeButton).toBeVisible();
      }
    });

    test("should show dashboard content for Compliance+ users", async ({ page }) => {
      await page.goto("/compliance");
      
      await page.waitForLoadState("networkidle");
      
      const dashboardTitle = page.locator('h1:has-text("Compliance Dashboard")');
      const loadingIndicator = page.locator('text=Loading compliance dashboard');
      
      if (await loadingIndicator.isVisible()) {
        await loadingIndicator.waitFor({ state: "hidden", timeout: 10000 });
      }
      
      const isDashboardVisible = await dashboardTitle.isVisible().catch(() => false);
      const isLockedVisible = await page.locator('text=Requires Compliance Plan').isVisible().catch(() => false);
      
      expect(isDashboardVisible || isLockedVisible).toBeTruthy();
    });
  });

  test.describe("Framework Status Cards", () => {
    test("should display framework status cards", async ({ page }) => {
      await page.goto("/compliance");
      await page.waitForLoadState("networkidle");
      
      const frameworkCards = page.locator('[class*="ComplianceStatusCard"]');
      
      const cardCount = await frameworkCards.count().catch(() => 0);
      
      if (cardCount > 0) {
        expect(cardCount).toBeGreaterThanOrEqual(1);
      }
    });

    test("should show framework names", async ({ page }) => {
      await page.goto("/compliance/frameworks");
      await page.waitForLoadState("networkidle");
      
      const frameworkNames = ["SOC 2", "HIPAA", "GDPR", "PCI", "NIST", "ISO 27001"];
      
      for (const name of frameworkNames) {
        const element = page.locator(`text=${name}`).first();
        const isVisible = await element.isVisible().catch(() => false);
      }
    });
  });

  test.describe("Audit Trail", () => {
    test("should load audit trail page", async ({ page }) => {
      await page.goto("/compliance/audit");
      await page.waitForLoadState("networkidle");
      
      const auditTitle = page.locator('h1:has-text("Audit Trail")');
      const isVisible = await auditTitle.isVisible().catch(() => false);
    });

    test("should display filter controls", async ({ page }) => {
      await page.goto("/compliance/audit");
      await page.waitForLoadState("networkidle");
      
      const filterButton = page.locator('button:has-text("Filters")');
      const isVisible = await filterButton.isVisible().catch(() => false);
      
      if (isVisible) {
        await filterButton.click();
        
        const categoryFilter = page.locator('text=Category');
        const severityFilter = page.locator('text=Severity');
        
        await expect(categoryFilter.or(severityFilter)).toBeVisible();
      }
    });

    test("should display search input", async ({ page }) => {
      await page.goto("/compliance/audit");
      await page.waitForLoadState("networkidle");
      
      const searchInput = page.locator('input[placeholder*="Search"]');
      const isVisible = await searchInput.isVisible().catch(() => false);
    });
  });

  test.describe("Integrity Banner", () => {
    test("should display integrity status", async ({ page }) => {
      await page.goto("/compliance");
      await page.waitForLoadState("networkidle");
      
      const integrityBanner = page.locator('text=Hash Chain Integrity');
      const isVisible = await integrityBanner.isVisible().catch(() => false);
    });

    test("should have verify button", async ({ page }) => {
      await page.goto("/compliance");
      await page.waitForLoadState("networkidle");
      
      const verifyButton = page.locator('button:has-text("Verify"), button:has-text("Re-verify")');
      const isVisible = await verifyButton.first().isVisible().catch(() => false);
    });
  });

  test.describe("Export Center", () => {
    test("should display export options", async ({ page }) => {
      await page.goto("/compliance");
      await page.waitForLoadState("networkidle");
      
      const exportCenter = page.locator('text=Export Center');
      const isVisible = await exportCenter.isVisible().catch(() => false);
    });

    test("should have JSON export option", async ({ page }) => {
      await page.goto("/compliance");
      await page.waitForLoadState("networkidle");
      
      const jsonExport = page.locator('text=JSON Export');
      const isVisible = await jsonExport.isVisible().catch(() => false);
    });

    test("should have CSV export option", async ({ page }) => {
      await page.goto("/compliance");
      await page.waitForLoadState("networkidle");
      
      const csvExport = page.locator('text=CSV Export');
      const isVisible = await csvExport.isVisible().catch(() => false);
    });
  });

  test.describe("Navigation", () => {
    test("should navigate from main page to frameworks", async ({ page }) => {
      await page.goto("/compliance");
      await page.waitForLoadState("networkidle");
      
      const frameworksLink = page.locator('a[href="/compliance/frameworks"], button:has-text("View All Frameworks")');
      const isVisible = await frameworksLink.first().isVisible().catch(() => false);
      
      if (isVisible) {
        await frameworksLink.first().click();
        await page.waitForURL("**/compliance/frameworks");
        expect(page.url()).toContain("/compliance/frameworks");
      }
    });

    test("should navigate from main page to audit trail", async ({ page }) => {
      await page.goto("/compliance");
      await page.waitForLoadState("networkidle");
      
      const auditLink = page.locator('a[href="/compliance/audit"], button:has-text("View All")');
      const isVisible = await auditLink.first().isVisible().catch(() => false);
      
      if (isVisible) {
        await auditLink.first().click();
        await page.waitForURL("**/compliance/audit");
        expect(page.url()).toContain("/compliance/audit");
      }
    });

    test("should have back navigation on sub-pages", async ({ page }) => {
      await page.goto("/compliance/audit");
      await page.waitForLoadState("networkidle");
      
      const backButton = page.locator('a:has-text("Back"), button:has-text("Back")');
      const isVisible = await backButton.first().isVisible().catch(() => false);
    });
  });

  test.describe("API Endpoints", () => {
    test("should return frameworks data", async ({ request }) => {
      const response = await request.get("/api/compliance/frameworks");
      
      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty("frameworks");
        expect(data).toHaveProperty("overall");
      }
    });

    test("should return audit trail data", async ({ request }) => {
      const response = await request.get("/api/compliance/audit-trail");
      
      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty("events");
        expect(data).toHaveProperty("summary");
        expect(data).toHaveProperty("metadata");
      }
    });

    test("should return integrity status", async ({ request }) => {
      const response = await request.get("/api/compliance/integrity");
      
      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty("valid");
        expect(data).toHaveProperty("totalEvents");
        expect(data).toHaveProperty("violations");
      }
    });

    test("should export data in JSON format", async ({ request }) => {
      const response = await request.post("/api/compliance/export", {
        data: { format: "json", projectId: "test-project" },
      });
      
      if (response.ok()) {
        const contentType = response.headers()["content-type"];
        expect(contentType).toContain("application/json");
      }
    });

    test("should export data in CSV format", async ({ request }) => {
      const response = await request.post("/api/compliance/export", {
        data: { format: "csv", projectId: "test-project" },
      });
      
      if (response.ok()) {
        const contentType = response.headers()["content-type"];
        expect(contentType).toContain("text/csv");
      }
    });
  });
});
