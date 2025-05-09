import { expect } from "@playwright/test";
import testData from "../../../test-data/keys.json" with { type: "json" };
import settings from "../lib/settings.js";
import findAndClick from "../lib/findAndClick.js";
import setMonitoring from "../lib/setMonitoring.js";
import refreshBalance from "../lib/refreshBalance.js";
import verifyBalance from "../lib/verifyBalance.js";

const addExtendedKey = async (
  page,
  collection,
  { name, key, derivationPath, skip, gapLimit, initialAddresses, monitor }
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

  // Set monitoring options if provided
  if (monitor) {
    await setMonitoring(page, monitor);
  }

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

export default async (page) => {
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
      } : {
        chain_in: "auto-accept",
        chain_out: "alert",
        mempool_in: "auto-accept",
        mempool_out: "alert"
      }
    }));

    for (const key of extendedKeys) {
      console.log(`Adding extended key ${key.name} with monitor settings:`, key.monitor);
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
      const addressList = page.locator(`[data-testid="${key.key}-address-list"]`);
      console.log(`Checking if address list exists for ${key.name}:`, await addressList.count() > 0);
      console.log(`Address list visibility for ${key.name}:`, await addressList.isVisible());
      await expect(addressList).toBeVisible();

      // Get all address rows
      const addresses = await page.locator(`[data-testid="${key.key}-address-list"] tr.address-row`).all();
      console.log(`Found ${addresses.length} address rows for ${key.name}`);
      // Verify we have the expected number of addresses
      expect(addresses.length).toBe(key.initialAddresses);

      // Verify each address has appropriate icons based on monitoring settings
      for (let i = 0; i < addresses.length; i++) {
        const addressIndex = i + key.skip; // Keep it 0-based with skip
        console.log(`Checking icons for ${key.name} address ${addressIndex} with monitor settings:`, key.monitor);

        console.log(`Checking chain-in ${key.monitor.chain_in} icon for ${key.name} address ${addressIndex}`);
        await expect(page.locator(`[data-testid="${key.key}-address-${addressIndex}-chain-in-${key.monitor.chain_in}-icon"]`)).toBeVisible();

        console.log(`Checking chain-out ${key.monitor.chain_out} icon for ${key.name} address ${addressIndex}`);
        await expect(page.locator(`[data-testid="${key.key}-address-${addressIndex}-chain-out-${key.monitor.chain_out}-icon"]`)).toBeVisible();

        console.log(`Checking mempool-in ${key.monitor.mempool_in} icon for ${key.name} address ${addressIndex}`);
        await expect(page.locator(`[data-testid="${key.key}-address-${addressIndex}-mempool-in-${key.monitor.mempool_in}-icon"]`)).toBeVisible();

        console.log(`Checking mempool-out ${key.monitor.mempool_out} icon for ${key.name} address ${addressIndex}`);
        await expect(page.locator(`[data-testid="${key.key}-address-${addressIndex}-mempool-out-${key.monitor.mempool_out}-icon"]`)).toBeVisible();

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
        await refreshBalance(page, key.key, {
          chain_in: "0.00000000 ₿",
          chain_out: "0.00000000 ₿",
          mempool_in: "0.00000000 ₿",
          mempool_out: "0.00000000 ₿"
        }, firstAddressIndex, key.key);
        console.log(`Verified initial zero balance for ${key.name} address ${firstAddressIndex}`);

        // Test mempool input state
        await refreshBalance(page, key.key, {
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

        await verifyBalance(page, key.key, {
            chain_in: "0.00010000 ₿",
            chain_out: "0.00000000 ₿",
            mempool_in: "0.00000000 ₿",
            mempool_out: "0.00000000 ₿"
        }, firstAddressIndex, key.key);

        // Verify balances for all other addresses
        for (let i = 1; i < key.initialAddresses + key.skip; i++) {  // Start at 3 since our first address is at 2
          await verifyBalance(page, key.key, {
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
        await expect(page.getByTestId("extended-key-skip-input")).toHaveValue(key.skip.toString());
        await expect(page.getByTestId("extended-key-initial-input")).toHaveValue(key.initialAddresses.toString());
        
        // Update the skip value to 1
        await page.getByTestId("extended-key-skip-input").fill("1");
        
        // Save the changes
        await findAndClick(page, '[data-testid="extended-key-submit-button"]', { allowOverlay: true });
        
        // Wait for the dialog to close
        await expect(page.locator('[data-testid="extended-key-dialog"]')).not.toBeVisible();
        
        // Wait for success notification
        await expect(page.getByText("Extended key updated successfully")).toBeVisible();
        
        // Expand the section if it's collapsed
        if (!await page.locator(`[data-testid="${key.key}-address-list"]`).isVisible()) {
          await findAndClick(page, `[data-testid="${key.key}-expand-button"]`);
        }

        // After setting skip=1, we should see addresses starting from index 1
        await expect(page.getByTestId(`${key.key}-address-1-name`)).toContainText("Test XPUB 1");
        await expect(page.getByTestId(`${key.key}-address-2-name`)).toContainText("Test XPUB 2");

        // Verify we don't have index 0 (it should be skipped)
        const index0Row = page.getByTestId(`${key.key}-address-0-name`);
        await expect(index0Row).not.toBeVisible();

        // Verify we don't have index 3 (we only requested 2 addresses)
        const index3Row = page.getByTestId(`${key.key}-address-3-name`);
        await expect(index3Row).not.toBeVisible();

        // verify total number of addresses (should be initialAddresses=3)
        const addresses = await page.locator(`[data-testid="${key.key}-address-list"] tr.address-row`).all();
        expect(addresses.length).toBe(key.initialAddresses);

        console.log("Verified extended key edit with skip=1");
      }

      // Collapse the extended key section after testing
      await findAndClick(page, `[data-testid="${key.key}-expand-button"]`);
      console.log(`Collapsed ${key.name} section`);
    }
};
