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
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command:
        "mv server/data/db.json server/data/db.backup 2>/dev/null || true && NODE_ENV=test PORT=3119 npm run dev:server",
      port: 3119,
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "cd client && NODE_ENV=production npm run start:e2e",
      port: 3120,
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  workers: 1,
  reporter: "list",
  timeout: 60000,
  expect: {
    timeout: 60000,
  },
  retries: process.env.CI ? 2 : 0,
});
