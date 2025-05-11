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
  await findAndClick(page, `${collection}-add-extended-key`);

  // Wait for dialog to be visible
  await page.waitForSelector('[data-testid="extended-key-dialog"]', {
    state: "visible",
    timeout: 2000,
  });

  // Fill in the form fields
  await page.fill('[data-testid="extended-key-name-input"]', name);
  await page.fill('[data-testid="extended-key-key-input"]', key);
  
  // Handle derivation path with Autocomplete
  const pathInput = page.getByTestId("extended-key-path-input");
  await pathInput.click();
  await pathInput.fill(derivationPath);
  await page.keyboard.press('Enter');
  
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
  await findAndClick(page, "extended-key-submit-button", {
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
      name: `Test ${key.type}`,  // Base name, index will be added by server
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

      // Find the extended key row
      const keyRow = page.getByTestId(`${key.key}-row`);
      // scroll to the key row
      await keyRow.scrollIntoViewIfNeeded();
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
        await findAndClick(page, `${key.key}-refresh-all-button`);
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
        await findAndClick(page, `${key.key}-address-${firstAddressIndex}-edit-button`);
        
        // Wait for the dialog to be visible
        await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
        await expect(page.getByTestId("address-name-input")).toHaveValue(`${key.name} ${firstAddressIndex}`);
        
        // Change the name
        await page.getByTestId("address-name-input").fill(`${key.name} ${firstAddressIndex} Edited`);
        await findAndClick(page, "address-dialog-save", { allowOverlay: true });
        
        // Verify the dialog closed and name was updated
        await page.waitForSelector('[data-testid="address-dialog"]', { state: "hidden", timeout: 2000 });
        await expect(page.getByText("Address updated successfully")).toBeVisible();
        await expect(page.getByTestId(`${key.key}-address-${firstAddressIndex}-name`)).toContainText(`${key.name} 2 Edited`);
        console.log(`Edited address name in ${key.name}`);

        // Trigger update on second address so we the backend has a reason
        // to derive more addresses (to ensure the gap is respected)
        await refreshBalance(page, key.key, {
          chain_in: "0.00000000 ₿",
          chain_out: "0.00000000 ₿",
          mempool_in: "0.00010000 ₿",
          mempool_out: "0.00000000 ₿"
        }, firstAddressIndex + 1, key.key);
        console.log(`trigger activity update for ${key.name} address ${firstAddressIndex + 1}`);
        // wait for the new addresses to be visible
        await page.waitForTimeout(1000);
        // verify number of addresses
        const newAddressList = await page.locator(`[data-testid="${key.key}-address-list"] tr.address-row`).all();
        expect(newAddressList.length).toBe(key.initialAddresses+1);

        // Now test editing the extended key itself
        await findAndClick(page, `${key.key}-edit-button`);
        
        // Wait for the dialog to be visible
        await expect(page.locator('[data-testid="extended-key-dialog"]')).toBeVisible();
        
        // Verify the dialog shows the correct values
        await expect(page.getByTestId("extended-key-name-input")).toHaveValue(key.name);
        await expect(page.getByTestId("extended-key-key-input")).toHaveValue(key.key);
        await expect(page.getByTestId("extended-key-skip-input")).toHaveValue(key.skip.toString());
        await expect(page.getByTestId("extended-key-initial-input")).toHaveValue(key.initialAddresses.toString());
        
        // Update the skip value to 50
        await page.getByTestId("extended-key-skip-input").fill("50");
        
        // Save the changes
        await findAndClick(page, "extended-key-submit-button", { allowOverlay: true });
        
        // Wait for the dialog to close
        await expect(page.locator('[data-testid="extended-key-dialog"]')).not.toBeVisible();
        
        // Wait for success notification
        await expect(page.getByText("Extended key updated successfully")).toBeVisible();
        
        // Expand the section if it's collapsed
        if (!await page.locator(`[data-testid="${key.key}-address-list"]`).isVisible()) {
          await findAndClick(page, `${key.key}-expand-button`);
        }

        // After setting skip=50, we should see addresses starting from index 50
        await expect(page.getByTestId(`${key.key}-address-50-name`)).toContainText("Test XPUB 50");
        await expect(page.getByTestId(`${key.key}-address-51-name`)).toContainText("Test XPUB 51");

        // Verify we don't have index 0 (it should be skipped)
        const index0Row = page.getByTestId(`${key.key}-address-0-name`);
        await expect(index0Row).not.toBeVisible();

        // Verify we don't have index 52 (we only requested 2 addresses)
        const index3Row = page.getByTestId(`${key.key}-address-52-name`);
        await expect(index3Row).not.toBeVisible();

        // verify total number of addresses (should be initialAddresses=3)
        const addresses = await page.locator(`[data-testid="${key.key}-address-list"] tr.address-row`).all();
        expect(addresses.length).toBe(key.initialAddresses);

        // Test gap limit behavior after finding activity
        console.log("Testing gap limit behavior after finding activity");
        
        // Trigger activity on address 54
        await refreshBalance(page, key.key, {
          chain_in: "0.00010000 ₿",
          chain_out: "0.00000000 ₿",
          mempool_in: "0.00000000 ₿",
          mempool_out: "0.00000000 ₿"
        }, 54, key.key);
        console.log("Triggered activity on address 54");

        // Wait for the new address to be derived
        await page.waitForTimeout(1000);

        // Verify that address 55 was derived (not 105)
        await expect(page.getByTestId(`${key.key}-address-55-name`)).toBeVisible();
        await expect(page.getByTestId(`${key.key}-address-55-name`)).toContainText("Test XPUB 55");

        // Verify that address 105 was NOT derived
        const index105Row = page.getByTestId(`${key.key}-address-105-name`);
        await expect(index105Row).not.toBeVisible();

        console.log("Verified gap limit behavior after finding activity");

        // Test raw extended key handling
        console.log("Testing raw extended key handling");
        
        // Add a raw zpub key without descriptor wrapper
        await addExtendedKey(page, "Donations", {
          name: "Raw ZPUB Test",
          key: testData.extendedKeys.zpub1.key,
          derivationPath: testData.extendedKeys.zpub1.derivationPath,
          skip: 0,
          gapLimit: 2,
          initialAddresses: 3,
          monitor: {
            chain_in: "auto-accept",
            chain_out: "alert",
            mempool_in: "auto-accept",
            mempool_out: "alert"
          }
        });

        // Verify the key was properly wrapped in wpkh() format
        const rawZpubRow = page.getByTestId(`${testData.extendedKeys.zpub1.key}-row`);
        await expect(rawZpubRow).toBeVisible();
        
        // Verify addresses were derived correctly
        const rawZpubAddresses = page.locator(`[data-testid="${testData.extendedKeys.zpub1.key}-address-list"] tr.address-row`);
        await expect(rawZpubAddresses).toHaveCount(3);

        // Verify first address matches expected native segwit address
        const firstAddress = page.locator(`[data-testid="${testData.extendedKeys.zpub1.key}-address-0-row"] td:nth-child(2)`);
        await expect(firstAddress).toContainText(testData.extendedKeys.zpub1.addresses[0].address.slice(0, 15));

        console.log("Verified raw extended key handling");

        console.log("Verified extended key edit with skip=50");
      }

      // Collapse the extended key section after testing
      await findAndClick(page, `${key.key}-expand-button`);
      console.log(`Collapsed ${key.name} section`);
    }
};
