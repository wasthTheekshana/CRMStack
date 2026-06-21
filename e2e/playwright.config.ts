import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:        './tests',
  timeout:        30_000,
  fullyParallel:  false,
  forbidOnly:     !!process.env.CI,
  retries:        process.env.CI ? 1 : 0,
  reporter:       'html',
  globalSetup:    './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL:          'http://localhost:80',
    trace:            'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
