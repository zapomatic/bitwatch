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
  const {
    timeout = 10000,
    exact = false,
    maxRetries = 3,
    allowOverlay = false,
  } = options;
  const locator = page.locator(selector);
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Wait for any matching element to be visible
      await page.waitForSelector(selector, { state: "visible", timeout });

      // Only check for overlays if we're not trying to click something in a dialog
      if (!allowOverlay) {
        // Wait for any overlays/dialogs to be gone
        const overlaySelector = ".MuiDialog-root, .MuiModal-root";
        const overlay = page.locator(overlaySelector);
        const hasOverlay = await overlay.isVisible().catch(() => false);
        if (hasOverlay) {
          // If there's an overlay, wait a bit and retry
          await page.waitForTimeout(100);
          retryCount++;
          continue;
        }
      }

      // Try to click
      if (exact) {
        await locator.first().click({ timeout: 1000 });
      } else {
        await locator.click({ timeout: 1000 });
      }
      return; // Success!
    } catch (error) {
      if (retryCount >= maxRetries - 1) {
        throw error; // Last attempt failed, propagate the error
      }
      retryCount++;
      await page.waitForTimeout(100);
    }
  }
};

export const findAndFill = async (page, selector, value, options = {}) => {
  const { timeout = 10000, exact = false } = options;
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
  await page.waitForSelector('[data-testid="address-dialog"]', {
    state: "visible",
  });

  // Fill in the address name
  await page.fill('[data-testid="address-name-input"]', name);

  // Fill in the Bitcoin address
  await page.fill('[data-testid="address-input"]', address);

  // Click the save button - allow clicking in overlay since it's in a dialog
  await findAndClick(page, '[data-testid="address-dialog-save"]', {
    allowOverlay: true,
  });

  // Wait for the dialog to disappear
  await page.waitForSelector('[data-testid="address-dialog"]', {
    state: "hidden",
    timeout: 2000,
  });
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
    timeout: 2000,
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

  // Click the Add button - allow clicking in overlay since it's in a dialog
  await findAndClick(page, '[data-testid="extended-key-submit-button"]', {
    allowOverlay: true,
  });

  // Wait for the dialog to disappear
  await page.waitForSelector('[data-testid="extended-key-dialog"]', {
    state: "hidden",
    timeout: 2000,
  });
};

export const addDescriptor = async (
  page,
  collection,
  { name, descriptor, skip, gapLimit, initialAddresses }
) => {
  await findAndClick(page, `[data-testid="${collection}-add-descriptor"]`);

  // Wait for dialog to be visible
  await page.waitForSelector('[aria-label="Descriptor name"] input', {
    state: "visible",
    timeout: 2000,
  });

  // Fill in the form fields
  await page.fill('[aria-label="Descriptor name"] input', name);
  await page.fill('[aria-label="Output descriptor"] input', descriptor);
  await page.fill('[aria-label="Skip addresses"] input', skip.toString());
  await page.fill('[aria-label="Gap limit"] input', gapLimit.toString());
  await page.fill(
    '[aria-label="Initial addresses"] input',
    initialAddresses.toString()
  );

  // Click the Add button - allow clicking in overlay since it's in a dialog
  await findAndClick(page, '[aria-label="Add descriptor"]', {
    allowOverlay: true,
  });

  // Wait for the dialog to disappear
  await page.waitForSelector('[aria-label="Descriptor name"]', {
    state: "hidden",
    timeout: 2000,
  });
};

export const refreshAddressBalance = async (
  page,
  address,
  expectedBalances,
  index = 0,
  parentKey = null
) => {
  // For balance cells, we use the new format
  const testIdPrefix = parentKey ? `${parentKey}-address-${index}` : address;

  // Find and verify the refresh button exists and is visible
  const refreshButton = page.getByTestId(`${testIdPrefix}-refresh-button`);
  await expect(refreshButton).toBeVisible();
  await refreshButton.click();

  // Wait for the notification to appear
  await expect(page.getByTestId("notification")).toBeVisible();
  // Verify it's a success notification
  await expect(page.getByTestId("notification")).toHaveClass(
    /MuiAlert-standardSuccess/
  );

  // Verify all balance values match expected values
  if (expectedBalances.chain_in !== undefined) {
    await expect(
      page
        .getByTestId(`${testIdPrefix}-chain-in`)
        .and(page.getByLabel("Balance value"))
    ).toHaveText(expectedBalances.chain_in);
  }
  if (expectedBalances.chain_out !== undefined) {
    await expect(
      page
        .getByTestId(`${testIdPrefix}-chain-out`)
        .and(page.getByLabel("Balance value"))
    ).toHaveText(expectedBalances.chain_out);
  }
  if (expectedBalances.mempool_in !== undefined) {
    await expect(
      page
        .getByTestId(`${testIdPrefix}-mempool-in`)
        .and(page.getByLabel("Balance value"))
    ).toHaveText(expectedBalances.mempool_in);
  }
  if (expectedBalances.mempool_out !== undefined) {
    await expect(
      page
        .getByTestId(`${testIdPrefix}-mempool-out`)
        .and(page.getByLabel("Balance value"))
    ).toHaveText(expectedBalances.mempool_out);
  }
};
