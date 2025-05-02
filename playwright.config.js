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
      command: "cd client && NODE_ENV=production npm run start:e2e",
      port: 3120,
      timeout: 5000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "rm -rf server/data/db.json && PORT=3119 npm run dev:server",
      port: 3119,
      timeout: 5000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        NODE_ENV: "test",
      },
    },
  ],
  workers: 1,
  reporter: "list",
  timeout: 5000,
  expect: {
    timeout: 5000,
  },
  retries: process.env.CI ? 2 : 0,
});
