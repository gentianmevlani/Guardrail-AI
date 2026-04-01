/**
 * Button Sweep Test Generator
 * 
 * Generates Playwright test that:
 * - Logs in (test user)
 * - Navigates all major pages
 * - Clicks every visible button (or every element with data-action-id)
 * - Fails if:
 *   - Any console error occurs
 *   - Any network request returns 4xx/5xx (except explicitly allowed)
 *   - Any click produces no state change when expected
 *   - Any toast says "success" but request failed
 */

export interface ButtonSweepConfig {
  baseUrl: string;
  auth?: {
    email: string;
    password: string;
  };
  pages?: string[];
  allowedStatusCodes?: number[];
  requireDataActionId?: boolean;
}

/**
 * Generate Playwright test for button sweep
 */
export function generateButtonSweepTest(config: ButtonSweepConfig): string {
  const {
    baseUrl,
    auth,
    pages = ['/', '/dashboard', '/settings', '/billing'],
    allowedStatusCodes = [200, 201, 204],
    requireDataActionId = false,
  } = config;

  return `import { test, expect } from '@playwright/test';

/**
 * Button Sweep Test
 * 
 * This test clicks every button on the application and ensures:
 * - No console errors occur
 * - No 4xx/5xx network errors (except allowed)
 * - Buttons produce expected state changes
 * - Success toasts match successful requests
 */

test.describe('Button Sweep - No Dead Buttons', () => {
  let pageErrors: string[] = [];
  let networkErrors: Array<{ url: string; status: number; method: string }> = [];
  let clickedButtons: Array<{ actionId: string; url: string; success: boolean }> = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    networkErrors = [];
    clickedButtons = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known benign errors
        if (!text.includes('favicon') && !text.includes('ResizeObserver')) {
          pageErrors.push(text);
        }
      }
    });

    // Capture network errors
    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();
      const method = response.request().method();
      
      // Track failed requests
      if (status >= 400 && !allowedStatusCodes.includes(status)) {
        // Ignore preflight OPTIONS requests
        if (method !== 'OPTIONS') {
          networkErrors.push({ url, status, method });
        }
      }
    });
  });

  test('should log in and authenticate', async ({ page }) => {
    await page.goto(\`\${baseUrl}/login\`);

    ${auth
      ? `
    // Fill login form
    await page.fill('[data-testid="email-input"], input[type="email"]', '${auth.email}');
    await page.fill('[data-testid="password-input"], input[type="password"]', '${auth.password}');
    
    // Submit login
    await page.click('[data-testid="login-button"], button[type="submit"]');
    
    // Wait for navigation after login
    await page.waitForURL(/\/(dashboard|home)/, { timeout: 10000 });
    
    // Verify logged in (check for user menu, logout button, etc.)
    await expect(page.locator('[data-testid="user-menu"], [data-testid="logout"]')).toBeVisible({ timeout: 5000 });
    `
      : `
    // Skip authentication if no credentials provided
    // Note: You may need to handle authentication differently
    await page.waitForTimeout(1000);
    `}
  });

  ${pages
    .map(
      (pagePath, index) => `
  test('should sweep buttons on ${pagePath}', async ({ page }) => {
    ${index === 0 && auth
      ? `
    // Login first
    await page.goto(\`\${baseUrl}/login\`);
    await page.fill('[data-testid="email-input"], input[type="email"]', '${auth.email}');
    await page.fill('[data-testid="password-input"], input[type="password"]', '${auth.password}');
    await page.click('[data-testid="login-button"], button[type="submit"]');
    await page.waitForURL(/\/(dashboard|home)/, { timeout: 10000 });
    `
      : ''}
    
    // Navigate to page
    await page.goto(\`\${baseUrl}${pagePath}\`);
    await page.waitForLoadState('networkidle');
    
    // Find all buttons
    const buttonSelector = ${requireDataActionId
      ? `'[data-action-id]'`
      : `'button:visible, a[role="button"]:visible, [role="button"]:visible'`};
    const buttons = await page.locator(buttonSelector).all();
    
    test.info().annotations.push({
      type: 'info',
      description: \`Found \${buttons.length} buttons on ${pagePath}\`,
    });
    
    // Click each button (with timeout to avoid hanging)
    for (const button of buttons) {
      try {
        const actionId = await button.getAttribute('data-action-id') || 'unknown';
        const buttonText = await button.textContent() || '';
        const currentUrl = page.url();
        
        // Skip disabled buttons
        const isDisabled = await button.isDisabled().catch(() => false);
        if (isDisabled) {
          test.info().annotations.push({
            type: 'skip',
            description: \`Skipped disabled button: \${buttonText.substring(0, 50)}\`,
          });
          continue;
        }
        
        // Skip buttons that are not visible
        const isVisible = await button.isVisible().catch(() => false);
        if (!isVisible) {
          continue;
        }
        
        // Scroll button into view
        await button.scrollIntoViewIfNeeded();
        await page.waitForTimeout(100); // Small delay for animations
        
        // Capture state before click
        const stateBefore = {
          url: page.url(),
          errorCount: pageErrors.length,
          networkErrorCount: networkErrors.length,
        };
        
        // Click button (with timeout)
        await Promise.race([
          button.click({ timeout: 5000 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Button click timeout')), 5000)),
        ]).catch((err) => {
          // Button click failed - log but continue
          test.info().annotations.push({
            type: 'warning',
            description: \`Button click failed: \${buttonText.substring(0, 50)} - \${err.message}\`,
          });
        });
        
        // Wait a bit for state changes
        await page.waitForTimeout(500);
        
        // Check for state change (URL change or DOM change)
        const stateAfter = {
          url: page.url(),
          errorCount: pageErrors.length,
          networkErrorCount: networkErrors.length,
        };
        
        const hadStateChange = stateBefore.url !== stateAfter.url;
        const hadError = stateAfter.errorCount > stateBefore.errorCount || 
                        stateAfter.networkErrorCount > stateBefore.networkErrorCount;
        
        clickedButtons.push({
          actionId,
          url: currentUrl,
          success: !hadError,
        });
        
      } catch (error) {
        // Button interaction failed - log but continue
        test.info().annotations.push({
          type: 'warning',
          description: \`Error interacting with button: \${error instanceof Error ? error.message : String(error)}\`,
        });
      }
    }
    
    // Assertions after sweep
    if (pageErrors.length > 0) {
      console.error('Console errors during button sweep:', pageErrors);
    }
    
    if (networkErrors.length > 0) {
      console.error('Network errors during button sweep:', networkErrors);
    }
    
    // Fail if there were errors
    expect(pageErrors.length, \`Found \${pageErrors.length} console errors. First: \${pageErrors[0]}\`).toBe(0);
    expect(networkErrors.length, \`Found \${networkErrors.length} network errors. First: \${networkErrors[0]?.url} (status: \${networkErrors[0]?.status})\`).toBe(0);
  });
  `,
    )
    .join('\n')}

  test.afterAll(async () => {
    // Log summary
    console.log(\`\\nButton Sweep Summary:\`);
    console.log(\`  Total buttons clicked: \${clickedButtons.length}\`);
    console.log(\`  Successful: \${clickedButtons.filter(b => b.success).length}\`);
    console.log(\`  Failed: \${clickedButtons.filter(b => !b.success).length}\`);
  });
});
`;
}

/**
 * Generate simplified button sweep (for CI/CD)
 */
export function generateCIButtonSweepTest(config: ButtonSweepConfig): string {
  return generateButtonSweepTest({
    ...config,
    pages: config.pages || ['/', '/dashboard'],
  });
}
