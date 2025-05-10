import { test, expect } from "./test-environment.js";
import testData from "../../test-data/keys.json" with { type: 'json' };
import { addExtendedKey, addDescriptor, findAndClick } from "./test-environment.js";
import { refreshAddressBalance, verifyAddressBalance } from "./test-environment.js";
import loadApp from "./sequences/loadApp.js";
import configurationPage from "./sequences/configurationPage.js";
import integrationsPage from "./sequences/integrationsPage.js";
import manageCollections from "./sequences/manageCollections.js";
import singleAddress from "./sequences/singleAddress.js";

test.describe("Bitwatch", () => {
  // NOTE: we put all of the sequences of events in a single test to make the tests faster
  // we don't need to load the page fresh, we want to navigate around it like a real user
  // otherwise we might be masking issues that happen when we move around the app
  test("Bitwatch full test suite", async ({ page }) => {
    await loadApp(page);
    await configurationPage(page);
    await integrationsPage(page);
    await manageCollections(page);
    await singleAddress(page);

    // basic settings for extended keys and descriptors
    // we will test editiing these fields after we create them all with these
    const settings = {
      skip: 0,
      gapLimit: 2,
      initialAddresses: 3
    }

    // Add extended keys (xpub, ypub, zpub)
    const extendedKeys = Object.entries(testData.extendedKeys).map(([id, key]) => ({
      name: `Test ${key.type.toUpperCase()}`,  // Base name, index will be added by server
      key: key.key,
      keyId: id,
      derivationPath: key.derivationPath,
      ...settings,
      monitor: id === 'xpub1' ? {
        chain_in: "alert",
        chain_out: "alert",
        mempool_in: "alert",
        mempool_out: "alert"
      } : undefined
    }));

    for (const key of extendedKeys) {
      await addExtendedKey(page, "Donations", key);
      console.log(`Added ${key.name}`);

      const firstAddressIndex = key.skip ? key.skip-1 : 0;

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

        console.log(`Checking address at index ${i} (with skip ${key.skip}), actual index ${i + key.skip}`);
        const expectedAddress = testData.extendedKeys[key.keyId].addresses[i + key.skip].address;
        const addressCell = page.locator(`[data-testid="${key.key}-address-${addressIndex}-row"] td:nth-child(2)`);
        await expect(addressCell).toContainText(expectedAddress.slice(0, 15));

        // Verify the name shows the correct index
        const nameCell = page.locator(`[data-testid="${key.key}-address-${addressIndex}-name"]`);
        await expect(nameCell).toContainText(`${key.name} ${addressIndex}`);
      }
      // For the first extended key, verify all addresses have alert settings
      if (key.name === "Test XPUB") {
        // Test single address refresh using helper (should show 0 balances)
        await refreshAddressBalance(page, key.key, {
          chain_in: "0.00000000 ₿",
          chain_out: "0.00000000 ₿",
          mempool_in: "0.00000000 ₿",
          mempool_out: "0.00000000 ₿"
        }, firstAddressIndex, key.key);
        console.log(`Verified initial zero balance for ${key.name} address ${firstAddressIndex}`);

        // Test mempool input state
        await refreshAddressBalance(page, key.key, {
          chain_in: "0.00000000 ₿",
          chain_out: "0.00000000 ₿",
          mempool_in: "0.00010000 ₿",
          mempool_out: "0.00000000 ₿"
        }, firstAddressIndex, key.key);
        console.log(`Verified mempool input for ${key.name} address ${firstAddressIndex}`);

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
        }, firstAddressIndex, key.key);

        // Verify balances for all other addresses
        for (let i = 1; i < key.initialAddresses + key.skip; i++) {  // Start at 3 since our first address is at 2
          await verifyAddressBalance(page, key.key, {
            chain_in: "0.00000000 ₿",
            chain_out: "0.00000000 ₿",
            mempool_in: "0.00000000 ₿",
            mempool_out: "0.00000000 ₿"
          }, i, key.key);
        }
        // Edit the first derived address
        await findAndClick(page, `[data-testid="${key.key}-address-${firstAddressIndex}-edit-button"]`);
        
        // Wait for the dialog to be visible
        await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
        await expect(page.getByTestId("address-name-input")).toHaveValue(`${key.name} ${firstAddressIndex}`);
        
        // Change the name
        await page.getByTestId("address-name-input").fill(`${key.name} 2 Edited`);
        await findAndClick(page, '[data-testid="address-dialog-save"]', { allowOverlay: true });
        
        // Verify the dialog closed and name was updated
        await page.waitForSelector('[data-testid="address-dialog"]', { state: "hidden", timeout: 2000 });
        await expect(page.getByText("Address updated successfully")).toBeVisible();
        await expect(page.getByTestId(`${key.key}-address-${firstAddressIndex}-name`)).toContainText(`${key.name} 2 Edited`);
        console.log(`Edited address name in ${key.name}`);

        // Now test editing the extended key itself
        await findAndClick(page, `[data-testid="${key.key}-edit-button"]`);
        
        // Wait for the dialog to be visible
        await expect(page.locator('[data-testid="extended-key-dialog"]')).toBeVisible();
        
        // Verify the dialog shows the correct values
        await expect(page.getByTestId("extended-key-name-input")).toHaveValue(key.name);
        await expect(page.getByTestId("extended-key-key-input")).toHaveValue(key.key);
        await expect(page.getByTestId("extended-key-skip-input")).toHaveValue("0");
        await expect(page.getByTestId("extended-key-initial-input")).toHaveValue("3");
        
        // Update the skip value to 1
        await page.getByTestId("extended-key-skip-input").fill("1");
        
        // Save the changes
        await findAndClick(page, '[data-testid="extended-key-submit-button"]');
        
        // Wait for the dialog to close
        await expect(page.locator('[data-testid="extended-key-dialog"]')).not.toBeVisible();
        
        // Wait for success notification
        await expect(page.getByText("Extended key updated successfully")).toBeVisible();
        
        // Expand the section if it's collapsed
        if (!await page.locator(`[data-testid="${key.key}-address-list"]`).isVisible()) {
          await findAndClick(page, `[data-testid="${key.key}-expand-button"]`);
        }

        // Verify that addresses start at index 1 (due to skip=1)
        await expect(page.getByTestId(`${key.key}-address-1-name`)).toContainText("Test XPUB 1");
        await expect(page.getByTestId(`${key.key}-address-2-name`)).toContainText("Test XPUB 2");
        await expect(page.getByTestId(`${key.key}-address-3-name`)).toContainText("Test XPUB 3");

        // Verify we don't have index 0
        const index0Row = page.getByTestId(`${key.key}-address-0-name`);
        await expect(index0Row).not.toBeVisible();

        // verify total number of addresses (should be initialAddresses=3)
        const addresses = await page.locator(`[data-testid="${key.key}-address-list"] tr.address-row`).all();
        expect(addresses.length).toBe(key.initialAddresses);

        console.log("Verified extended key edit with skip=1");
      }

      // Collapse the extended key section after testing
      await findAndClick(page, `[data-testid="${key.key}-expand-button"]`);
      console.log(`Collapsed ${key.name} section`);
    }

    // Add descriptors (pkh, sh(wpkh), wpkh, wsh(multi), wsh(sortedmulti), wsh(multi-mixed))
    const descriptors = Object.entries(testData.descriptors).map(([id, desc]) => ({
      name: id,
      descriptor: desc.key,
      derivationPath: desc.derivationPath,
      ...settings,
      monitor: id === 'xpubSingle' ? {
        chain_in: "alert",
        chain_out: "alert",
        mempool_in: "alert",
        mempool_out: "alert"
      } : undefined
    }));

    for (const descriptor of descriptors) {
      await addDescriptor(page, "Donations", descriptor);

      const firstAddressIndex = descriptor.skip ? descriptor.skip-1 : 0;
      console.log(`Added ${descriptor.name} with first address index ${firstAddressIndex}`);

      // Verify the key-derived addresses section is visible
      await expect(page.getByText("Key-Derived Addresses")).toBeVisible();

      // Wait for the descriptor row to be visible
      await expect(page.getByTestId(`${descriptor.descriptor}-descriptor-row`)).toBeVisible();

      // Find the descriptor row
      const descriptorRow = page.getByTestId(`${descriptor.descriptor}-descriptor-row`);
      
      // Debug: Log all cells in the row
      const cells = await descriptorRow.locator('td').all();
      console.log('Descriptor row contents:');
      for (let i = 0; i < cells.length; i++) {
        const text = await cells[i].textContent();
        console.log(`Cell ${i}: "${text}"`);
      }
      console.log('Descriptor object:', descriptor);
      
      // Verify descriptor information
      await expect(descriptorRow.locator('td').nth(0)).toContainText(descriptor.name);
      await expect(descriptorRow.locator('td').nth(1)).toContainText(descriptor.descriptor.slice(0, 15));
      await expect(descriptorRow.locator('td').nth(2)).toContainText(descriptor.derivationPath);
      await expect(descriptorRow.locator('td').nth(3)).toContainText(descriptor.gapLimit.toString());
      await expect(descriptorRow.locator('td').nth(4)).toContainText(descriptor.skip.toString());
      await expect(descriptorRow.locator('td').nth(5)).toContainText(descriptor.initialAddresses.toString());
      await expect(descriptorRow.locator('td').nth(6)).toContainText(descriptor.initialAddresses.toString());
      // Initially we should see just the initial addresses
      const descriptorAddressRows = page.locator(`[data-testid="${descriptor.descriptor}-address-list"] tr.address-row`);
      await expect(descriptorAddressRows).toHaveCount(descriptor.initialAddresses);

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
        console.log(`Checking address at index ${i} (with skip ${descriptor.skip}), actual index ${i + descriptor.skip}`);
        const expectedAddress = testData.descriptors[descriptor.name].addresses[i + descriptor.skip].address;
        const addressCell = page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-row"] td:nth-child(2)`);
        await expect(addressCell).toContainText(expectedAddress.slice(0, 15));

        // Verify the name shows the correct index
        const nameCell = page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-name"]`);
        await expect(nameCell).toContainText(`${descriptor.name} ${addressIndex}`);
      }
      // For the first descriptor, verify all addresses have alert settings
      if (descriptor.name === "xpubSingle") {
        // Trigger a balance change to generate new addresses
        await refreshAddressBalance(page, descriptor.descriptor, {
          chain_in: "0.00010000 ₿"
        }, 0, descriptor.descriptor);

        // Wait for the new addresses to be visible
        await page.waitForTimeout(1000);

        // Get the new list of addresses after derivation
        const newAddresses = await page.locator(`[data-testid="${descriptor.descriptor}-address-list"] tr.address-row`).all();

        // Test refreshing a single descriptor address using helper
        await refreshAddressBalance(page, descriptor.descriptor, {}, firstAddressIndex, descriptor.descriptor);
        console.log(`Verified initial zero balance for ${descriptor.name} address ${firstAddressIndex}`);

        // Test mempool input state
        await refreshAddressBalance(page, descriptor.descriptor, {
          mempool_in: "0.00010000 ₿"
        }, firstAddressIndex, descriptor.descriptor);
        console.log(`Verified mempool input for ${descriptor.name} address ${firstAddressIndex}`);

        // Test chain input state
        await refreshAddressBalance(page, descriptor.descriptor, {
          chain_in: "0.00010000 ₿"
        }, firstAddressIndex, descriptor.descriptor);
        console.log(`Verified chain input for ${descriptor.name} address ${firstAddressIndex}`);

        // Test mempool output state
        await refreshAddressBalance(page, descriptor.descriptor, {
          mempool_out: "0.00001000 ₿"
        }, firstAddressIndex, descriptor.descriptor);
        console.log(`Verified mempool output for ${descriptor.name} address ${firstAddressIndex}`);

        // Test chain output state
        await refreshAddressBalance(page, descriptor.descriptor, {
          chain_out: "0.00001000 ₿"
        }, firstAddressIndex, descriptor.descriptor);
        console.log(`Verified chain output for ${descriptor.name} address ${firstAddressIndex}`);

        // Accept the chain-out change
        await findAndClick(page, `[data-testid="${descriptor.descriptor}-address-${firstAddressIndex}-accept-button"]`);
        await expect(page.getByTestId(`${descriptor.descriptor}-address-${firstAddressIndex}-chain-out-diff`)).not.toBeVisible();
        console.log(`Accepted balance changes for ${descriptor.name} address ${firstAddressIndex}`);

        // Final refresh to verify all states are stable
        await refreshAddressBalance(page, descriptor.descriptor, {
          chain_in: "0.00010000 ₿",
          chain_out: "0.00001000 ₿"
        }, firstAddressIndex, descriptor.descriptor);
        console.log(`Verified final stable state for ${descriptor.name} address ${firstAddressIndex}`);

        // Edit the first derived address
        await findAndClick(page, `[data-testid="${descriptor.descriptor}-address-${firstAddressIndex}-edit-button"]`);
        
        // Wait for the dialog to be visible
        await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
        await expect(page.getByTestId("address-name-input")).toHaveValue(`${descriptor.name} ${firstAddressIndex}`);
        
        // Change the name
        await page.getByTestId("address-name-input").fill(`${descriptor.name} 0 Edited`);
        await findAndClick(page, '[data-testid="address-dialog-save"]', { allowOverlay: true });
        
        // Verify the dialog closed and name was updated
        await page.waitForSelector('[data-testid="address-dialog"]', { state: "hidden", timeout: 2000 });
        await expect(page.getByText("Address updated successfully")).toBeVisible();
        await expect(page.getByTestId(`${descriptor.descriptor}-address-${firstAddressIndex}-name`)).toContainText(`${descriptor.name} 0 Edited`);
        console.log(`Edited address name in ${descriptor.name}`);
      }

      // Collapse the descriptor section after testing
      await findAndClick(page, `[data-testid="${descriptor.descriptor}-expand-button"]`);
      console.log(`Collapsed ${descriptor.name} section`);

      // Test editing the descriptor itself
      if (descriptor.name === "xpubSingle") {
        // Click the edit button on the descriptor row
        await findAndClick(page, `[data-testid="${descriptor.descriptor}-edit-button"]`);
        
        // Wait for the descriptor dialog to be visible
        await expect(page.locator('[data-testid="descriptor-dialog"]')).toBeVisible();
        
        // Verify the dialog shows the correct values
        await expect(page.getByTestId("descriptor-name-input")).toHaveValue(descriptor.name);
        await expect(page.getByTestId("descriptor-input")).toHaveValue(descriptor.descriptor);
        await expect(page.getByTestId("descriptor-skip-input")).toHaveValue("0");
        
        // Update the skip value to 1
        await page.getByTestId("descriptor-skip-input").fill("1");
        
        // Save the changes
        await findAndClick(page, '[data-testid="descriptor-submit-button"]');
        
        // Wait for the dialog to close
        await expect(page.locator('[data-testid="descriptor-dialog"]')).not.toBeVisible();
        
        // Verify that new addresses are generated with skip=1
        await expect(page.getByText("xpubSingle 1")).toBeVisible();
        await expect(page.getByText("xpubSingle 3")).toBeVisible();
        await expect(page.getByText("xpubSingle 5")).toBeVisible();
        // verify number of addresses
        const addresses = await page.locator(`[data-testid="${descriptor.descriptor}-address-list"] tr.address-row`).all();
        expect(addresses.length).toBe(descriptor.initialAddresses + descriptor.skip);
      }
    }

    // Now that we've verified all balances, let's verify monitor settings update
    console.log("Testing monitor settings update...");

    // Navigate to configuration page
    await findAndClick(page, '[data-testid="settings-button"]');
    console.log("Settings opened");

    // Set all monitor settings to alert
    await page.click('[data-testid="address-monitor-chain-in"]');
    await page.click('[data-testid="address-monitor-chain-in-alert"]');
    await page.click('[data-testid="address-monitor-chain-out"]');
    await page.click('[data-testid="address-monitor-chain-out-alert"]');
    await page.click('[data-testid="address-monitor-mempool-in"]');
    await page.click('[data-testid="address-monitor-mempool-in-alert"]');
    await page.click('[data-testid="address-monitor-mempool-out"]');
    await page.click('[data-testid="address-monitor-mempool-out-alert"]');
    
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
    const zapAddress = testData.plain.zapomatic;
    await expect(page.locator(`[data-testid="${zapAddress}-chain-in-alert-icon"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${zapAddress}-chain-out-alert-icon"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${zapAddress}-mempool-in-alert-icon"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${zapAddress}-mempool-out-alert-icon"]`)).toBeVisible();
    console.log("Single address monitor settings verified");

    // Verify extended key address monitor settings (using the first extended key from earlier)
    // await findAndClick(page, `[data-testid="${extendedKeys[0].key}-expand-button"]`);
    const extendedKeyAddresses = await page.locator(`[data-testid="${extendedKeys[0].key}-address-list"] tr.address-row`).all();
    for (let i = 0; i < extendedKeyAddresses.length; i++) {
      const addressIndex = i + extendedKeys[0].skip; // Use the skip value from the extended key
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
    for (let i = 2; i < descriptorAddresses.length; i++) {
      const addressIndex = i + 1;
      await expect(page.locator(`[data-testid="${descriptors[0].descriptor}-address-${i}-chain-in-alert-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${descriptors[0].descriptor}-address-${i}-chain-out-alert-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${descriptors[0].descriptor}-address-${i}-mempool-in-alert-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${descriptors[0].descriptor}-address-${i}-mempool-out-alert-icon"]`)).toBeVisible();
    }
    await findAndClick(page, `[data-testid="${descriptors[0].descriptor}-expand-button"]`);
    console.log("Descriptor address monitor settings verified");

    // Verify new address dialog defaults
    await findAndClick(page, `[data-testid="Donations-add-address"]`);
    await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
    
    // Check monitor settings in dialog
    await expect(page.locator('[data-testid="address-monitor-chain-in"] .MuiSelect-select')).toHaveText('Alert');
    await expect(page.locator('[data-testid="address-monitor-chain-out"] .MuiSelect-select')).toHaveText('Alert');
    await expect(page.locator('[data-testid="address-monitor-mempool-in"] .MuiSelect-select')).toHaveText('Alert');
    await expect(page.locator('[data-testid="address-monitor-mempool-out"] .MuiSelect-select')).toHaveText('Alert');
    
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
    await findAndClick(page, `[data-testid="${firstExtendedKey.key}-address-2-delete-button"]`);
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
    await expect(page.getByText("Remove this address from the extended key set?")).toBeVisible();
    await findAndClick(page, '[data-testid="delete-confirmation-confirm"]', { allowOverlay: true });
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
    await expect(page.getByTestId(`${firstExtendedKey.key}-address-2-delete-button`)).not.toBeVisible();
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