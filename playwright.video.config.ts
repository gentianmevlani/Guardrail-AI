import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'verification-demo.spec.ts',
  timeout: 60000,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  use: {
    video: 'on',
    trace: 'on',
  },
  outputDir: 'test-results',
});
