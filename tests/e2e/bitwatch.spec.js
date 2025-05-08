import { test, expect } from "./test-environment.js";
import testData from "../../test-data/keys.json" with { type: 'json' };
import testDb from "../../server/db.test.json" with { type: 'json' };
import { addCollection, addAddress, addExtendedKey, addDescriptor, findAndClick } from "./test-environment.js";
import { refreshAddressBalance, verifyAddressBalance } from "./test-environment.js";

test.describe("Bitwatch", () => {
  // NOTE: we put all of the sequences of events in a single test to make the tests faster
  // we don't need to load the page fresh, we want to navigate around it like a real user
  test("Bitwatch full test suite", async ({ page }) => {
    // Navigate to the app and wait for it to load
    console.log("Navigating to app...");
    await page.goto("/");
    console.log("Waiting for network idle...");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("text=bitwatch");
    console.log("Page loaded");

    // Small delay to ensure page is fully loaded
    await page.waitForTimeout(1000);

    // Wait for status indicators to be present
    console.log("Waiting for status indicators...");
    await page.waitForSelector('[data-testid="bitwatch-socket-status"]');
    await page.waitForSelector('[data-testid="mempool-socket-status"]');

    // Verify the states
    const serverState = await page.evaluate(() => {
      const statusElement = document.querySelector('[data-testid="bitwatch-socket-status"]');
      return statusElement.textContent;
    });
    expect(serverState).toBe("Bitwatch Socket");
    console.log("Server connected");

    const websocketState = await page.evaluate(() => {
      const statusElement = document.querySelector('[data-testid="mempool-socket-status"]');
      return statusElement.textContent;
    });
    expect(websocketState).toBe("Mempool Socket");
    console.log("Mempool Socket connected");

    // Click the settings button
    await findAndClick(page, '[data-testid="settings-button"]');
    console.log("Settings opened");

    // Verify default test values first
    await expect(page.getByTestId("config-api")).toHaveValue(testDb.api);
    await expect(page.getByTestId("config-interval")).toHaveValue(testDb.interval.toString());
    await expect(page.getByTestId("config-apiDelay")).toHaveValue(testDb.apiDelay.toString());
    await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue(testDb.apiParallelLimit.toString());
    await expect(page.getByTestId("config-debugLogging")).not.toBeChecked();

    // Switch to public mode and verify public settings
    await findAndClick(page, '[data-testid="use-public-api"]');
    console.log("Switched to public mode");
    await expect(page.getByTestId("config-api")).toHaveValue("https://mempool.space");
    await expect(page.getByTestId("config-interval")).toHaveValue("600000");
    await expect(page.getByTestId("config-apiDelay")).toHaveValue("2000");
    await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue("1");

    // Switch to private mode and verify private settings
    await findAndClick(page, '[data-testid="use-local-node"]');
    console.log("Switched to private mode");
    await expect(page.getByTestId("config-api")).toHaveValue("http://10.21.21.26:3006");
    await expect(page.getByTestId("config-interval")).toHaveValue("60000");
    await expect(page.getByTestId("config-apiDelay")).toHaveValue("100");
    await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue("100"); 
    await findAndClick(page, '[data-testid="config-debugLogging"]');
    await expect(page.getByTestId("config-debugLogging")).toBeChecked();

    // Return to test settings
    await page.getByTestId("config-api").fill(testDb.api);
    await page.getByTestId("config-interval").fill(testDb.interval.toString());
    await page.getByTestId("config-apiDelay").fill(testDb.apiDelay.toString());
    await page.getByTestId("config-apiParallelLimit").fill(testDb.apiParallelLimit.toString());
    await findAndClick(page, '[data-testid="config-debugLogging"]');
    await expect(page.getByTestId("config-debugLogging")).not.toBeChecked();
    console.log("Restored test settings");

    // Save configuration
    await findAndClick(page, '[data-testid="save-configuration"]');
    console.log("Saved configuration");

    // Verify success notification
    const configNotification = page.getByTestId("config-notification");
    await expect(configNotification).toBeVisible();
    await expect(configNotification).toContainText(
      "Configuration saved successfully"
    );
    // Dismiss the notification
    await findAndClick(page, '[data-testid="config-notification"] button', { allowOverlay: true });
    console.log("Verified success notification");

    // Navigate to integrations
    await findAndClick(page, '[data-testid="integrations-button"]');
    console.log("Integrations opened");
    // Fill in Telegram configuration
    await page.fill(
      "#telegram-token",
      "123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789"
    );
    await page.fill("#telegram-chatid", "test-chat-id");
    console.log("Telegram config filled");

    // Save the configuration
    await findAndClick(page, '[data-testid="save-integrations"]');
    console.log("Integrations saved");

    // Wait for the success notification
    const notification = page.getByRole("alert");
    await expect(notification).toBeVisible();
    await expect(notification).toContainText("Integrations saved successfully");
    await expect(notification).toHaveClass(/MuiAlert-standardSuccess/);
    // Dismiss the notification
    await findAndClick(page, '[role="alert"] button', { allowOverlay: true });
    console.log("Success notification verified");

    // Navigate to addresses page
    await findAndClick(page, '[data-testid="watch-list-button"]');
    console.log("Navigated to addresses page");

    // Add a new collection
    await addCollection(page, "Donations");
    console.log("Added test collection");

    // Add single address
    await addAddress(page, "Donations", {
      name: "zapomatic",
      address: testData.plain.zapomatic,
      monitor: {
        chain_in: "auto-accept",
        chain_out: "alert",
        mempool_in: "auto-accept",
        mempool_out: "alert"
      }
    });
    console.log("Added single address");

    // Verify address is visible in the expanded table
    await expect(page.locator('text=Single Addresses')).toBeVisible();
    await expect(page.locator('table.address-subtable')).toBeVisible();
    await expect(page.locator(`text=${testData.plain.zapomatic.slice(0, 15)}...`)).toBeVisible();
    console.log("Verified address table is visible");

    // Test refresh balance functionality for each state transition
    console.log("Testing refresh balance functionality for all states");

    // Initial state (all zeros)
    await refreshAddressBalance(page, testData.plain.zapomatic, {
      chain_in: "0.00000000 ₿",
      chain_out: "0.00000000 ₿",
      mempool_in: "0.00000000 ₿",
      mempool_out: "0.00000000 ₿"
    }, 0);
    console.log("Initial zero balance state verified");

    // Refresh to get mempool input state
    await refreshAddressBalance(page, testData.plain.zapomatic, {
      chain_in: "0.00000000 ₿",
      chain_out: "0.00000000 ₿",
      mempool_in: "0.00010000 ₿",
      mempool_out: "0.00000000 ₿"
    }, 0);
    console.log("Mempool input state verified");

    // Refresh to get chain input state
    await refreshAddressBalance(page, testData.plain.zapomatic, {
      chain_in: "0.00010000 ₿",
      chain_out: "0.00000000 ₿",
      mempool_in: "0.00000000 ₿",
      mempool_out: "0.00000000 ₿"
    }, 0);
    console.log("Chain input state verified");

    // Refresh to get mempool output state
    await refreshAddressBalance(page, testData.plain.zapomatic, {
      chain_in: "0.00010000 ₿",
      chain_out: "0.00000000 ₿",
      mempool_in: "0.00000000 ₿",
      mempool_out: "0.00001000 ₿"
    }, 0);
    // Wait for the diff to appear and have the correct value
    await expect(page.getByTestId(`${testData.plain.zapomatic}-mempool-out-diff`)).toBeVisible();
    await expect(page.getByTestId(`${testData.plain.zapomatic}-mempool-out-diff`)).toHaveText("(+0.00001000 ₿)");
    // Verify accept button for address change state
    await expect(page.getByTestId(`${testData.plain.zapomatic}-accept-button`)).toBeVisible();
    console.log("Mempool output state verified");
    
    // Refresh to get chain output state
    await refreshAddressBalance(page, testData.plain.zapomatic, {
      chain_in: "0.00010000 ₿",
      chain_out: "0.00001000 ₿",
      mempool_in: "0.00000000 ₿",
      mempool_out: "0.00000000 ₿"
    }, 0);
    const testId = testData.plain.zapomatic;
    await expect(page.getByTestId(`${testId}-chain-out-diff`)).toBeVisible();
    await expect(page.getByTestId(`${testId}-chain-out-diff`)).toHaveText("(+0.00001000 ₿)");
    // Verify alert icon and accept button for chain-out
    await expect(page.getByTestId(`${testId}-chain-out-alert-icon`)).toBeVisible();
    await expect(page.getByTestId(`${testId}-accept-button`)).toBeVisible();
    console.log("Chain output state verified");

    // Accept the chain-out change
    await findAndClick(page, `[data-testid="${testData.plain.zapomatic}-accept-button"]`);
    // verify that the change took (no longer showing a diff)
    await expect(page.getByTestId(`${testData.plain.zapomatic}-chain-out-diff`)).not.toBeVisible();

    // Final refresh to verify all states are stable
    await refreshAddressBalance(page, testData.plain.zapomatic, {
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
    await findAndClick(page, `[data-testid="${testData.plain.zapomatic}-edit-button"]`);
    await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
    await expect(page.getByTestId("address-name-input")).toHaveValue("zapomatic");
    await expect(page.getByTestId("address-input")).toHaveValue(testData.plain.zapomatic);
    
    // Change the name
    await page.getByTestId("address-name-input").fill("test rename");
    await findAndClick(page, '[data-testid="address-dialog-save"]', { allowOverlay: true });
    
    // Verify the dialog closed and name was updated
    await page.waitForSelector('[data-testid="address-dialog"]', { state: "hidden", timeout: 2000 });
    await expect(page.getByText("Address updated successfully")).toBeVisible();
    await expect(page.getByText("test rename")).toBeVisible();
    console.log("Address rename verified");

    // Add extended keys (xpub, ypub, zpub)
    const extendedKeys = [
      {
        name: "Test XPub",  // Base name, index will be added by server
        key: testData.extended.xpub1.key,
        derivationPath: "m/0",
        skip: 2,
        gapLimit: 3,
        initialAddresses: 4,
        monitor: {
          chain_in: "alert",
          chain_out: "alert",
          mempool_in: "alert",
          mempool_out: "alert"
        }
      },
      {
        name: "Test YPub",  // Base name, index will be added by server
        key: testData.extended.ypub1.key,
        derivationPath: "m/0",
        skip: 0,
        gapLimit: 2,
        initialAddresses: 3
      },
      {
        name: "Test ZPub",  // Base name, index will be added by server
        key: testData.extended.zpub1.key,
        derivationPath: "m/0",
        skip: 0,
        gapLimit: 1,
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
      await expect(keyRow.locator('td').nth(1)).toContainText(key.key.slice(0, 15));
      await expect(keyRow.locator('td').nth(2)).toContainText(key.derivationPath);
      await expect(keyRow.locator('td').nth(3)).toContainText(key.gapLimit.toString());
      await expect(keyRow.locator('td').nth(4)).toContainText(key.skip.toString());
      await expect(keyRow.locator('td').nth(5)).toContainText(key.initialAddresses.toString());

      // Initially we should see just the initial addresses
      await expect(keyRow.locator('td').nth(6)).toContainText(key.initialAddresses.toString());
      const addressRows = page.locator(`[data-testid="${key.key}-address-list"] tr.address-row`);
      await expect(addressRows).toHaveCount(key.initialAddresses);

      // when we add an extended key, it should be expanded by default
      await expect(page.locator(`[data-testid="${key.key}-address-list"]`)).toBeVisible();
      // Get all address rows
      const addresses = await page.locator(`[data-testid="${key.key}-address-list"] tr.address-row`).all();
      // Verify we have the expected number of addresses
      expect(addresses.length).toBe(key.initialAddresses);

      // Verify each address has alert icons for all monitoring types
      for (let i = 0; i < addresses.length; i++) {
        const addressIndex = i + key.skip; // Keep it 0-based with skip
        await expect(page.locator(`[data-testid="${key.key}-address-${addressIndex}-chain-in-alert-icon"]`)).toBeVisible();
        await expect(page.locator(`[data-testid="${key.key}-address-${addressIndex}-chain-out-alert-icon"]`)).toBeVisible();
        await expect(page.locator(`[data-testid="${key.key}-address-${addressIndex}-mempool-in-alert-icon"]`)).toBeVisible();
        await expect(page.locator(`[data-testid="${key.key}-address-${addressIndex}-mempool-out-alert-icon"]`)).toBeVisible();

        // Verify the address matches the expected address from test data
        const keyId = key.name.toLowerCase()
          .replace(/\s+/g, '')
          .replace('test', '')
          .toLowerCase() + '1';
        console.log('Looking up extended key:', keyId, 'Available keys:', Object.keys(testData.extended));
        console.log(`Checking address at index ${i} (with skip ${key.skip}), actual index ${i + key.skip}`);
        const expectedAddress = testData.extended[keyId].addresses[i + key.skip].address;
        const addressCell = page.locator(`[data-testid="${key.key}-address-${addressIndex}-row"] td:nth-child(2)`);
        await expect(addressCell).toContainText(expectedAddress.slice(0, 15));

        // Verify the name shows the correct index
        const nameCell = page.locator(`[data-testid="${key.key}-address-${addressIndex}-name"]`);
        await expect(nameCell).toContainText(`${key.name} ${addressIndex}`);
      }
      // For the first extended key, verify all addresses have alert settings
      if (key.name === "Test XPub") {
        // Test single address refresh using helper (should show 0 balances)
        await refreshAddressBalance(page, key.key, {
          chain_in: "0.00000000 ₿",
          chain_out: "0.00000000 ₿",
          mempool_in: "0.00000000 ₿",
          mempool_out: "0.00000000 ₿"
        }, 2, key.key);  // Index 2 is our first address
        console.log(`Verified initial zero balance for ${key.name} address 2`);

        // Test mempool input state
        await refreshAddressBalance(page, key.key, {
          chain_in: "0.00000000 ₿",
          chain_out: "0.00000000 ₿",
          mempool_in: "0.00010000 ₿",
          mempool_out: "0.00000000 ₿"
        }, 2, key.key);  // Index 2 is our first address
        console.log(`Verified mempool input for ${key.name} address 2`);

        // Then test full row refresh
        await findAndClick(page, `[data-testid="${key.key}-refresh-all-button"]`);
        console.log("Clicked refresh button for extended key");

        // Verify we have the expected number of addresses (just initial addresses)
        await expect(page.locator(`[data-testid="${key.key}-address-list"] tr.address-row`)).toHaveCount(key.initialAddresses);

        await verifyAddressBalance(page, key.key, {
            chain_in: "0.00010000 ₿",
            chain_out: "0.00000000 ₿",
            mempool_in: "0.00000000 ₿",
            mempool_out: "0.00000000 ₿"
        }, 2, key.key);  // Index 2 is our first address

        // Verify balances for all addresses
        for (let i = 3; i < key.initialAddresses + key.skip; i++) {  // Start at 3 since our first address is at 2
          await verifyAddressBalance(page, key.key, {
            chain_in: "0.00000000 ₿",
            chain_out: "0.00000000 ₿",
            mempool_in: "0.00000000 ₿",
            mempool_out: "0.00000000 ₿"
          }, i, key.key);
        }
        // Edit the first derived address (which is at index 2)
        await findAndClick(page, `[data-testid="${key.key}-address-2-edit-button"]`);
        
        // Wait for the dialog to be visible
        await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
        await expect(page.getByTestId("address-name-input")).toHaveValue(`${key.name} 2`);
        
        // Change the name
        await page.getByTestId("address-name-input").fill(`${key.name} 2 Edited`);
        await findAndClick(page, '[data-testid="address-dialog-save"]', { allowOverlay: true });
        
        // Verify the dialog closed and name was updated
        await page.waitForSelector('[data-testid="address-dialog"]', { state: "hidden", timeout: 2000 });
        await expect(page.getByText("Address updated successfully")).toBeVisible();
        await expect(page.getByTestId(`${key.key}-address-2-name`)).toContainText(`${key.name} 2 Edited`);
        console.log(`Edited address name in ${key.name}`);
      }

      // Collapse the extended key section after testing
      await findAndClick(page, `[data-testid="${key.key}-expand-button"]`);
      console.log(`Collapsed ${key.name} section`);
    }

    // Add descriptors (pkh, sh(wpkh), wpkh, wsh(multi), wsh(sortedmulti), wsh(multi-mixed))
    const descriptors = [
      {
        name: "Single XPub",  // Base name, index will be added by server
        descriptor: testData.descriptors.xpubSingle.key,
        derivationPath: "m/0",
        skip: 1,
        gapLimit: 1,
        initialAddresses: 2,
        monitor: {
          chain_in: "alert",
          chain_out: "alert",
          mempool_in: "alert",
          mempool_out: "alert"
        }
      },
      {
        name: "Single YPub",
        descriptor: testData.descriptors.ypubSingle.key,
        derivationPath: "m/0",
        skip: 0,
        gapLimit: 2,
        initialAddresses: 3
      },
      {
        name: "Single ZPub",
        descriptor: testData.descriptors.zpubSingle.key,
        derivationPath: "m/0",
        skip: 0,
        gapLimit: 2,
        initialAddresses: 3
      },
      {
        name: "Multi-Sig",
        descriptor: testData.descriptors.multiSig.key,
        derivationPath: "m/0",
        skip: 0,
        gapLimit: 1,
        initialAddresses: 3
      },
      {
        name: "Sorted Multi-Sig",
        descriptor: testData.descriptors.sortedMultiSig.key,
        derivationPath: "m/0",
        skip: 0,
        gapLimit: 1,
        initialAddresses: 3
      },
      {
        name: "Mixed Key Types",
        descriptor: testData.descriptors.mixedKeyTypes.key,
        derivationPath: "m/0",
        skip: 0,
        gapLimit: 1,
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
      await expect(descriptorRow.locator('td').nth(1)).toContainText(descriptor.descriptor.slice(0, 15));
      await expect(descriptorRow.locator('td').nth(2)).toContainText(descriptor.derivationPath || "m/0");
      await expect(descriptorRow.locator('td').nth(3)).toContainText(descriptor.gapLimit.toString());
      await expect(descriptorRow.locator('td').nth(4)).toContainText(descriptor.skip.toString());
      await expect(descriptorRow.locator('td').nth(5)).toContainText(descriptor.initialAddresses.toString());

      // Initially we should see just the initial addresses
      await expect(descriptorRow.locator('td').nth(6)).toContainText(descriptor.initialAddresses.toString());
      const descriptorAddressRows = page.locator(`[data-testid="${descriptor.descriptor}-address-list"] tr.address-row`);
      await expect(descriptorAddressRows).toHaveCount(descriptor.initialAddresses);

      // For the first descriptor, verify all addresses have alert settings
      if (descriptor.name === "Single XPub") {
        // when we add a descriptor, it should be expanded by default
        await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-list"]`)).toBeVisible();
        
        // Get all address rows
        const addresses = await page.locator(`[data-testid="${descriptor.descriptor}-address-list"] tr.address-row`).all();
        
        // Verify we have the expected number of addresses
        expect(addresses.length).toBe(descriptor.initialAddresses);
        
        // Verify each address has alert icons for all monitoring types and correct addresses
        for (let i = 0; i < addresses.length; i++) {
          const addressIndex = i + descriptor.skip; // Keep it 0-based with skip
          await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-chain-in-alert-icon"]`)).toBeVisible();
          await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-chain-out-alert-icon"]`)).toBeVisible();
          await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-mempool-in-alert-icon"]`)).toBeVisible();
          await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-mempool-out-alert-icon"]`)).toBeVisible();

          // Verify the address matches the expected address from test data
          const descriptorId = descriptor.name.toLowerCase()
            .replace(/\s+/g, '')
            .replace('single', '')
            .toLowerCase() + 'Single';
          console.log('Looking up descriptor:', descriptorId, 'Available descriptors:', Object.keys(testData.descriptors));
          console.log(`Checking address at index ${i} (with skip ${descriptor.skip}), actual index ${i + descriptor.skip}`);
          const expectedAddress = testData.descriptors[`${descriptorId}Single`].addresses[i + descriptor.skip].address;
          const addressCell = page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-row"] td:nth-child(2)`);
          await expect(addressCell).toContainText(expectedAddress.slice(0, 15));

          // Verify the name shows the correct index
          const nameCell = page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-name"]`);
          await expect(nameCell).toContainText(`${descriptor.name} ${addressIndex}`);
        }

        // Trigger a balance change to generate new addresses
        await refreshAddressBalance(page, descriptor.descriptor, {
          chain_in: "0.00010000 ₿"
        }, 1, descriptor.descriptor);

        // Wait for the new addresses to be visible
        await page.waitForTimeout(1000);

        // Get the new list of addresses after derivation
        const newAddresses = await page.locator(`[data-testid="${descriptor.descriptor}-address-list"] tr.address-row`).all();
        
        // Verify we have more addresses than before
        expect(newAddresses.length).toBeGreaterThan(descriptor.initialAddresses);
        
        // Verify new addresses also have alert icons
        for (let i = 0; i < newAddresses.length; i++) {
          const addressIndex = i + 1; // Address indices start at 1
          await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-chain-in-alert-icon"]`)).toBeVisible();
          await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-chain-out-alert-icon"]`)).toBeVisible();
          await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-mempool-in-alert-icon"]`)).toBeVisible();
          await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-mempool-out-alert-icon"]`)).toBeVisible();
        }
      }

      // Test refreshing a single descriptor address using helper
      await refreshAddressBalance(page, descriptor.descriptor, {}, 1, descriptor.descriptor);
      console.log(`Verified initial zero balance for ${descriptor.name} address 1`);

      // Test mempool input state
      await refreshAddressBalance(page, descriptor.descriptor, {
        mempool_in: "0.00010000 ₿"
      }, 1, descriptor.descriptor);
      console.log(`Verified mempool input for ${descriptor.name} address 1`);

      // Test chain input state
      await refreshAddressBalance(page, descriptor.descriptor, {
        chain_in: "0.00010000 ₿"
      }, 1, descriptor.descriptor);
      console.log(`Verified chain input for ${descriptor.name} address 1`);

      // Test mempool output state
      await refreshAddressBalance(page, descriptor.descriptor, {
        mempool_out: "0.00001000 ₿"
      }, 1, descriptor.descriptor);
      console.log(`Verified mempool output for ${descriptor.name} address 1`);

      // Test chain output state
      await refreshAddressBalance(page, descriptor.descriptor, {
        chain_out: "0.00001000 ₿"
      }, 1, descriptor.descriptor);
      console.log(`Verified chain output for ${descriptor.name} address 1`);

      // Accept the chain-out change
      await findAndClick(page, `[data-testid="${descriptor.descriptor}-address-1-accept-button"]`);
      await expect(page.getByTestId(`${descriptor.descriptor}-address-1-chain-out-diff`)).not.toBeVisible();
      console.log(`Accepted balance changes for ${descriptor.name} address 1`);

      // Final refresh to verify all states are stable
      await refreshAddressBalance(page, descriptor.descriptor, {
        chain_in: "0.00010000 ₿",
        chain_out: "0.00001000 ₿"
      }, 1, descriptor.descriptor);
      console.log(`Verified final stable state for ${descriptor.name} address 1`);

      // If this is the first descriptor, test editing and deleting addresses
      if (descriptor.name === "Single XPub") {
        // Edit the first derived address
        await findAndClick(page, `[data-testid="${descriptor.descriptor}-address-1-edit-button"]`);
        
        // Wait for the dialog to be visible
        await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
        await expect(page.getByTestId("address-name-input")).toHaveValue(`${descriptor.name} 1`);
        
        // Change the name
        await page.getByTestId("address-name-input").fill(`${descriptor.name} 1 Edited`);
        await findAndClick(page, '[data-testid="address-dialog-save"]', { allowOverlay: true });
        
        // Verify the dialog closed and name was updated
        await page.waitForSelector('[data-testid="address-dialog"]', { state: "hidden", timeout: 2000 });
        await expect(page.getByText("Address updated successfully")).toBeVisible();
        await expect(page.getByTestId(`${descriptor.descriptor}-address-1-name`)).toContainText(`${descriptor.name} 1 Edited`);
        console.log(`Edited address name in ${descriptor.name}`);
      }

      // Collapse the descriptor section after testing
      await findAndClick(page, `[data-testid="${descriptor.descriptor}-expand-button"]`);
      console.log(`Collapsed ${descriptor.name} section`);
    }

    // Now that we've verified all balances, let's verify monitor settings update
    console.log("Testing monitor settings update...");

    // Navigate to configuration page
    await findAndClick(page, '[data-testid="settings-button"]');
    console.log("Settings opened");

    // Set all monitor settings to alert
    await page.selectOption('[data-testid="config-monitor-chain-in"]', 'alert');
    await page.selectOption('[data-testid="config-monitor-chain-out"]', 'alert');
    await page.selectOption('[data-testid="config-monitor-mempool-in"]', 'alert');
    await page.selectOption('[data-testid="config-monitor-mempool-out"]', 'alert');
    
    // Enable update all addresses
    await findAndClick(page, '[data-testid="config-update-all-addresses"]');
    
    // Save configuration
    await findAndClick(page, '[data-testid="save-configuration"]');
    
    // Verify success notification
    await expect(page.getByTestId("config-notification")).toContainText(
      "Configuration saved successfully and all addresses updated"
    );
    console.log("Monitor settings updated");

    // Navigate back to addresses page
    await findAndClick(page, '[data-testid="watch-list-button"]');
    console.log("Navigated to addresses page");

    // Verify single address monitor settings
    const singleAddress = testData.plain.zapomatic;
    await expect(page.locator(`[data-testid="${singleAddress}-chain-in-alert-icon"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${singleAddress}-chain-out-alert-icon"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${singleAddress}-mempool-in-alert-icon"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${singleAddress}-mempool-out-alert-icon"]`)).toBeVisible();
    console.log("Single address monitor settings verified");

    // Verify extended key address monitor settings (using the first extended key from earlier)
    await findAndClick(page, `[data-testid="${extendedKeys[0].key}-expand-button"]`);
    const extendedKeyAddresses = await page.locator(`[data-testid="${extendedKeys[0].key}-address-list"] tr.address-row`).all();
    for (let i = 0; i < extendedKeyAddresses.length; i++) {
      const addressIndex = i + 1;
      await expect(page.locator(`[data-testid="${extendedKeys[0].key}-address-${addressIndex}-chain-in-alert-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${extendedKeys[0].key}-address-${addressIndex}-chain-out-alert-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${extendedKeys[0].key}-address-${addressIndex}-mempool-in-alert-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${extendedKeys[0].key}-address-${addressIndex}-mempool-out-alert-icon"]`)).toBeVisible();
    }
    await findAndClick(page, `[data-testid="${extendedKeys[0].key}-expand-button"]`);
    console.log("Extended key address monitor settings verified");

    // Verify descriptor address monitor settings (using the first descriptor from earlier)
    await findAndClick(page, `[data-testid="${descriptors[0].descriptor}-expand-button"]`);
    const descriptorAddresses = await page.locator(`[data-testid="${descriptors[0].descriptor}-address-list"] tr.address-row`).all();
    for (let i = 0; i < descriptorAddresses.length; i++) {
      const addressIndex = i + 1;
      await expect(page.locator(`[data-testid="${descriptors[0].descriptor}-address-${addressIndex}-chain-in-alert-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${descriptors[0].descriptor}-address-${addressIndex}-chain-out-alert-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${descriptors[0].descriptor}-address-${addressIndex}-mempool-in-alert-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${descriptors[0].descriptor}-address-${addressIndex}-mempool-out-alert-icon"]`)).toBeVisible();
    }
    await findAndClick(page, `[data-testid="${descriptors[0].descriptor}-expand-button"]`);
    console.log("Descriptor address monitor settings verified");

    // Verify new address dialog defaults
    await findAndClick(page, `[data-testid="Donations-add-address"]`);
    await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
    
    // Check monitor settings in dialog
    await expect(page.locator('select[aria-label="Chain In"]')).toHaveValue('alert');
    await expect(page.locator('select[aria-label="Chain Out"]')).toHaveValue('alert');
    await expect(page.locator('select[aria-label="Mempool In"]')).toHaveValue('alert');
    await expect(page.locator('select[aria-label="Mempool Out"]')).toHaveValue('alert');
    
    // Close dialog
    await findAndClick(page, '[data-testid="address-dialog-cancel"]', { allowOverlay: true });
    console.log("New address dialog defaults verified");

    // Now that we've verified all monitor settings, we can delete everything in a structured way
    console.log("Starting deletion sequence...");

    // 1. Delete a single address from the collection
    await findAndClick(page, `[data-testid="${testData.plain.zapomatic}-delete-button"]`);
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
    await expect(page.getByText("Remove this address from the collection?")).toBeVisible();
    await findAndClick(page, '[data-testid="delete-confirmation-confirm"]', { allowOverlay: true });
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
    await expect(page.getByTestId(`${testData.plain.zapomatic}-delete-button`)).not.toBeVisible();
    console.log("Deleted single address from collection");

    // 2. Delete a single address from the first extended key
    const firstExtendedKey = extendedKeys[0];
    await findAndClick(page, `[data-testid="${firstExtendedKey.key}-expand-button"]`);
    console.log(`Expanded ${firstExtendedKey.name} section for deletion`);
    await findAndClick(page, `[data-testid="${firstExtendedKey.key}-address-1-delete-button"]`);
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
    await expect(page.getByText("Remove this address from the extended key set?")).toBeVisible();
    await findAndClick(page, '[data-testid="delete-confirmation-confirm"]', { allowOverlay: true });
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
    await expect(page.getByTestId(`${firstExtendedKey.key}-address-1-delete-button`)).not.toBeVisible();
    console.log("Deleted single address from extended key");
    const expandButton = page.getByTestId(`${firstExtendedKey.key}-expand-button`);
    await expect(expandButton).toBeVisible();
    await findAndClick(page, `[data-testid="${firstExtendedKey.key}-expand-button"]`);
    console.log(`Collapsed ${firstExtendedKey.name} section`);

    // 3. Delete a single address from the first descriptor
    const firstDescriptor = descriptors[0];
    await findAndClick(page, `[data-testid="${firstDescriptor.descriptor}-expand-button"]`);
    console.log(`Expanded ${firstDescriptor.name} section for deletion`);
    await findAndClick(page, `[data-testid="${firstDescriptor.descriptor}-address-1-delete-button"]`);
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
    await expect(page.getByText("Remove this address from the descriptor set?")).toBeVisible();
    await findAndClick(page, '[data-testid="delete-confirmation-confirm"]', { allowOverlay: true });
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
    await expect(page.getByTestId(`${firstDescriptor.descriptor}-address-1-delete-button`)).not.toBeVisible();
    console.log("Deleted single address from descriptor");
    await findAndClick(page, `[data-testid="${firstDescriptor.descriptor}-expand-button"]`);
    console.log(`Collapsed ${firstDescriptor.name} section`);
  });
});