import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  fullyParallel: true,
  timeout: 30000,
  retries: 2,
  use: {
    headless: true,
    launchOptions: {
      slowMo: 1000,
    },
  },
  projects: [
    {
      name: 'cli-integration',
      use: { ...devices['chromium'] },
    },
  ],
});
