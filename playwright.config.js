import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:18789',
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node tests/helpers/serve-spa.mjs',
    url: 'http://127.0.0.1:18789',
    timeout: 15000,
  },
})
