import { test, expect } from "./test-environment.js";
import testData from "../../test-data/keys.json" with { type: 'json' };
import testDb from "../../server/db.test.json" with { type: 'json' };
import { addCollection, addAddress, addExtendedKey, addDescriptor } from "./test-environment.js";
import { refreshAddressBalance } from "./test-environment.js";

test.describe("Bitwatch", () => {
  // test.beforeEach(async ({}) => {});

  // NOTE: we put all of the sequences of events in a single test to make the tests faster
  // we don't need to load the page fresh, we want to navigate around it like a real user
  test("Bitwatch full test suite", async ({ page }) => {
    // Navigate to the app and wait for it to load
    console.log("Navigating to app...");
    await page.goto("/");
    console.log("Waiting for network idle...");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("text=itwatch");
    console.log("Page loaded");

    // Wait for server connection
    console.log("Waiting for server connection...");
    await page.waitForSelector('[aria-label="Server status: CONNECTED"]');
    const serverState = await page.evaluate(() => {
      const statusElement = document.querySelector(
        '[aria-label="Server status: CONNECTED"]'
      ).parentElement;
      return statusElement.querySelector("p").textContent;
    });
    expect(serverState).toBe("Server");
    console.log("Server connected");

    // Wait for WebSocket connection
    console.log("Waiting for WebSocket connection...");
    await page.waitForSelector('[aria-label="WebSocket status: CONNECTED"]');
    const websocketState = await page.evaluate(() => {
      const statusElement = document.querySelector(
        '[aria-label="WebSocket status: CONNECTED"]'
      ).parentElement;
      return statusElement.querySelector("p").textContent;
    });
    expect(websocketState).toBe("WebSocket");
    console.log("WebSocket connected");
    // Click the settings button
    await page.getByTestId("settings-button").click();
    console.log("Settings opened");

    // Verify default test values first
    await expect(page.getByTestId("config-api")).toHaveValue(testDb.api);
    await expect(page.getByTestId("config-interval")).toHaveValue(testDb.interval.toString());
    await expect(page.getByTestId("config-apiDelay")).toHaveValue(testDb.apiDelay.toString());
    await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue(testDb.apiParallelLimit.toString());
    await expect(page.getByTestId("config-debugLogging")).not.toBeChecked();

    // Switch to public mode and verify public settings
    await page.getByTestId("use-public-api").click();
    console.log("Switched to public mode");
    await expect(page.getByTestId("config-api")).toHaveValue("https://mempool.space");
    await expect(page.getByTestId("config-interval")).toHaveValue("600000");
    await expect(page.getByTestId("config-apiDelay")).toHaveValue("2000");
    await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue("1");

    // Switch to private mode and verify private settings
    await page.getByTestId("use-local-node").click();
    console.log("Switched to private mode");
    await expect(page.getByTestId("config-api")).toHaveValue("http://10.21.21.26:3006");
    await expect(page.getByTestId("config-interval")).toHaveValue("60000");
    await expect(page.getByTestId("config-apiDelay")).toHaveValue("100");
    await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue("100");

    // Return to test settings
    await page.getByTestId("use-public-api").click();
    console.log("Returned to public mode");
    await page.getByTestId("config-api").fill(testDb.api);
    await page.getByTestId("config-interval").fill(testDb.interval.toString());
    await page.getByTestId("config-apiDelay").fill(testDb.apiDelay.toString());
    await page.getByTestId("config-apiParallelLimit").fill(testDb.apiParallelLimit.toString());
    await page.getByTestId("config-debugLogging").click();
    await expect(page.getByTestId("config-debugLogging")).toBeChecked();
    console.log("Restored test settings");

    // Save configuration
    await page.getByTestId("save-configuration").click();
    console.log("Saved configuration");

    // Verify success notification
    await expect(page.getByTestId("config-notification")).toBeVisible();
    await expect(page.getByTestId("config-notification")).toContainText(
      "Configuration saved successfully"
    );
    // Dismiss the notification
    await page.getByTestId("config-notification").getByRole("button", { name: "Close" }).click();
    console.log("Verified success notification");

    // Navigate to integrations
    await page.getByTestId("integrations-button").click();
    console.log("Integrations opened");
    // Fill in Telegram configuration
    await page.fill(
      "#telegram-token",
      "123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789"
    );
    await page.fill("#telegram-chatid", "test-chat-id");
    console.log("Telegram config filled");

    // Save the configuration
    await page.getByRole("button", { name: "Save Integrations" }).click();
    console.log("Integrations saved");

    // Wait for the success notification
    await page.waitForSelector("text=Integrations saved successfully");
    console.log("Success notification shown");

    // Verify the success notification
    const notification = page.getByRole("alert");
    await expect(notification).toBeVisible();
    await expect(notification).toContainText("Integrations saved successfully");
    await expect(notification).toHaveClass(/MuiAlert-standardSuccess/);
    // Dismiss the notification
    await notification.getByRole("button", { name: "Close" }).click();
    console.log("Success notification verified");

    // Navigate to addresses page
    await page.getByTestId("watch-list-button").click();
    console.log("Navigated to addresses page");

    // Add a new collection
    await addCollection(page, "Donations");
    console.log("Added test collection");

    // Add single address
    await addAddress(page, "Donations", {
      name: "zapomatic",
      address: testData.addresses.zapomatic
    });
    console.log("Added single address");

    // Verify address is visible in the expanded table
    await expect(page.locator('text=Single Addresses')).toBeVisible();
    await expect(page.locator('table.address-subtable')).toBeVisible();
    await expect(page.locator(`text=${testData.addresses.zapomatic.slice(0, 8)}...`)).toBeVisible();
    console.log("Verified address table is visible");

    // Test refresh balance functionality for each state transition
    console.log("Testing refresh balance functionality for all states");

    // Initial state (all zeros)
    await refreshAddressBalance(page, testData.addresses.zapomatic, {
      chain_in: "0.00000000 ₿",
      chain_out: "0.00000000 ₿",
      mempool_in: "0.00000000 ₿",
      mempool_out: "0.00000000 ₿"
    });
    console.log("Initial zero balance state verified");

    // Refresh to get mempool input state
    await refreshAddressBalance(page, testData.addresses.zapomatic, {
      mempool_in: "0.00010000 ₿"
    });
    console.log("Mempool input state verified");

    // Refresh to get chain input state
    await refreshAddressBalance(page, testData.addresses.zapomatic, {
      chain_in: "0.00010000 ₿"
    });
    console.log("Chain input state verified");

    // Refresh to get mempool output state
    await refreshAddressBalance(page, testData.addresses.zapomatic, {
      mempool_out: "0.00001000 ₿"
    });
    // Wait for the diff to appear and have the correct value
    await expect(page.getByTestId(`${testData.addresses.zapomatic}-mempool-out-diff`)).toBeVisible();
    await expect(page.getByTestId(`${testData.addresses.zapomatic}-mempool-out-diff`)).toHaveText("(+0.00001000 ₿)");
    // Verify accept button for address change state
    await expect(page.getByTestId(`${testData.addresses.zapomatic}-accept-button`)).toBeVisible();
    console.log("Mempool output state verified");
    
    // Refresh to get chain output state
    await refreshAddressBalance(page, testData.addresses.zapomatic, {
      chain_out: "0.00001000 ₿"
    });
    await expect(page.getByTestId(`${testData.addresses.zapomatic}-chain-out-diff`)).toBeVisible();
    await expect(page.getByTestId(`${testData.addresses.zapomatic}-chain-out-diff`)).toHaveText("(+0.00001000 ₿)");
    // Verify alert icon and accept button for chain-out
    await expect(page.getByTestId(`${testData.addresses.zapomatic}-chain-out-alert-icon`)).toBeVisible();
    await expect(page.getByTestId(`${testData.addresses.zapomatic}-accept-button`)).toBeVisible();
    console.log("Chain output state verified");

    // Accept the chain-out change
    await page.getByTestId(`${testData.addresses.zapomatic}-accept-button`).click();
    // verify that the change took (no longer showing a diff)
    await expect(page.getByTestId(`${testData.addresses.zapomatic}-chain-out-diff`)).not.toBeVisible();

    // Final refresh to verify all states are stable
    await refreshAddressBalance(page, testData.addresses.zapomatic, {
      chain_in: "0.00010000 ₿",
      chain_out: "0.00001000 ₿",
      mempool_in: "0.00000000 ₿",
      mempool_out: "0.00000000 ₿"
    });
    console.log("Final stable state verified");

    // Verify collection balance totals (subtract out from in on every address in the collection--single, extended, descriptor)
    // First find the Donations collection row
    const donationsRow = page.locator('tr.collection-row', { has: page.getByText('Donations') });
    // Then find the On-Chain and Mempool cells within that row
    await expect(donationsRow.locator('td', { hasText: '0.00009000 ₿' }).first()).toBeVisible();
    await expect(donationsRow.locator('td', { hasText: '0.00000000 ₿' }).first()).toBeVisible();

    // Add extended keys (xpub, ypub, zpub)
    const extendedKeys = [
      {
        name: "Test XPub",
        key: testData.keys.xpub1,
        derivationPath: "m/0",
        skip: 1,
        gapLimit: 3,
        initialAddresses: 3
      },
      {
        name: "Test YPub",
        key: testData.keys.ypub1,
        derivationPath: "m/0",
        skip: 1,
        gapLimit: 3,
        initialAddresses: 3
      },
      {
        name: "Test ZPub",
        key: testData.keys.zpub1,
        derivationPath: "m/0",
        skip: 1,
        gapLimit: 3,
        initialAddresses: 3
      }
    ];

    for (const key of extendedKeys) {
      await addExtendedKey(page, "Donations", key);
      console.log(`Added ${key.name}`);

      // Verify the key-derived addresses section is visible
      await expect(page.getByText("Key-Derived Addresses")).toBeVisible();

      // Find the extended key row
      const keyRow = page.locator('tr.crystal-table-row', { has: page.getByText(key.name) });
      
      // Verify extended key information
      await expect(keyRow.locator('td').nth(0)).toContainText(key.name);
      await expect(keyRow.locator('td').nth(1)).toContainText(key.key.slice(0, 8));
      await expect(keyRow.locator('td').nth(2)).toContainText(key.derivationPath);
      await expect(keyRow.locator('td').nth(3)).toContainText(key.gapLimit.toString());
      await expect(keyRow.locator('td').nth(4)).toContainText(key.skip.toString());
      await expect(keyRow.locator('td').nth(5)).toContainText(key.initialAddresses.toString());

      // Initially we should see just the initial addresses
      await expect(keyRow.locator('td').nth(6)).toContainText('3');
      const addressRows = page.locator(`tr.crystal-table-row:has-text("${key.name}") + tr.address-subtable tr.address-row`);
      await expect(addressRows).toHaveCount(3);

      // Click the refresh button to trigger balance checks
      await page.getByTestId(`${key.key}-refresh-all-button`).click();
      console.log("Clicked refresh button for extended key");

      // Wait for the engine to detect balances and generate more addresses
      // The address count should increase to 6 as gap limit addresses are added
      await expect(keyRow.locator('td').nth(6)).toContainText('4');
      await expect(addressRows).toHaveCount(4);

      // Verify the first address index starts at 1 (due to skip)
      const firstAddressText = await addressRows.first().textContent();
      expect(firstAddressText).toContain(`${key.name} 1`);

      // Verify the last address index is 4
      const lastAddressText = await addressRows.last().textContent();
      expect(lastAddressText).toContain(`${key.name} 4`);

      // Verify the first address has chain balance
      await expect(addressRows.nth(0).locator('[data-testid$="chain-in"]')).toHaveText("0.00010000 ₿");
      
      // Verify remaining addresses have zero balance
      for (let i = 1; i < 4; i++) {
        await expect(addressRows.nth(i).locator('[data-testid$="chain-in"]')).toHaveText("0.00000000 ₿");
      }

      // Delete extended key
      await page.getByTestId(`${key.key}-delete-button`).click();
      console.log("Deleted extended key");
    }

    // Add descriptors
    const descriptors = [
      {
        name: "Test MultiSig",
        descriptor: testData.descriptors.multiSig,
        skip: 1,
        gapLimit: 3,
        initialAddresses: 3
      },
      {
        name: "Test SortedMultiSig",
        descriptor: testData.descriptors.sortedMultiSig,
        skip: 1,
        gapLimit: 3,
        initialAddresses: 3
      },
      {
        name: "Test MixedKeyTypes",
        descriptor: testData.descriptors.mixedKeyTypes,
        skip: 1,
        gapLimit: 3,
        initialAddresses: 3
      }
    ];

    for (const descriptor of descriptors) {
      await addDescriptor(page, "Donations", descriptor);
      console.log(`Added ${descriptor.name}`);

      // Verify the key-derived addresses section is visible
      await expect(page.getByText("Key-Derived Addresses")).toBeVisible();

      // Verify we have the expected number of addresses (initial + gap limit)
      // We expect 6 addresses total:
      // - 3 initial addresses (skipping index 0)
      // - 3 more to satisfy gap limit after finding activity
      const addressRows = page.locator('tr.address-row').filter({ hasText: descriptor.name });
      await expect(addressRows).toHaveCount(6);

      // Verify the first address index starts at 1 (due to skip)
      const firstAddressText = await addressRows.first().textContent();
      expect(firstAddressText).toContain(`${descriptor.name} 1`);

      // Verify the last address index is 6
      const lastAddressText = await addressRows.last().textContent();
      expect(lastAddressText).toContain(`${descriptor.name} 6`);

      // Verify the first two addresses have chain balance
      await expect(addressRows.nth(0).locator('[data-testid$="chain-in"]')).toHaveText("0.00010000 ₿");
      await expect(addressRows.nth(1).locator('[data-testid$="chain-in"]')).toHaveText("0.00010000 ₿");
      
      // Verify remaining addresses have zero balance
      for (let i = 2; i < 6; i++) {
        await expect(addressRows.nth(i).locator('[data-testid$="chain-in"]')).toHaveText("0.00000000 ₿");
      }

      // Delete descriptor
      await page.getByTestId(`${descriptor.descriptor}-delete-button`).click();
      console.log("Deleted descriptor");
    }

    // Delete the single address we added at the start
    await page.getByTestId(`${testData.addresses.zapomatic}-delete-button`).click();
    console.log("Clicked delete button");
    
    // Wait for dialog to be fully rendered
    await page.waitForTimeout(500);
    
    // Verify delete confirmation dialog appears with correct message
    await expect(page.getByRole("heading", { name: "Confirm Delete" })).toBeVisible();
    await expect(page.getByText("Remove this address from the collection?")).toBeVisible();
    // Confirm deletion
    await page.getByRole("button", { name: "Delete" }).click();
    console.log("Deleted address");
    // verify that the address is deleted
    await expect(page.getByTestId(`${testData.addresses.zapomatic}-delete-button`)).not.toBeVisible();
    // verify that the collection still exists
    await expect(page.getByTestId("Donations-add-address")).toBeVisible();

    // Delete collection
    await page.getByTestId("Donations-delete").click();
    console.log("Deleted Donations collection");
  });
});
