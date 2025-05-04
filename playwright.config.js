// @ts-check
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:3120",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node tests/e2e/api.mock.js",
      port: 3006,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command:
        "rm -rf server/data/db.json && NODE_ENV=test PORT=3119 npm run dev:server",
      port: 3119,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "cd client && NODE_ENV=production npm run start:e2e",
      port: 3120,
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  workers: 1,
  reporter: "list",
  timeout: 15000,
  expect: {
    timeout: 15000,
  },
  retries: process.env.CI ? 2 : 0,
});
