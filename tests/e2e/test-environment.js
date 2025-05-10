import { test as base, expect } from "@playwright/test";

// Create a custom test fixture with our mocks
const test = base.extend({
  page: async ({ page }, use) => {
    // Add window-related code in page context
    await page.addInitScript(() => {
      // Set the server port for socket.io
      process.env.SERVER_PORT = 3119;
      window.process = { env: { SERVER_PORT: 3119 } };
    });

    await use(page);
  },
  // Add server log capture
  serverLogs: async ({}, use, testInfo) => {
    const logs = [];

    // Create a custom write function to capture logs
    const writeLog = (chunk) => {
      if (typeof chunk === "string") {
        logs.push(chunk.trim());
      }
    };

    // Override console methods to capture logs
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    console.log = (...args) => {
      const message = args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
        .join(" ");
      writeLog(message);
      originalConsoleLog.apply(console, args);
    };

    console.error = (...args) => {
      const message = args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
        .join(" ");
      writeLog(message);
      originalConsoleError.apply(console, args);
    };

    await use(logs);

    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Attach logs to test info
    testInfo.attachments.push({
      name: "server-stdout",
      contentType: "text/plain",
      body: Buffer.from(logs.join("\n")),
    });
  },
});

export { test, expect };
