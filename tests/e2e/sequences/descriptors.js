import { expect } from "@playwright/test";
import testData from "../../../test-data/keys.json" with { type: "json" };
import settings from "../lib/settings.js";
import findAndClick from "../lib/findAndClick.js";
import setMonitoring from "../lib/setMonitoring.js";
import refreshBalance from "../lib/refreshBalance.js";
import verifyBalance from "../lib/verifyBalance.js";
import ensureCollapsed from "../lib/ensureCollapsed.js";
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
      await expect(page.getByTestId(`${descriptor.descriptor}-row`)).toBeVisible();

      // Find the descriptor row
      const descriptorRow = page.getByTestId(`${descriptor.descriptor}-row`);
      
      // Debug: Log all cells in the row
      // const cells = await descriptorRow.locator('td').all();
      // console.log('Descriptor row contents:');
      // for (let i = 0; i < cells.length; i++) {
      //   const text = await cells[i].textContent();
      //   console.log(`Cell ${i}: "${text}"`);
      // }
      // console.log('Descriptor object:', descriptor);
      
      // Verify descriptor information
      await expect(descriptorRow.locator('td').nth(0)).toContainText(descriptor.name);
      await expect(descriptorRow.locator('td').nth(1)).toContainText(descriptor.descriptor.slice(0, 15));
      await expect(descriptorRow.locator('td').nth(2)).toContainText(`${descriptor.initialAddresses}`);
      // Verify balance cells exist
      await expect(descriptorRow.locator('td').nth(3)).toHaveClass(/crystal-table-cell/);
      await expect(descriptorRow.locator('td').nth(4)).toHaveClass(/crystal-table-cell/);

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
        const expectedAddress = testData.descriptors[descriptor.name].addresses[addressIndex].address;
        await expect(page.locator(`[data-testid="${expectedAddress}-chain-in-${descriptor.monitor.chain_in}-icon"]`)).toBeVisible();
        await expect(page.locator(`[data-testid="${expectedAddress}-chain-out-${descriptor.monitor.chain_out}-icon"]`)).toBeVisible();
        await expect(page.locator(`[data-testid="${expectedAddress}-mempool-in-${descriptor.monitor.mempool_in}-icon"]`)).toBeVisible();
        await expect(page.locator(`[data-testid="${expectedAddress}-mempool-out-${descriptor.monitor.mempool_out}-icon"]`)).toBeVisible();

        // Verify the address matches the expected address from test data
        console.log(`Checking address at index ${i} (with skip ${descriptor.skip}), actual index ${addressIndex}`);
        const addressCell = page.locator(`[data-testid="${expectedAddress}-row"] td:nth-child(2)`);
        await expect(addressCell).toContainText(expectedAddress.slice(0, 15));

        // Verify the name shows the correct index
        const nameCell = page.locator(`[data-testid="${expectedAddress}-name"]`);
        await expect(nameCell).toContainText(`${descriptor.name} ${addressIndex}`);
      }
      // for the first descriptor, we will trigger a balance changes and edit to triggger more key derivation
      if (descriptor.name === "xpubSingle") {


        const firstExpectedAddress = testData.descriptors[descriptor.name].addresses[firstAddressIndex].address;
        const secondExpectedAddress = testData.descriptors[descriptor.name].addresses[firstAddressIndex + 1].address;
        // const thirdExpectedAddress = testData.descriptors[descriptor.name].addresses[firstAddressIndex + 2].address;
        // refresh all addresses in the descriptor
        await findAndClick(page, `${descriptor.descriptor}-refresh-all-button`);
        console.log(`Clicked refresh button for ${descriptor.descriptor}`);
        // verify that both derived addresses show the zero balance rather than queued
        await verifyBalance(page, firstExpectedAddress);
        await verifyBalance(page, secondExpectedAddress);
        // now refresh balance with incremet
        await refreshBalance(page, firstExpectedAddress, {
          mempool_in: "0.00010000 ₿"
        }, descriptor.descriptor);
        await expect(page.getByTestId(`${firstExpectedAddress}-mempool-in-diff`)).toBeVisible();
        await findAndClick(page, `${firstExpectedAddress}-accept-button`);
        await expect(page.getByTestId(`${firstExpectedAddress}-mempool-in-diff`)).not.toBeVisible();
        await refreshBalance(page, firstExpectedAddress, {
          chain_in: "0.00010000 ₿"
        }, descriptor.descriptor);
        await expect(page.getByTestId(`${firstExpectedAddress}-chain-in-diff`)).toBeVisible();
        await expect(page.getByTestId(`${firstExpectedAddress}-mempool-in-diff`)).toBeVisible();
        await refreshBalance(page, firstExpectedAddress, {
          chain_in: "0.00010000 ₿",
          mempool_out: "0.00001000 ₿"
        }, descriptor.descriptor);
        await expect(page.getByTestId(`${firstExpectedAddress}-chain-in-diff`)).toBeVisible();
        await expect(page.getByTestId(`${firstExpectedAddress}-mempool-out-diff`)).toBeVisible();

        // Accept the change
        await findAndClick(page, `${firstExpectedAddress}-accept-button`);

        await expect(page.getByTestId(`${firstExpectedAddress}-chain-in-diff`)).not.toBeVisible();
        await expect(page.getByTestId(`${firstExpectedAddress}-chain-out-diff`)).not.toBeVisible();
        await expect(page.getByTestId(`${firstExpectedAddress}-mempool-in-diff`)).not.toBeVisible();
        await expect(page.getByTestId(`${firstExpectedAddress}-mempool-out-diff`)).not.toBeVisible();
        console.log(`Accepted balance changes for ${descriptor.name}/${firstExpectedAddress}`);

        // also incrememt the second address
        await refreshBalance(page, secondExpectedAddress, {
          chain_in: "0.00010000 ₿"
        }, descriptor.descriptor);
        // Wait for the new address to be derived
        await page.waitForTimeout(1000);

        let newAddressList;
        newAddressList = await page.locator(`[data-testid="${descriptor.descriptor}-address-list"] tr.address-row`).all();
        expect(newAddressList.length).toBe(descriptor.initialAddresses + 1);

        // Edit the first derived address
        await findAndClick(page, `${firstExpectedAddress}-edit-button`);
        
        // Wait for the dialog to be visible
        await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
        await expect(page.getByTestId("address-name-input")).toHaveValue(`${descriptor.name} ${firstAddressIndex}`);
        
        // Change the name
        await page.getByTestId("address-name-input").fill(`${descriptor.name} 0 Edited`);
        await findAndClick(page, "address-dialog-save", { allowOverlay: true });
        
        // Verify the dialog closed and name was updated
        await page.waitForSelector('[data-testid="address-dialog"]', { state: "hidden", timeout: 2000 });
        await expect(page.getByText("Address updated successfully")).toBeVisible();
        await expect(page.getByTestId(`${firstExpectedAddress}-name`)).toContainText(`${descriptor.name} 0 Edited`);
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

      await ensureCollapsed(page, descriptor.descriptor);
      console.log(`Collapsed ${descriptor.name} section`);
    }

};
