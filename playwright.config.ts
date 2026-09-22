import { defineConfig, devices } from '@playwright/test'

const useProductionBuild = process.env.PLAYWRIGHT_USE_BUILD === 'true'
const defaultPort = useProductionBuild ? 4274 : 5273
const port = Number(process.env.PLAYWRIGHT_PORT ?? defaultPort)
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/unit/**'],
  fullyParallel: true,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: process.env.CI
    ? [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
    : [{ name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }],
  webServer: {
    env: {
      VITE_CONVEX_URL: 'https://standing-manatee-425.convex.cloud',
      VITE_CONVEX_SITE_URL: 'https://standing-manatee-425.convex.site',
      VITE_LANDING_URL: 'https://hackuta.org',
      VITE_USE_MOCK_API: 'true',
    },
    command: useProductionBuild
      ? process.env.CI
        ? `node ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port}`
        : `npm run build && node ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port}`
      : `npm run dev -- --port ${port}`,
    url: baseURL,
    // Always start a fresh server so VITE_USE_MOCK_API and test Convex URLs apply.
    reuseExistingServer: false,
  },
})
