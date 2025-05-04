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

// Helper functions for common test operations
export const addCollection = async (page, name) => {
  await page.click("text=Add Collection");
  await page.fill('[aria-label="Collection Name"]', name);
  await page.click("text=Save");
};

export const addAddress = async (page, collection, address) => {
  await page.click(`[data-testid="${collection}-add-address"]`);
  await page.fill('[aria-label="Name"]', address.name);
  await page.fill('[aria-label="Address"]', address.address);
  await page.click("text=Save");
};

export const addExtendedKey = async (page, collection, key) => {
  await page.click(`[data-testid="${collection}-add-extended-key"]`);
  await page.fill('[aria-label="Name"]', key.name);
  await page.fill('[aria-label="Extended Key"]', key.key);
  await page.fill('[aria-label="Derivation Path"]', "m/0");
  await page.click("text=Add");
};

export const addDescriptor = async (page, collection, descriptor) => {
  await page.click(`[data-testid="${collection}-add-descriptor"]`);
  await page.fill('[aria-label="Name"]', descriptor.name);
  await page.fill('[aria-label="Descriptor"]', descriptor.descriptor);
  await page.click("text=Add");
};
