import { test, expect } from "./test-environment.js";
import testData from "../../test-data/keys.json" with { type: 'json' };
import testDb from "../../server/db.test.json" with { type: 'json' };
import { addCollection, addAddress, addExtendedKey, addDescriptor, findAndClick } from "./test-environment.js";
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
    }, 0);
    console.log("Initial zero balance state verified");

    // Refresh to get mempool input state
    await refreshAddressBalance(page, testData.addresses.zapomatic, {
      mempool_in: "0.00010000 ₿"
    }, 0);
    console.log("Mempool input state verified");

    // Refresh to get chain input state
    await refreshAddressBalance(page, testData.addresses.zapomatic, {
      chain_in: "0.00010000 ₿"
    }, 0);
    console.log("Chain input state verified");

    // Refresh to get mempool output state
    await refreshAddressBalance(page, testData.addresses.zapomatic, {
      mempool_out: "0.00001000 ₿"
    }, 0);
    // Wait for the diff to appear and have the correct value
    await expect(page.getByTestId(`${testData.addresses.zapomatic}-mempool-out-diff`)).toBeVisible();
    await expect(page.getByTestId(`${testData.addresses.zapomatic}-mempool-out-diff`)).toHaveText("(+0.00001000 ₿)");
    // Verify accept button for address change state
    await expect(page.getByTestId(`${testData.addresses.zapomatic}-accept-button`)).toBeVisible();
    console.log("Mempool output state verified");
    
    // Refresh to get chain output state
    await refreshAddressBalance(page, testData.addresses.zapomatic, {
      chain_out: "0.00001000 ₿"
    }, 0);
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
    }, 0);
    console.log("Final stable state verified");

    // Verify collection balance totals
    const donationsRow = page.locator('tr.collection-row', { has: page.getByText('Donations') });
    await expect(donationsRow.locator('td', { hasText: '0.00009000 ₿' }).first()).toBeVisible();
    await expect(donationsRow.locator('td', { hasText: '0.00000000 ₿' }).first()).toBeVisible();

    // Test editing the single address
    await page.getByTestId(`${testData.addresses.zapomatic}-edit-button`).click();
    await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
    await expect(page.getByTestId("address-name-input")).toHaveValue("zapomatic");
    await expect(page.getByTestId("address-input")).toHaveValue(testData.addresses.zapomatic);
    
    // Change the name
    await page.getByTestId("address-name-input").fill("test rename");
    await page.getByTestId("address-dialog-save").click();
    
    // Verify the dialog closed and name was updated
    await expect(page.locator('[data-testid="address-dialog"]')).not.toBeVisible();
    await expect(page.getByText("Address updated successfully")).toBeVisible();
    await expect(page.getByText("test rename")).toBeVisible();
    console.log("Address rename verified");

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
      const addressRows = page.locator(`[data-testid="${key.key}-address-list"] tr.address-row`);
      await expect(addressRows).toHaveCount(3);

      // Verify the loading state
      await expect(page.getByTestId(`${key.key}-address-1-chain-in`)).toContainText("Loading...");
      // First test single address refresh
      await page.getByTestId(`${key.key}-address-1-refresh-button`).click();
      await expect(page.getByText("Balance refreshed successfully")).toBeVisible();
      // Wait for and verify the balance update
      await expect(page.getByTestId(`${key.key}-address-1-chain-in`)).toContainText("0.00000000 ₿");
      await page.getByTestId(`${key.key}-address-1-refresh-button`).click();
      await expect(page.getByTestId(`${key.key}-address-1-mempool-in`)).toContainText("0.00010000 ₿");
      await expect(page.getByTestId(`${key.key}-address-2-chain-in`)).toContainText("Loading...");

      // Then test full row refresh
      await page.getByTestId(`${key.key}-refresh-all-button`).click();
      console.log("Clicked refresh button for extended key");

      // Verify we have the expected number of addresses (initial + gap limit)
      await expect(addressRows).toHaveCount(4);

      // Verify remaining addresses have zero balance
      for (let i = 2; i <= 4; i++) {
        await expect(page.locator(`[data-testid="${key.key}-address-${i}-chain-in"]`)).toHaveText("0.00000000 ₿");
      }

      // If this is the first extended key, test editing an address
      if (key.name === "Test XPub") {
        // Edit the first derived address
        await page.getByTestId(`${key.key}-address-1-edit-button`).click();
        
        // Wait for the dialog to be visible
        await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
        await expect(page.getByTestId("address-name-input")).toHaveValue(`${key.name} 1`);
        
        // Change the name
        await page.getByTestId("address-name-input").fill(`${key.name} 1 Edited`);
        await page.getByTestId("address-dialog-save").click();
        
        // Verify the dialog closed and name was updated
        await expect(page.locator('[data-testid="address-dialog"]')).not.toBeVisible();
        await expect(page.getByText("Address updated successfully")).toBeVisible();
        await expect(page.getByTestId(`${key.key}-address-1-name`)).toContainText(`${key.name} 1 Edited`);
        console.log(`Edited address name in ${key.name}`);
      }

      // Collapse the extended key section after testing
      await page.getByTestId(`${key.key}-expand-button`).click();
      console.log(`Collapsed ${key.name} section`);
    }

    // Add descriptors (pkh, sh(wpkh), wpkh, wsh(multi), wsh(sortedmulti), wsh(multi-mixed))
    const descriptors = [
      {
        name: "Single XPub",
        descriptor: testData.descriptors.xpubSingle,
        derivationPath: "m/0",
        skip: 1,
        gapLimit: 3,
        initialAddresses: 3
      },
      {
        name: "Single YPub",
        descriptor: testData.descriptors.ypubSingle,
        derivationPath: "m/0",
        skip: 1,
        gapLimit: 3,
        initialAddresses: 3
      },
      {
        name: "Single ZPub",
        descriptor: testData.descriptors.zpubSingle,
        derivationPath: "m/0",
        skip: 1,
        gapLimit: 3,
        initialAddresses: 3
      },
      {
        name: "Multi-Sig",
        descriptor: testData.descriptors.multiSig,
        derivationPath: "m/0",
        skip: 1,
        gapLimit: 3,
        initialAddresses: 3
      },
      {
        name: "Sorted Multi-Sig",
        descriptor: testData.descriptors.sortedMultiSig,
        derivationPath: "m/0",
        skip: 1,
        gapLimit: 3,
        initialAddresses: 3
      },
      {
        name: "Mixed Key Types",
        descriptor: testData.descriptors.mixedKeyTypes,
        derivationPath: "m/0",
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

      // Wait for the descriptor row to be visible
      await expect(page.getByTestId(`${descriptor.descriptor}-descriptor-row`)).toBeVisible();

      // Find the descriptor row
      const descriptorRow = page.getByTestId(`${descriptor.descriptor}-descriptor-row`);
      
      // Verify descriptor information
      await expect(descriptorRow.locator('td').nth(0)).toContainText(descriptor.name);
      await expect(descriptorRow.locator('td').nth(1)).toContainText(descriptor.descriptor.slice(0, 8));
      await expect(descriptorRow.locator('td').nth(2)).toContainText(descriptor.derivationPath || "m/0");
      await expect(descriptorRow.locator('td').nth(3)).toContainText(descriptor.gapLimit.toString());
      await expect(descriptorRow.locator('td').nth(4)).toContainText(descriptor.skip.toString());
      await expect(descriptorRow.locator('td').nth(5)).toContainText(descriptor.initialAddresses.toString());

      // Test refreshing a single descriptor address
      await expect(page.getByTestId(`${descriptor.descriptor}-address-1-chain-in`)).toContainText("Loading...");
      await page.getByTestId(`${descriptor.descriptor}-address-1-refresh-button`).click();
      await expect(page.getByText("Balance refreshed successfully")).toBeVisible();
      await expect(page.getByTestId(`${descriptor.descriptor}-address-1-chain-in`)).toContainText("0.00000000 ₿");
            await page.getByTestId(`${descriptor.descriptor}-address-1-refresh-button`).click();
      await expect(page.getByTestId(`${descriptor.descriptor}-address-1-mempool-in`)).toContainText("0.00010000 ₿");

      // If this is the first descriptor, test editing and deleting addresses
      if (descriptor.name === "Single XPub") {
        // Edit the first derived address
        await page.getByTestId(`${descriptor.descriptor}-address-1-edit-button`).click();
        
        // Wait for the dialog to be visible
        await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
        await expect(page.getByTestId("address-name-input")).toHaveValue(`${descriptor.name} 1`);
        
        // Change the name
        await page.getByTestId("address-name-input").fill(`${descriptor.name} 1 Edited`);
        await page.getByTestId("address-dialog-save").click();
        
        // Verify the dialog closed and name was updated
        await expect(page.locator('[data-testid="address-dialog"]')).not.toBeVisible();
        await expect(page.getByText("Address updated successfully")).toBeVisible();
        await expect(page.getByTestId(`${descriptor.descriptor}-address-1-name`)).toContainText(`${descriptor.name} 1 Edited`);
        console.log(`Edited address name in ${descriptor.name}`);

        // Delete the first derived address
        await page.getByTestId(`${descriptor.descriptor}-address-1-delete-button`).click();
        
        // Confirm deletion in dialog
        await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
        await expect(page.getByText("Remove this address from the descriptor set?")).toBeVisible();
        await findAndClick(page, '[data-testid="delete-confirmation-confirm"]', { allowOverlay: true });
        
        // Wait for dialog to close and verify deletion
        await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
        await expect(page.getByTestId(`${descriptor.descriptor}-address-1-delete-button`)).not.toBeVisible();
        console.log("Deleted single address from descriptor");
      }

      // Collapse the descriptor section after testing
      await page.getByTestId(`${descriptor.descriptor}-expand-button`).click();
      console.log(`Collapsed ${descriptor.name} section`);

      // Delete the descriptor
      await page.getByTestId(`${descriptor.descriptor}-delete-button`).click();
      
      // Confirm deletion in dialog
      await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
      await expect(page.getByText("Delete this descriptor and all its derived addresses?")).toBeVisible();
      await findAndClick(page, '[data-testid="delete-confirmation-confirm"]', { allowOverlay: true });
      
      // Wait for dialog to close
      await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
      console.log(`Deleted ${descriptor.name}`);
    }

    // Now that we've verified all balances, we can delete everything
    for (const key of extendedKeys) {
      // First delete a single address from the extended key
      if (key.name === "Test XPub") {
        // Expand the section before deleting
        await page.getByTestId(`${key.key}-expand-button`).click();
        console.log(`Expanded ${key.name} section for deletion`);

        // Delete the first derived address
        await page.getByTestId(`${key.key}-address-1-delete-button`).click();
        
        // Confirm deletion in dialog
        await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
        await expect(page.getByText("Remove this address from the extended key set?")).toBeVisible();
        await findAndClick(page, '[data-testid="delete-confirmation-confirm"]', { allowOverlay: true });
        
        // Wait for dialog to close and verify deletion
        await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
        await expect(page.getByTestId(`${key.key}-address-1-delete-button`)).not.toBeVisible();
        console.log("Deleted single address from extended key");

        // Collapse the section after deletion
        await page.getByTestId(`${key.key}-expand-button`).click();
        console.log(`Collapsed ${key.name} section after deletion`);
      }

      // Delete extended key
      await page.getByTestId(`${key.key}-delete-button`).click();
      
      // Confirm deletion in dialog
      await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
      await expect(page.getByText("Delete this extended key and all its derived addresses?")).toBeVisible();
      await findAndClick(page, '[data-testid="delete-confirmation-confirm"]', { allowOverlay: true });
      
      // Wait for dialog to close
      await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
      console.log(`Deleted ${key.name}`);
    }

    // Delete the single address we added at the start
    await page.getByTestId(`${testData.addresses.zapomatic}-delete-button`).click();
    
    // Verify delete confirmation dialog appears with correct message
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
    await expect(page.getByText("Remove this address from the collection?")).toBeVisible();
    
    // Confirm deletion
    await findAndClick(page, '[data-testid="delete-confirmation-confirm"]', { allowOverlay: true });
    
    // Wait for dialog to close and verify deletion
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
    await expect(page.getByTestId(`${testData.addresses.zapomatic}-delete-button`)).not.toBeVisible();
    await expect(page.getByTestId("Donations-add-address")).toBeVisible();
    console.log("Deleted single address");

    // Delete collection
    await page.getByTestId("Donations-delete").click();
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
    await expect(page.getByText("Delete this collection and all its addresses?")).toBeVisible();
    await findAndClick(page, '[data-testid="delete-confirmation-confirm"]', { allowOverlay: true });
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
    console.log("Deleted Donations collection");
  });
});
