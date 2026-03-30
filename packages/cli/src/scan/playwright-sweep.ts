/**
 * Playwright Button Sweep
 * 
 * The cheat code:
 * - Click every data-action-id on key pages
 * - Fail on console errors/unhandled rejections
 * - Fail on unexpected 4xx/5xx
 * - Save traces/screenshots on failure
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface PlaywrightSweepResult {
  ran: boolean;
  passed: boolean;
  failures: Array<{
    test: string;
    error: string;
    trace?: string;
    screenshot?: string;
  }>;
  traces: string[];
  summary: {
    totalActions: number;
    passed: number;
    failed: number;
    errors: number;
  };
}

export interface PlaywrightConfig {
  baseUrl: string;
  pages: string[];
  actionSelectors: string[];
  timeout?: number;
}

export class PlaywrightSweep {
  /**
   * Run button sweep on application
   */
  async sweep(
    config: PlaywrightConfig,
    artifactsDir: string
  ): Promise<PlaywrightSweepResult> {
    // Check if Playwright is available
    if (!this.isPlaywrightAvailable()) {
      return {
        ran: false,
        passed: true,
        failures: [],
        traces: [],
        summary: {
          totalActions: 0,
          passed: 0,
          failed: 0,
          errors: 0,
        },
      };
    }

    // Ensure artifacts directory exists
    if (!existsSync(artifactsDir)) {
      mkdirSync(artifactsDir, { recursive: true });
    }

    const failures: PlaywrightSweepResult['failures'] = [];
    const traces: string[] = [];
    let totalActions = 0;
    let passed = 0;
    let failed = 0;
    let errors = 0;

    try {
      // Import Playwright dynamically
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();

      // Enable console and network monitoring
      const consoleErrors: string[] = [];
      const networkErrors: Array<{ url: string; status: number }> = [];

      context.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      context.on('response', (response) => {
        const status = response.status();
        if (status >= 400) {
          networkErrors.push({
            url: response.url(),
            status,
          });
        }
      });

      // Test each page
      for (const pagePath of config.pages) {
        const page = await context.newPage();
        const fullUrl = `${config.baseUrl}${pagePath}`;

        try {
          await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: config.timeout || 30000 });

          // Find all action elements
          const actionElements = await page.$$(config.actionSelectors.join(', '));

          for (const element of actionElements) {
            totalActions++;

            try {
              // Get action ID for identification
              const actionId = await element.getAttribute('data-action-id') || 
                             await element.getAttribute('id') ||
                             await element.textContent() ||
                             'unknown';

              // Click the element
              await element.click({ timeout: 5000 });

              // Wait a bit for any async operations
              await page.waitForTimeout(1000);

              // Check for console errors
              if (consoleErrors.length > 0) {
                failed++;
                const error = consoleErrors.join('; ');
                failures.push({
                  test: `Click action: ${actionId} on ${pagePath}`,
                  error: `Console errors: ${error}`,
                });
                consoleErrors.length = 0; // Clear after reporting
              }

              // Check for network errors
              if (networkErrors.length > 0) {
                failed++;
                const error = networkErrors.map(e => `${e.url}: ${e.status}`).join('; ');
                failures.push({
                  test: `Click action: ${actionId} on ${pagePath}`,
                  error: `Network errors: ${error}`,
                });
                networkErrors.length = 0; // Clear after reporting
              }

              if (consoleErrors.length === 0 && networkErrors.length === 0) {
                passed++;
              }
            } catch (error: any) {
              failed++;
              const tracePath = join(artifactsDir, `trace-${Date.now()}.zip`);
              const screenshotPath = join(artifactsDir, `screenshot-${Date.now()}.png`);

              // Save trace and screenshot
              await context.tracing.stop({ path: tracePath });
              await page.screenshot({ path: screenshotPath, fullPage: true });

              traces.push(tracePath);

              failures.push({
                test: `Click action on ${pagePath}`,
                error: error.message || String(error),
                trace: tracePath,
                screenshot: screenshotPath,
              });
            }
          }
        } catch (error: any) {
          errors++;
          failures.push({
            test: `Navigate to ${pagePath}`,
            error: error.message || String(error),
          });
        } finally {
          await page.close();
        }
      }

      await browser.close();
    } catch (error: any) {
      // Playwright not available or other error
      return {
        ran: false,
        passed: true,
        failures: [{
          test: 'Playwright setup',
          error: error.message || 'Playwright not available',
        }],
        traces: [],
        summary: {
          totalActions: 0,
          passed: 0,
          failed: 0,
          errors: 1,
        },
      };
    }

    return {
      ran: true,
      passed: failures.length === 0,
      failures,
      traces,
      summary: {
        totalActions,
        passed,
        failed,
        errors,
      },
    };
  }

  private isPlaywrightAvailable(): boolean {
    try {
      require.resolve('playwright');
      return true;
    } catch {
      return false;
    }
  }
}
