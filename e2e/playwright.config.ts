import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev --workspace=backend',
      port: 3001,
      timeout: 30_000,
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev --workspace=frontend',
      port: 5173,
      timeout: 30_000,
      reuseExistingServer: true,
    },
  ],
});
