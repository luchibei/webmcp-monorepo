import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 45_000,
  expect: {
    timeout: 8_000
  },
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "pnpm --filter @webmcp/demo-shop dev:playwright",
    url: "http://localhost:3100",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI
  }
});
