import { expect } from "@playwright/test";
import testData from "../../../test-data/keys.json" with { type: "json" };
import settings from "../lib/settings.js";
import findAndClick from "../lib/findAndClick.js";
import setMonitoring from "../lib/setMonitoring.js";
import refreshBalance from "../lib/refreshBalance.js";

const addDescriptor = async (
  page,
  collection,
  {
    name,
    descriptor,
    skip,
    gapLimit,
    initialAddresses,
    monitor,
  }
) => {
  // scroll to the top of the page
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await findAndClick(page, `${collection}-add-descriptor`);

  // Wait for dialog to be visible
  await page.waitForSelector('[data-testid="descriptor-dialog"]', {
    state: "visible",
    timeout: 2000,
  });

  // Fill in the form fields
  await page.fill('[data-testid="descriptor-name-input"]', name);
  await page.fill('[data-testid="descriptor-input"]', descriptor);
  await page.fill('[data-testid="descriptor-skip-input"]', skip.toString());
  await page.fill('[data-testid="descriptor-gap-input"]', gapLimit.toString());
  await page.fill(
    '[data-testid="descriptor-initial-input"]',
    initialAddresses.toString()
  );

  // Set monitoring options if provided
  if (monitor) {
    await setMonitoring(page, monitor);
  }

  // Click the Add button - allow clicking in overlay since it's in a dialog
  await findAndClick(page, "descriptor-submit-button", {
    allowOverlay: true,
  });

  // Wait for the dialog to disappear
  await page.waitForSelector('[data-testid="descriptor-key-dialog"]', {
    state: "hidden",
    timeout: 2000,
  });
};

