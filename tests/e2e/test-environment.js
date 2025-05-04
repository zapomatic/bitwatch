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

// Helper functions for finding and interacting with elements
export const findAndClick = async (page, selector, options = {}) => {
  const { timeout = 30000, exact = false } = options;
  const locator = page.locator(selector);

  // Wait for any matching element to be visible
  await page.waitForSelector(selector, { state: "visible", timeout });

  if (exact) {
    await locator.first().click();
  } else {
    await locator.click();
  }
};

export const findAndFill = async (page, selector, value, options = {}) => {
  const { timeout = 30000, exact = false } = options;
  const locator = page.locator(`${selector} input`);

  // Wait for any matching element to be visible
  await page.waitForSelector(`${selector} input`, {
    state: "visible",
    timeout,
  });

  if (exact) {
    await locator.first().fill(value);
  } else {
    await locator.fill(value);
  }
};

// Helper functions for common test operations
export const addCollection = async (page, name) => {
  // Click the "New Collection" button in the toolbar
  await findAndClick(page, '[aria-label="New Collection"]');

  // Wait for the new collection row to be fully rendered
  await page.waitForSelector('input[placeholder="Collection Name"]', {
    state: "visible",
  });

  // Fill in the collection name
  await page.fill('input[placeholder="Collection Name"]', name);

  // Wait for and click the Add button
  const addButton = page.locator(
    'button.crystal-button[aria-label="Add Collection"]'
  );
  await addButton.waitFor({ state: "visible" });
  await addButton.click();

  // Verify that collection row has been added with the new name
  await page.waitForSelector(`text=${name}`);
};

export const addAddress = async (page, collection, { name, address }) => {
  await findAndClick(page, `[data-testid="${collection}-add-address"]`);

  // Wait for the dialog to be visible
  await page.waitForSelector('[aria-label="Address name"] input', {
    state: "visible",
  });

  // Fill in the address name
  await page.fill('[aria-label="Address name"] input', name);

  // Fill in the Bitcoin address
  await page.fill('[aria-label="Bitcoin address"] input', address);

  // Click the save button
  await findAndClick(page, '[aria-label="Save address"]');
};

export const addExtendedKey = async (
  page,
  collection,
  { name, key, derivationPath, skip, gapLimit, initialAddresses }
) => {
  await findAndClick(page, `[data-testid="${collection}-add-extended-key"]`);

  // Wait for dialog to be visible
  await page.waitForSelector('[data-testid="extended-key-dialog"]', {
    state: "visible",
  });

  // Fill in the form fields
  await page.fill('[data-testid="extended-key-name-input"]', name);
  await page.fill('[data-testid="extended-key-key-input"]', key);
  await page.fill('[data-testid="extended-key-path-input"]', derivationPath);
  await page.fill('[data-testid="extended-key-skip-input"]', skip.toString());
  await page.fill(
    '[data-testid="extended-key-gap-input"]',
    gapLimit.toString()
  );
  await page.fill(
    '[data-testid="extended-key-initial-input"]',
    initialAddresses.toString()
  );

  // Click the Add button
  await page.getByTestId("extended-key-submit-button").click();
};

export const addDescriptor = async (
  page,
  collection,
  { name, descriptor, skip, gapLimit, initialAddresses }
) => {
  await findAndClick(page, `[data-testid="${collection}-add-descriptor"]`);
  await findAndFill(page, '[aria-label="Descriptor name"]', name);
  await findAndFill(page, '[aria-label="Output descriptor"]', descriptor);
  await findAndFill(page, '[aria-label="Skip addresses"]', skip.toString());
  await findAndFill(page, '[aria-label="Gap limit"]', gapLimit.toString());
  await findAndFill(
    page,
    '[aria-label="Initial addresses"]',
    initialAddresses.toString()
  );
  await findAndClick(page, '[aria-label="Add descriptor"]');
};
