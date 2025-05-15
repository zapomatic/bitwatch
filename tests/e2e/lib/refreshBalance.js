import { expect } from "@playwright/test";
import findAndClick from "./findAndClick.js";
import verifyBalance from "./verifyBalance.js";

// Helper to convert Bitcoin string to satoshis
const btcToSats = (btcStr) => {
  // Debug log
  // console.log("btcToSats input:", btcStr);
  // Remove ₿ symbol and trim
  const cleanStr = btcStr.replace("₿", "").trim();
  // Convert to number and multiply by 100M (satoshis)
  return Math.round(parseFloat(cleanStr) * 100000000);
};

export default async (page, address, expectedBalances, parentKey = null) => {
  // Default all missing fields to zero
  expectedBalances = {
    chain_in: "0.00000000 ₿",
    chain_out: "0.00000000 ₿",
    mempool_in: "0.00000000 ₿",
    mempool_out: "0.00000000 ₿",
    ...expectedBalances,
  };

  // Create test response from expected balances to send to mock api
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

    const addressListSelector = `[data-testid="${parentKey}-address-list"]`;
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
    const addressRow = page.getByTestId(`${address}-row`);
    await expect(addressRow).toBeVisible();
  }

  // Find and verify the refresh button exists and is visible
  const refreshButton = page.getByTestId(`${address}-refresh-button`);
  await expect(refreshButton).toBeVisible();

  // Set test response in the page context and ensure it persists
  await page.evaluate((response) => {
    // Store the response in a way that won't be cleared
    window.__TEST_RESPONSE__ = response;
    // Add a property to track if it's been used
    window.__TEST_RESPONSE_USED__ = false;
  }, JSON.stringify(testResponse));

  // Click the refresh button and wait for loading state
  await findAndClick(page, `${address}-refresh-button`, {
    force: true,
  });

  // Wait for the notification to appear
  const notification = page.getByTestId("notification");
  await expect(notification).toBeVisible();

  // Verify it's a success notification
  await expect(notification).toHaveClass(/MuiAlert-standardSuccess/);

  // Wait for the test response to be marked as used
  await page.waitForFunction(() => window.__TEST_RESPONSE_USED__, {
    timeout: 5000,
  });

  // Wait for balance values to be updated (not showing "queued...")
  const waitForBalanceUpdate = async () => {
    const chainIn = page.getByTestId(`${address}-chain-in`);
    const chainOut = page.getByTestId(`${address}-chain-out`);
    const mempoolIn = page.getByTestId(`${address}-mempool-in`);
    const mempoolOut = page.getByTestId(`${address}-mempool-out`);

    // Wait for all balance values to be visible
    await Promise.all([
      chainIn.waitFor({ state: "visible", timeout: 10000 }),
      chainOut.waitFor({ state: "visible", timeout: 10000 }),
      mempoolIn.waitFor({ state: "visible", timeout: 10000 }),
      mempoolOut.waitFor({ state: "visible", timeout: 10000 }),
    ]);

    // Wait for values to not be "queued..." and match expected values
    await page.waitForFunction(
      (prefix, expectedBalancesStr) => {
        if (!expectedBalancesStr) {
          console.log(
            "No expected balances provided!",
            prefix,
            expectedBalancesStr
          );
          return true;
        }
        const expectedBalances = JSON.parse(expectedBalancesStr);
        const elements = [
          document.querySelector(`[data-testid="${prefix}-chain-in"]`),
          document.querySelector(`[data-testid="${prefix}-chain-out"]`),
          document.querySelector(`[data-testid="${prefix}-mempool-in"]`),
          document.querySelector(`[data-testid="${prefix}-mempool-out"]`),
        ];
        return elements.every((el) => {
          if (!el) return false;
          const text = el.textContent;
          if (text.includes("queued")) return false;
          // If we have an expected value for this field, check it matches
          const field = el.getAttribute("data-testid").split("-").pop();
          const expectedValue = expectedBalances[field];
          if (expectedValue && text !== expectedValue) return false;
          return true;
        });
      },
      address,
      JSON.stringify(expectedBalances),
      { timeout: 30000 }
    );
  };

  // Wait for balance update
  await waitForBalanceUpdate();

  // Now verify the balances
  await verifyBalance(page, address, expectedBalances);
};
