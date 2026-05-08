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
    baseURL:          'http://localhost:3000',
    trace:            'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command:             'npm run dev',
      cwd:                 '../backend',
      port:                4000,
      reuseExistingServer: !process.env.CI,
      timeout:             30_000,
      env:                 { NODE_ENV: 'test' },
    },
    {
      command:             'npm run dev',
      cwd:                 '../frontend',
      port:                3000,
      reuseExistingServer: !process.env.CI,
      timeout:             60_000,
    },
  ],
})