export default async (page) => {
  
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
      } : {
        chain_in: "auto-accept",
        chain_out: "alert",
        mempool_in: "auto-accept",
        mempool_out: "alert"
      }
    }));

    for (const descriptor of descriptors) {
      await addDescriptor(page, "Donations", descriptor);

      const firstAddressIndex = descriptor.skip ? descriptor.skip-1 : 0;
      console.log(`Added ${descriptor.name} with first address index ${firstAddressIndex}`);

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

      // scroll to the descriptor row
      await descriptorRow.scrollIntoViewIfNeeded();

      // when we add a descriptor, it should be expanded by default
      await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-list"]`)).toBeVisible();
      
      // Get all address rows
      const addresses = await page.locator(`[data-testid="${descriptor.descriptor}-address-list"] tr.address-row`).all();
      
      // Verify we have the expected number of addresses
      expect(addresses.length).toBe(descriptor.initialAddresses);
      
      // Verify each address has alert icons for all monitoring types and correct addresses
      for (let i = 0; i < addresses.length; i++) {
        const addressIndex = i + descriptor.skip; // Keep it 0-based with skip
        await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-chain-in-${descriptor.monitor.chain_in}-icon"]`)).toBeVisible();
        await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-chain-out-${descriptor.monitor.chain_out}-icon"]`)).toBeVisible();
        await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-mempool-in-${descriptor.monitor.mempool_in}-icon"]`)).toBeVisible();
        await expect(page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-mempool-out-${descriptor.monitor.mempool_out}-icon"]`)).toBeVisible();

        // Verify the address matches the expected address from test data
        console.log(`Checking address at index ${i} (with skip ${descriptor.skip}), actual index ${i + descriptor.skip}`);
        const expectedAddress = testData.descriptors[descriptor.name].addresses[i + descriptor.skip].address;
        const addressCell = page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-row"] td:nth-child(2)`);
        await expect(addressCell).toContainText(expectedAddress.slice(0, 15));

        // Verify the name shows the correct index
        const nameCell = page.locator(`[data-testid="${descriptor.descriptor}-address-${addressIndex}-name"]`);
        await expect(nameCell).toContainText(`${descriptor.name} ${addressIndex}`);
      }
      // for the first descriptor, we will trigger a balance changes and edit to triggger more key derivation
      if (descriptor.name === "xpubSingle") {

        // initial refresh to get 0 balance
        await refreshBalance(page, descriptor.descriptor, {}, firstAddressIndex, descriptor.descriptor);
        console.log(`Verified initial zero balance for ${descriptor.name} address ${firstAddressIndex}`);

        // Test mempool input state
        await refreshBalance(page, descriptor.descriptor, {
          mempool_in: "0.00010000 ₿"
        }, firstAddressIndex, descriptor.descriptor);
        console.log(`Verified mempool input for ${descriptor.name} address ${firstAddressIndex}`);

        // Test chain input state
        await refreshBalance(page, descriptor.descriptor, {
          chain_in: "0.00010000 ₿"
        }, firstAddressIndex, descriptor.descriptor);
        console.log(`Verified chain input for ${descriptor.name} address ${firstAddressIndex}`);

        // Test mempool output state
        await refreshBalance(page, descriptor.descriptor, {
          chain_in: "0.00010000 ₿",
          mempool_out: "0.00001000 ₿"
        }, firstAddressIndex, descriptor.descriptor);
        console.log(`Verified mempool output for ${descriptor.name} address ${firstAddressIndex}`);

        // Test chain output state
        await refreshBalance(page, descriptor.descriptor, {
          chain_in: "0.00010000 ₿",
          chain_out: "0.00001000 ₿"
        }, firstAddressIndex, descriptor.descriptor);
        console.log(`Verified chain output for ${descriptor.name} address ${firstAddressIndex}`);

        // Accept the chain-out change
        await findAndClick(page, `${descriptor.descriptor}-address-${firstAddressIndex}-accept-button`);
        await expect(page.getByTestId(`${descriptor.descriptor}-address-${firstAddressIndex}-chain-out-diff`)).not.toBeVisible();
        console.log(`Accepted balance changes for ${descriptor.name} address ${firstAddressIndex}`);

        // Trigger update on second address so we the backend has a reason
        // to derive more addresses (to ensure the gap is respected)
        await refreshBalance(page, descriptor.descriptor, {}, firstAddressIndex + 1, descriptor.descriptor);
        console.log(`trigger zero update for ${descriptor.name} address ${firstAddressIndex + 1}`);
        await refreshBalance(page, descriptor.descriptor, {
          chain_in: "0.00000000 ₿",
          chain_out: "0.00000000 ₿",
          mempool_in: "0.00010000 ₿",
          mempool_out: "0.00000000 ₿"
        }, firstAddressIndex + 1, descriptor.descriptor);
        console.log(`trigger activity update for ${descriptor.name} address ${firstAddressIndex + 1}`);

        // wait for the new addresses to be visible
        await page.waitForTimeout(1000);
        // verify number of addresses
        const newAddressList = await page.locator(`[data-testid="${descriptor.descriptor}-address-list"] tr.address-row`).all();
        expect(newAddressList.length).toBe(descriptor.initialAddresses+1);

        // Edit the first derived address
        await findAndClick(page, `${descriptor.descriptor}-address-${firstAddressIndex}-edit-button`);
        
        // Wait for the dialog to be visible
        await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
        await expect(page.getByTestId("address-name-input")).toHaveValue(`${descriptor.name} ${firstAddressIndex}`);
        
        // Change the name
        await page.getByTestId("address-name-input").fill(`${descriptor.name} 0 Edited`);
        await findAndClick(page, "address-dialog-save", { allowOverlay: true });
        
        // Verify the dialog closed and name was updated
        await page.waitForSelector('[data-testid="address-dialog"]', { state: "hidden", timeout: 2000 });
        await expect(page.getByText("Address updated successfully")).toBeVisible();
        await expect(page.getByTestId(`${descriptor.descriptor}-address-${firstAddressIndex}-name`)).toContainText(`${descriptor.name} 0 Edited`);
        console.log(`Edited address name in ${descriptor.name}`);

        // Click the edit button on the descriptor row
        await findAndClick(page, `${descriptor.descriptor}-edit-button`);
        
        // Wait for the descriptor dialog to be visible
        await expect(page.locator('[data-testid="descriptor-dialog"]')).toBeVisible();
        console.log("Descriptor dialog opened");
        
        // Verify the dialog shows the correct values
        await expect(page.getByTestId("descriptor-name-input")).toHaveValue(descriptor.name);
        await expect(page.getByTestId("descriptor-input")).toHaveValue(descriptor.descriptor);
        await expect(page.getByTestId("descriptor-skip-input")).toHaveValue("0");
        console.log("Verified initial dialog values");
        
        // Update the skip value to 1
        await page.getByTestId("descriptor-skip-input").fill("1");
        console.log("Updated skip value to 1");
        
        // Save the changes
        console.log("Attempting to save descriptor changes");
        await findAndClick(page, "descriptor-submit-button", { allowOverlay: true });
        
        // Wait for the dialog to close with longer timeout and debug info
        console.log("Waiting for descriptor dialog to close...");
        try {
          await page.waitForSelector('[data-testid="descriptor-dialog"]', { 
            state: "hidden", 
            timeout: 15000 
          });
          console.log("Descriptor dialog closed successfully");
        } catch (e) {
          console.log("Failed to detect dialog closing:", e.message);
          // Check dialog state
          const isVisible = await page.locator('[data-testid="descriptor-dialog"]').isVisible();
          console.log("Dialog visibility state:", isVisible);
        }

        await expect(page.getByText("xpubSingle 0")).not.toBeVisible();
        await expect(page.getByText("xpubSingle 1")).toBeVisible();
        await expect(page.getByText("xpubSingle 2")).toBeVisible();
        
        // verify number of addresses
        const addresses = await page.locator(`[data-testid="${descriptor.descriptor}-address-list"] tr.address-row`).all();
        expect(addresses.length).toBe(descriptor.initialAddresses + descriptor.skip);
      }

      await findAndClick(page, `${descriptor.descriptor}-expand-button`);
      console.log(`Collapsed ${descriptor.name} section`);
    }

};
