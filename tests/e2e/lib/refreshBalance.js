import { expect } from "@playwright/test";
import findAndClick from "./findAndClick.js";
import verifyBalance from "./verifyBalance.js";
import ensureExpanded from "./ensureExpanded.js";

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
    await ensureExpanded(page, parentKey);

    const addressListSelector = `[data-testid="${parentKey}-address-list"]`;
    // console.log("Looking for address list with selector:", addressListSelector);

    // Wait for the address list to be visible with a longer timeout
    await page.waitForSelector(addressListSelector, {
      state: "visible",
      timeout: 10000,
    });

    // Wait for the address list to be visible first
    const addressList = page.locator(addressListSelector);

    // Log whether the element exists and its state
    const exists = (await addressList.count()) > 0;
    // console.log(`Address list exists: ${exists}`);
    if (exists) {
      const isVisible = await addressList.isVisible();
      // console.log(`Address list is visible: ${isVisible}`);
    }

    await expect(addressList).toBeVisible();

    // Now verify the specific address row is visible
    const addressRow = page.getByTestId(`${address}-row`);
    await expect(addressRow).toBeVisible();
  }

  // Find and verify the refresh button exists and is visible
  const refreshButton = page.getByTestId(`${address}-refresh-button`);
  await expect(refreshButton).toBeVisible();

  // Only set test response and wait if any expected balance is non-zero
  const isCustomBalance = Object.values(expectedBalances).some(
    (v) => v !== "0.00000000 ₿"
  );

  if (isCustomBalance) {
    const testResponseString = JSON.stringify(testResponse);
    console.log("Setting test response for", address, testResponseString);
    await page.evaluate((response) => {
      window.__TEST_RESPONSE__ = response;
      window.__TEST_RESPONSE_USED__ = false;
    }, testResponseString);
  }

  // Click the refresh button and wait for loading state
  await findAndClick(page, `${address}-refresh-button`, {
    force: true,
  });

  console.log("Refreshed balance for", address);

  if (isCustomBalance) {
    console.log("Waiting for test response to be marked as used");
    // Wait for the test response to be marked as used
    await page.waitForFunction(() => window.__TEST_RESPONSE_USED__, {
      timeout: 5000,
    });
  }

  // console.log(
  //   "Debug - Calling verifyBalance with expectedBalances:",
  //   expectedBalances
  // );
  // Now verify the balances
  await verifyBalance(page, address, expectedBalances);
};
