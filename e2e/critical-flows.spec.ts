import { test, expect, Page } from "@playwright/test";

/**
 * Critical E2E Tests for guardrail
 * Tests the core user journeys that must work for production
 */

test.describe("Critical Flow: Signup → Connect GitHub → Run Scan → View Results", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session
    await page.context().clearCookies();
  });

  test("complete signup flow", async ({ page }) => {
    await page.goto("/signup");

    // Fill signup form
    await page.getByLabel("Email").fill("newuser@test.com");
    await page.getByLabel("Password").fill("SecurePassword123!");
    await page.getByLabel("Confirm Password").fill("SecurePassword123!");
    await page.getByRole("button", { name: /sign up/i }).click();

    // Should redirect to onboarding or dashboard
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
  });

  test("GitHub OAuth connection flow", async ({ page }) => {
    // Assuming user is already logged in
    await page.goto("/dashboard/settings/integrations");

    // Find GitHub connect button
    const connectButton = page.getByRole("button", { name: /connect github/i });
    await expect(connectButton).toBeVisible();

    // Click initiates OAuth (we can't fully test external OAuth, but verify redirect)
    await connectButton.click();

    // Should redirect to GitHub or show OAuth modal
    // In CI, we mock this flow
    await expect(page.url()).toContain("github.com/login/oauth");
  });

  test("run scan and view results", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("testpassword");
    await page.getByRole("button", { name: /log in/i }).click();

    // Navigate to projects
    await page.goto("/dashboard/projects");

    // Create or select a project
    const projectCard = page.getByTestId("project-card").first();
    if (await projectCard.isVisible()) {
      await projectCard.click();
    } else {
      // Create new project
      await page.getByRole("button", { name: /new project/i }).click();
      await page.getByLabel("Project Name").fill("Test Project");
      await page.getByRole("button", { name: /create/i }).click();
    }

    // Run scan
    await page.getByRole("button", { name: /run scan/i }).click();

    // Wait for scan to complete (with timeout)
    await expect(page.getByText(/scan complete|score/i)).toBeVisible({
      timeout: 60000,
    });

    // Verify results are displayed
    const scoreDisplay = page.getByTestId("health-score");
    await expect(scoreDisplay).toBeVisible();

    // Verify findings list
    const findingsList = page.getByTestId("findings-list");
    await expect(findingsList).toBeVisible();
  });
});

test.describe("Critical Flow: Upgrade to Pro → Verify Access", () => {
  test("upgrade flow shows pricing", async ({ page }) => {
    await page.goto("/pricing");

    // Verify pricing tiers are visible
    await expect(page.getByText("Free")).toBeVisible();
    await expect(page.getByText("Starter")).toBeVisible();
    await expect(page.getByText("Pro")).toBeVisible();

    // Click upgrade on Pro plan
    const proPlan = page.locator('[data-plan="pro"]');
    await proPlan.getByRole("button", { name: /get started|upgrade/i }).click();

    // Should redirect to checkout or show upgrade modal
    await expect(page.url()).toMatch(/(checkout|stripe|upgrade)/);
  });

  test("Pro features accessible after upgrade", async ({ page }) => {
    // Login as Pro user (mock/test account)
    await page.goto("/login");
    await page.getByLabel("Email").fill("pro-user@test.com");
    await page.getByLabel("Password").fill("propassword");
    await page.getByRole("button", { name: /log in/i }).click();

    await page.goto("/dashboard");

    // Verify Pro features are unlocked
    const autopilotFeature = page.getByTestId("autopilot-feature");
    await expect(autopilotFeature).toBeVisible();
    await expect(autopilotFeature).not.toHaveClass(/locked|disabled/);

    // Verify usage limits show Pro tier
    await page.goto("/dashboard/settings/usage");
    await expect(page.getByText(/pro plan|500 scans/i)).toBeVisible();
  });
});

test.describe("Critical Flow: Settings Changes Persist", () => {
  test("notification settings persist after save", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("testpassword");
    await page.getByRole("button", { name: /log in/i }).click();

    await page.goto("/dashboard/settings/notifications");

    // Toggle email notifications off
    const emailToggle = page.getByLabel(/email notifications/i);
    const initialState = await emailToggle.isChecked();
    await emailToggle.click();

    // Save settings
    await page.getByRole("button", { name: /save/i }).click();

    // Wait for save confirmation
    await expect(page.getByText(/saved|success/i)).toBeVisible();

    // Reload page
    await page.reload();

    // Verify setting persisted
    const newState = await emailToggle.isChecked();
    expect(newState).toBe(!initialState);
  });

  test("profile changes persist", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("testpassword");
    await page.getByRole("button", { name: /log in/i }).click();

    await page.goto("/dashboard/settings/profile");

    // Change display name
    const nameInput = page.getByLabel(/display name|name/i);
    await nameInput.clear();
    const newName = `Test User ${Date.now()}`;
    await nameInput.fill(newName);

    // Save
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/saved|success/i)).toBeVisible();

    // Reload and verify
    await page.reload();
    await expect(nameInput).toHaveValue(newName);
  });

  test("project settings persist", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("testpassword");
    await page.getByRole("button", { name: /log in/i }).click();

    await page.goto("/dashboard/projects");

    // Open first project settings
    await page.getByTestId("project-card").first().click();
    await page.getByRole("button", { name: /settings/i }).click();

    // Change scan frequency
    const frequencySelect = page.getByLabel(/scan frequency/i);
    await frequencySelect.selectOption("weekly");

    // Save
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/saved|success/i)).toBeVisible();

    // Reload and verify
    await page.reload();
    await expect(frequencySelect).toHaveValue("weekly");
  });
});

test.describe("Authentication Edge Cases", () => {
  test("invalid login shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("wrong@example.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible();
  });

  test("protected routes redirect to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/login/);
  });

  test("logout clears session", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("testpassword");
    await page.getByRole("button", { name: /log in/i }).click();

    await expect(page).toHaveURL(/dashboard/);

    // Logout
    await page.getByRole("button", { name: /logout|sign out/i }).click();

    // Verify redirected and can't access protected routes
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });
});

test.describe("Error Handling", () => {
  test("404 page shows for unknown routes", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");

    await expect(page.getByText(/404|not found/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /home|back/i })).toBeVisible();
  });

  test("graceful error handling on API failure", async ({ page }) => {
    // Mock API to fail
    await page.route("**/api/**", (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: "Server error" }),
      });
    });

    await page.goto("/dashboard");

    // Should show error state, not crash
    await expect(
      page.getByText(/error|try again|something went wrong/i),
    ).toBeVisible();
  });
});

test.describe("Performance & Accessibility", () => {
  test("homepage loads within acceptable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/");
    const loadTime = Date.now() - startTime;

    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test("critical pages have proper heading structure", async ({ page }) => {
    const pagesToTest = ["/", "/pricing", "/login", "/signup"];

    for (const url of pagesToTest) {
      await page.goto(url);

      // Should have exactly one h1
      const h1Count = await page.locator("h1").count();
      expect(h1Count).toBe(1);
    }
  });

  test("forms have proper labels", async ({ page }) => {
    await page.goto("/login");

    // All inputs should have associated labels
    const inputs = await page.locator('input:not([type="hidden"])').all();
    for (const input of inputs) {
      const id = await input.getAttribute("id");
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        await expect(label).toBeVisible();
      }
    }
  });
});
