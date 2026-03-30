/**
 * Playwright Demo Configuration
 * 
 * Used by the landing demo pipeline to generate video/trace artifacts
 * for the marketing site. Forces video recording and trace collection.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.guardrail/ship/reality-mode',
  
  // Run tests sequentially for clean video capture
  fullyParallel: false,
  workers: 1,
  
  // Fail the build on any test failure
  forbidOnly: true,
  
  // Retry once for flaky network conditions
  retries: 1,
  
  // Short timeout for demo
  timeout: 30000,
  
  // Reporter for CI
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/demo-report', open: 'never' }],
  ],
  
  // Output directory for artifacts
  outputDir: 'test-results/demo-artifacts',
  
  use: {
    // Base URL - can be overridden via environment
    baseURL: process.env.DEMO_BASE_URL || 'http://localhost:3000',
    
    // Always capture trace
    trace: 'on',
    
    // Always record video
    video: 'on',
    
    // Capture screenshot on failure
    screenshot: 'on',
    
    // Viewport for consistent recordings
    viewport: { width: 1280, height: 720 },
    
    // Slower actions for better video
    actionTimeout: 10000,
    
    // Ignore HTTPS errors for local testing
    ignoreHTTPSErrors: true,
  },
  
  // Only use Chromium for demo (smaller artifact size)
  projects: [
    {
      name: 'demo',
      use: { 
        ...devices['Desktop Chrome'],
        // Ensure consistent rendering
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
  ],
  
  // Web server configuration (optional - uncomment if needed)
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: true,
  //   timeout: 120 * 1000,
  // },
});
