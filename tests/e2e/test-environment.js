import { test as base, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

// Helper functions for database management
const backupDatabase = () => {
  const dbPath = path.join(process.cwd(), "server", "data", "db.json");
  const backupPath = path.join(process.cwd(), "server", "data", "db.backup");

  console.log("Backing up database...");
  console.log("DB path:", dbPath);
  console.log("Backup path:", backupPath);

  try {
    if (fs.existsSync(dbPath)) {
      console.log("Existing db.json found, creating backup...");
      fs.copyFileSync(dbPath, backupPath);
      fs.unlinkSync(dbPath);
      console.log("Backup created and original removed");
    } else {
      console.log("No existing db.json found");
    }
  } catch (error) {
    console.error("Error during database backup:", error);
    throw error;
  }
};

const restoreDatabase = () => {
  const dbPath = path.join(process.cwd(), "server", "data", "db.json");
  const backupPath = path.join(process.cwd(), "server", "data", "db.backup");

  console.log("Restoring database...");
  console.log("DB path:", dbPath);
  console.log("Backup path:", backupPath);

  try {
    // First restore from backup if it exists
    if (fs.existsSync(backupPath)) {
      console.log("Backup found, restoring...");
      fs.copyFileSync(backupPath, dbPath);
      fs.unlinkSync(backupPath);
      console.log("Database restored and backup removed");
    } else {
      console.log("No backup found");
    }

    // Always clean up the test database
    if (fs.existsSync(dbPath)) {
      console.log("Cleaning up test database...");
      fs.unlinkSync(dbPath);
      console.log("Test database removed");
    }
  } catch (error) {
    console.error("Error during database restore:", error);
    throw error;
  }
};

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

export { test, expect, backupDatabase, restoreDatabase };

// Helper functions for finding and interacting with elements
export const findAndClick = async (page, selector, options = {}) => {
  const {
    timeout = 10000,
    exact = false,
    allowOverlay = false,
    force = false,
  } = options;
  const locator = page.locator(selector);

  // Wait for any matching element to be visible
  await page.waitForSelector(selector, { state: "visible", timeout });

  // Only check for overlays if we're not trying to click something in a dialog
  if (!allowOverlay) {
    // Wait for any overlays/dialogs to be gone
    const overlaySelector = ".MuiDialog-root, .MuiModal-root";
    const overlay = page.locator(overlaySelector);
    const hasOverlay = await overlay.isVisible().catch(() => false);
    if (hasOverlay) {
      await page.waitForSelector(overlaySelector, { state: "hidden", timeout });
    }
  }

  // Wait for the element to be stable
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    },
    selector,
    { timeout }
  );

  // Click with stability checks
  if (exact) {
    await locator.first().click({ timeout, force });
  } else {
    await locator.click({ timeout, force });
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

export const addAddress = async (
  page,
  collection,
  { name, address, monitor }
) => {
  await findAndClick(page, `[data-testid="${collection}-add-address"]`);

  // Wait for the dialog to be visible
  await page.waitForSelector('[data-testid="address-dialog"]', {
    state: "visible",
  });

  // Fill in the address name
  await page.fill('[data-testid="address-name-input"]', name);

  // Fill in the Bitcoin address
  await page.fill('[data-testid="address-input"]', address);

  // Set monitoring options if provided
  if (monitor) {
    await page.waitForSelector('[data-testid="address-dialog"]', {
      state: "visible",
    });

    // Set chain in monitoring
    const chainInSelect = page.getByTestId("address-monitor-chain-in");
    await chainInSelect.click();
    await page
      .getByTestId(`address-monitor-chain-in-${monitor.chain_in}`)
      .click();

    // Set chain out monitoring
    const chainOutSelect = page.getByTestId("address-monitor-chain-out");
    await chainOutSelect.click();
    await page
      .getByTestId(`address-monitor-chain-out-${monitor.chain_out}`)
      .click();

    // Set mempool in monitoring
    const mempoolInSelect = page.getByTestId("address-monitor-mempool-in");
    await mempoolInSelect.click();
    await page
      .getByTestId(`address-monitor-mempool-in-${monitor.mempool_in}`)
      .click();

    // Set mempool out monitoring
    const mempoolOutSelect = page.getByTestId("address-monitor-mempool-out");
    await mempoolOutSelect.click();
    await page
      .getByTestId(`address-monitor-mempool-out-${monitor.mempool_out}`)
      .click();
  }

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
  await page.waitForSelector('[data-testid="descriptor-name-input"]', {
    state: "visible",
    timeout: 2000,
  });

  // Fill in the form fields
  await page.fill('[data-testid="descriptor-name-input"]', name);
  await page.fill('[data-testid="descriptor-input"]', descriptor);
  await page.fill('[data-testid="descriptor-skip-input"]', skip.toString());
  await page.fill('[data-testid="descriptor-gap-input"]', gapLimit.toString());
  await page.fill(
    '[data-testid="descriptor-initial-input"]',
    initialAddresses.toString()
  );

  // Click the Add button - allow clicking in overlay since it's in a dialog
  await findAndClick(page, '[data-testid="descriptor-submit-button"]', {
    allowOverlay: true,
  });

  // Wait for the dialog to disappear
  await page.waitForSelector('[data-testid="descriptor-name-input"]', {
    state: "hidden",
    timeout: 2000,
  });
};

export const verifyAddressBalance = async (
  page,
  address,
  expectedBalances,
  index = 0,
  parentKey = null
) => {
  // For balance cells, we use the new format
  const testIdPrefix = parentKey ? `${parentKey}-address-${index}` : address;
  // First verify all balance selectors exist and are visible
  const chainInSelector = page.getByTestId(`${testIdPrefix}-chain-in`);
  const chainOutSelector = page.getByTestId(`${testIdPrefix}-chain-out`);
  const mempoolInSelector = page.getByTestId(`${testIdPrefix}-mempool-in`);
  const mempoolOutSelector = page.getByTestId(`${testIdPrefix}-mempool-out`);

  await expect(chainInSelector).toBeVisible();
  await expect(chainOutSelector).toBeVisible();
  await expect(mempoolInSelector).toBeVisible();
  await expect(mempoolOutSelector).toBeVisible();

  // Then verify all balance values match expected values
  if (expectedBalances.chain_in) {
    await expect(chainInSelector).toHaveText(expectedBalances.chain_in);
  }
  if (expectedBalances.chain_out) {
    await expect(chainOutSelector).toHaveText(expectedBalances.chain_out);
  }
  if (expectedBalances.mempool_in) {
    await expect(mempoolInSelector).toHaveText(expectedBalances.mempool_in);
  }
  if (expectedBalances.mempool_out) {
    await expect(mempoolOutSelector).toHaveText(expectedBalances.mempool_out);
  }
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

  // If this is a child address, ensure the parent section is expanded
  if (parentKey) {
    const expandButton = page.getByTestId(`${parentKey}-expand-button`);
    const expandedState = await expandButton.getAttribute("aria-expanded");
    console.log(`expandedState of ${parentKey}-expand-button`, expandedState);

    // Only expand if explicitly collapsed (aria-expanded="false")
    // If it's null or "true", we want to leave it as is
    if (expandedState === "false") {
      await findAndClick(page, `[data-testid="${parentKey}-expand-button"]`);
    }

    // Log all data-testid attributes on the page to see what's available
    // console.log("Logging all data-testid elements on page:");
    // const allTestIds = await page.evaluate(() => {
    //   const elements = document.querySelectorAll("[data-testid]");
    //   return Array.from(elements).map((el) => ({
    //     testId: el.getAttribute("data-testid"),
    //     tagName: el.tagName,
    //     className: el.className,
    //     isVisible: el.offsetParent !== null,
    //   }));
    // });
    // console.log(JSON.stringify(allTestIds, null, 2));

    // Check if this is a descriptor (starts with pkh, sh, wpkh, etc) or an extended key
    const isDescriptor =
      parentKey.startsWith("pkh(") ||
      parentKey.startsWith("sh(") ||
      parentKey.startsWith("wpkh(");
    console.log("Is descriptor:", isDescriptor);

    const addressListSelector = isDescriptor
      ? `[data-testid="${parentKey}-address-list"]`
      : `[data-testid="${parentKey}-address-list"]`;
    console.log("Looking for address list with selector:", addressListSelector);

    // Wait for the address list to be visible with a longer timeout
    await page.waitForSelector(addressListSelector, {
      state: "visible",
      timeout: 10000,
    });

    // Wait for the address list to be visible first
    const addressList = page.locator(addressListSelector);

    // Log whether the element exists and its state
    const exists = (await addressList.count()) > 0;
    console.log(`Address list exists: ${exists}`);
    if (exists) {
      const isVisible = await addressList.isVisible();
      console.log(`Address list is visible: ${isVisible}`);
      // const html = await addressList.evaluate((el) => el.outerHTML);
      // console.log(`Address list HTML: ${html}`);
    }

    // Log the parent container state
    const parentContainer = await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (el) {
        const parent = el.closest(".MuiCollapse-root");
        return parent
          ? {
              className: parent.className,
              style: parent.getAttribute("style"),
              isVisible: window.getComputedStyle(parent).display !== "none",
            }
          : null;
      }
      return null;
    }, addressListSelector);
    // console.log("Parent container state:", parentContainer);

    await expect(addressList).toBeVisible();

    // Now verify the specific address row is visible
    const addressRow = page.getByTestId(`${testIdPrefix}-row`);
    await expect(addressRow).toBeVisible();
  }

  // Find and verify the refresh button exists and is visible
  const refreshButton = page.getByTestId(`${testIdPrefix}-refresh-button`);
  await expect(refreshButton).toBeVisible();
  await findAndClick(page, `[data-testid="${testIdPrefix}-refresh-button"]`, {
    force: true,
  });

  // Wait for the notification to appear with a longer timeout
  const notification = page.getByTestId("notification");
  await expect(notification).toBeVisible();
  // Verify it's a success notification
  await expect(notification).toHaveClass(/MuiAlert-standardSuccess/);

  verifyAddressBalance(page, address, expectedBalances, index, parentKey);
};
