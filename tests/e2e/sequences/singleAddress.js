import { expect } from "@playwright/test";
import {
  findAndClick,
  addAddress,
  refreshAddressBalance,
} from "../test-environment.js";
import testData from "../../../test-data/keys.json" with { type: "json" };

export default async (page) => {
  // Add single address
  await addAddress(page, "Donations", {
    name: "zapomatic",
    address: testData.plain.zapomatic,
    monitor: {
      chain_in: "auto-accept",
      chain_out: "alert",
      mempool_in: "auto-accept",
      mempool_out: "alert",
    },
  });
  console.log("Added single address");

  // Verify address is visible in the expanded table
  await expect(page.getByText("Single Addresses")).toBeVisible();
  await expect(page.locator("table.address-subtable")).toBeVisible();
  await expect(
    page.locator(`text=${testData.plain.zapomatic.slice(0, 15)}...`)
  ).toBeVisible();
  console.log("Verified address table is visible");

  // Test refresh balance functionality for each state transition
  console.log("Testing refresh balance functionality for all states");

  // Initial state (all zeros)
  await refreshAddressBalance(
    page,
    testData.plain.zapomatic,
    {
      chain_in: "0.00000000 ₿",
      chain_out: "0.00000000 ₿",
      mempool_in: "0.00000000 ₿",
      mempool_out: "0.00000000 ₿",
    },
    0
  );
  console.log("Initial zero balance state verified");

  // Refresh to get mempool input state
  await refreshAddressBalance(
    page,
    testData.plain.zapomatic,
    {
      chain_in: "0.00000000 ₿",
      chain_out: "0.00000000 ₿",
      mempool_in: "0.00010000 ₿",
      mempool_out: "0.00000000 ₿",
    },
    0
  );
  console.log("Mempool input state verified");

  // Refresh to get chain input state
  await refreshAddressBalance(
    page,
    testData.plain.zapomatic,
    {
      chain_in: "0.00010000 ₿",
      chain_out: "0.00000000 ₿",
      mempool_in: "0.00000000 ₿",
      mempool_out: "0.00000000 ₿",
    },
    0
  );
  console.log("Chain input state verified");

  // Refresh to get mempool output state
  await refreshAddressBalance(
    page,
    testData.plain.zapomatic,
    {
      chain_in: "0.00010000 ₿",
      chain_out: "0.00000000 ₿",
      mempool_in: "0.00000000 ₿",
      mempool_out: "0.00001000 ₿",
    },
    0
  );
  // Wait for the diff to appear and have the correct value
  await expect(
    page.getByTestId(`${testData.plain.zapomatic}-mempool-out-diff`)
  ).toBeVisible();
  await expect(
    page.getByTestId(`${testData.plain.zapomatic}-mempool-out-diff`)
  ).toHaveText("(+0.00001000 ₿)");
  // Verify accept button for address change state
  await expect(
    page.getByTestId(`${testData.plain.zapomatic}-accept-button`)
  ).toBeVisible();
  console.log("Mempool output state verified");

  // Refresh to get chain output state
  await refreshAddressBalance(
    page,
    testData.plain.zapomatic,
    {
      chain_in: "0.00010000 ₿",
      chain_out: "0.00001000 ₿",
      mempool_in: "0.00000000 ₿",
      mempool_out: "0.00000000 ₿",
    },
    0
  );
  const testId = testData.plain.zapomatic;
  await expect(page.getByTestId(`${testId}-chain-out-diff`)).toBeVisible();
  await expect(page.getByTestId(`${testId}-chain-out-diff`)).toHaveText(
    "(+0.00001000 ₿)"
  );
  // Verify alert icon and accept button for chain-out
  await expect(
    page.getByTestId(`${testId}-chain-out-alert-icon`)
  ).toBeVisible();
  await expect(page.getByTestId(`${testId}-accept-button`)).toBeVisible();
  console.log("Chain output state verified");

  // Accept the chain-out change
  await findAndClick(
    page,
    `[data-testid="${testData.plain.zapomatic}-accept-button"]`
  );
  // verify that the change took (no longer showing a diff)
  await expect(
    page.getByTestId(`${testData.plain.zapomatic}-chain-out-diff`)
  ).not.toBeVisible();

  // Final refresh to verify all states are stable
  await refreshAddressBalance(
    page,
    testData.plain.zapomatic,
    {
      chain_in: "0.00010000 ₿",
      chain_out: "0.00001000 ₿",
      mempool_in: "0.00000000 ₿",
      mempool_out: "0.00000000 ₿",
    },
    0
  );
  console.log("Final stable state verified");

  // Verify collection balance totals
  const donationsRow = page.locator("tr.collection-row", {
    has: page.getByText("Donations"),
  });
  await expect(
    donationsRow.locator("td", { hasText: "0.00009000 ₿" }).first()
  ).toBeVisible();
  await expect(
    donationsRow.locator("td", { hasText: "0.00000000 ₿" }).first()
  ).toBeVisible();

  // Test editing the single address
  await findAndClick(
    page,
    `[data-testid="${testData.plain.zapomatic}-edit-button"]`
  );
  await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
  await expect(page.getByTestId("address-name-input")).toHaveValue("zapomatic");
  await expect(page.getByTestId("address-input")).toHaveValue(
    testData.plain.zapomatic
  );

  // Change the name
  await page.getByTestId("address-name-input").fill("test rename");
  await findAndClick(page, '[data-testid="address-dialog-save"]', {
    allowOverlay: true,
  });

  // Verify the dialog closed and name was updated
  await page.waitForSelector('[data-testid="address-dialog"]', {
    state: "hidden",
    timeout: 2000,
  });
  await expect(page.getByText("Address updated successfully")).toBeVisible();
  await expect(page.getByText("test rename")).toBeVisible();
  console.log("Address rename verified");
};
