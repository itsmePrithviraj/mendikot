import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/online",
  outputDir: "test-results-online",
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: "http://localhost:8787",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: {
    command: "npm run dev:online",
    url: "http://localhost:8787/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  reporter: "list",
});
