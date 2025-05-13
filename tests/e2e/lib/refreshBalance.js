import { expect } from "@playwright/test";
import findAndClick from "./findAndClick.js";
import verifyBalance from "./verifyBalance.js";

// Helper to convert Bitcoin string to satoshis
const btcToSats = (btcStr) => {
  // Remove ₿ symbol and trim
  const cleanStr = btcStr.replace("₿", "").trim();
  // Convert to number and multiply by 100M (satoshis)
  return Math.round(parseFloat(cleanStr) * 100000000);
};

export default async (
  page,
  address,
  expectedBalances,
  index = 0,
  parentKey = null
) => {
  // Create test response from expected balances
  const testResponse = {
    chain_stats: {
      funded_txo_sum: btcToSats(expectedBalances.chain_in),
      spent_txo_sum: btcToSats(expectedBalances.chain_out),
    },
    mempool_stats: {
      funded_txo_sum: btcToSats(expectedBalances.mempool_in),
      spent_txo_sum: btcToSats(expectedBalances.mempool_out),
    },
  };

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
      await findAndClick(page, `${parentKey}-expand-button`);
    }

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
    }

    await expect(addressList).toBeVisible();

    // Now verify the specific address row is visible
    const addressRow = page.getByTestId(`${testIdPrefix}-row`);
    await expect(addressRow).toBeVisible();
  }

  // Find and verify the refresh button exists and is visible
  const refreshButton = page.getByTestId(`${testIdPrefix}-refresh-button`);
  await expect(refreshButton).toBeVisible();

  // Set test response in the page context
  await page.evaluate((response) => {
    window.__TEST_RESPONSE__ = response;
  }, testResponse);

  // Click the refresh button and wait for loading state
  await findAndClick(page, `${testIdPrefix}-refresh-button`, {
    force: true,
  });

  // Wait for the notification to appear
  const notification = page.getByTestId("notification");
  await expect(notification).toBeVisible();

  // Verify it's a success notification
  await expect(notification).toHaveClass(/MuiAlert-standardSuccess/);

  // Try to close the notification if it has a close button
  const closeButton = notification.locator('button[aria-label="Close"]');
  if (await closeButton.isVisible()) {
    await closeButton.click();
  }

  // Wait for the notification to disappear
  await page
    .waitForSelector('[data-testid="notification"]', {
      state: "hidden",
      timeout: 5000,
    })
    .catch(async () => {
      // If notification doesn't disappear, try clicking the close button again
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForSelector('[data-testid="notification"]', {
          state: "hidden",
          timeout: 5000,
        });
      }
    });

  // Wait for balance values to be updated (not showing "queued...")
  const waitForBalanceUpdate = async () => {
    const chainIn = page.getByTestId(`${testIdPrefix}-chain-in`);
    const chainOut = page.getByTestId(`${testIdPrefix}-chain-out`);
    const mempoolIn = page.getByTestId(`${testIdPrefix}-mempool-in`);
    const mempoolOut = page.getByTestId(`${testIdPrefix}-mempool-out`);

    // Wait for all balance values to be updated
    await Promise.all([
      chainIn.waitFor({ state: "visible", timeout: 10000 }),
      chainOut.waitFor({ state: "visible", timeout: 10000 }),
      mempoolIn.waitFor({ state: "visible", timeout: 10000 }),
      mempoolOut.waitFor({ state: "visible", timeout: 10000 }),
    ]);

    // Wait for values to not be "queued..."
    await page.waitForFunction(
      (prefix) => {
        const elements = [
          document.querySelector(`[data-testid="${prefix}-chain-in"]`),
          document.querySelector(`[data-testid="${prefix}-chain-out"]`),
          document.querySelector(`[data-testid="${prefix}-mempool-in"]`),
          document.querySelector(`[data-testid="${prefix}-mempool-out"]`),
        ];
        return elements.every((el) => el && !el.textContent.includes("queued"));
      },
      testIdPrefix,
      { timeout: 10000 }
    );
  };

  // Wait for balance update
  await waitForBalanceUpdate();

  // Now verify the balances
  await verifyBalance(page, address, expectedBalances, index, parentKey);
};
