import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config. The dev server runs at the root base ('/'). Tests mock every
 * external request (ohsome + the map style) so no real services are hit.
 */
// Port is configurable so a dev server for another project can't collide
// (set PORT=... to override the default).
const PORT = Number(process.env.PORT ?? 5173)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `bun run dev --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
