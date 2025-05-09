import { test, expect } from "@playwright/test";
import testData from "../../test-data/keys.json" with { type: 'json' };
import findAndClick from "./lib/findAndClick.js";
import loadApp from "./sequences/loadApp.js";
import configurationPage from "./sequences/configurationPage.js";
import integrationsPage from "./sequences/integrationsPage.js";
import manageCollections from "./sequences/manageCollections.js";
import singleAddress from "./sequences/singleAddress.js";
import extendedKeys from "./sequences/extendedKeys.js";
import settings from "./lib/settings.js";
import descriptors from "./sequences/descriptors.js";
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
    await extendedKeys(page);
    await descriptors(page);
    // Now that we've verified all balances, let's verify monitor settings update
    console.log("Testing monitor settings update...");

    // Navigate to configuration page
    await findAndClick(page, '[data-testid="settings-button"]');
    console.log("Settings opened");

    // Wait for configuration page to be fully loaded
    await page.waitForSelector('[data-testid="config-update-all-addresses"]', { state: 'visible' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500); // Small delay to ensure UI is stable

    // Set all monitor settings to alert
    await page.click('[data-testid="address-monitor-chain-in"]');
    await page.waitForSelector('[data-testid="address-monitor-chain-in-auto-accept"]', { state: 'visible' });
    await page.click('[data-testid="address-monitor-chain-in-auto-accept"]');
    await page.waitForTimeout(100); // Small delay to let animations complete

    await page.click('[data-testid="address-monitor-chain-out"]');
    await page.waitForSelector('[data-testid="address-monitor-chain-out-auto-accept"]', { state: 'visible' });
    await page.click('[data-testid="address-monitor-chain-out-auto-accept"]');
    await page.waitForTimeout(100);

    await page.click('[data-testid="address-monitor-mempool-in"]');
    await page.waitForSelector('[data-testid="address-monitor-mempool-in-auto-accept"]', { state: 'visible' });
    await page.click('[data-testid="address-monitor-mempool-in-auto-accept"]');
    await page.waitForTimeout(100);

    await page.click('[data-testid="address-monitor-mempool-out"]');
    await page.waitForSelector('[data-testid="address-monitor-mempool-out-alert"]', { state: 'visible' });
    await page.click('[data-testid="address-monitor-mempool-out-alert"]');
    await page.waitForTimeout(100);
    
    // Enable update all addresses
    await page.waitForSelector('[data-testid="config-update-all-addresses"]', { state: 'visible' });
    await findAndClick(page, '[data-testid="config-update-all-addresses"]', { force: true });
    
    // Save configuration
    await findAndClick(page, '[data-testid="save-configuration"]');
    
    // Verify success notification
    await expect(page.getByTestId("config-notification")).toContainText(
      "Configuration saved successfully and all addresses updated"
    );
    console.log("Monitor settings updated");

    // Dismiss the notification if it exists
    const notification = page.getByTestId("config-notification");
    if (await notification.isVisible()) {
      await notification.getByRole("button", { name: "Close" }).click();
      await expect(notification).not.toBeVisible();
    }

    // Navigate back to addresses page and wait for it to be ready
    await findAndClick(page, '[data-testid="watch-list-button"]');
    
    // Wait for navigation to complete and page to be ready
    await page.waitForLoadState('networkidle');
    // Wait for the collection row to be visible instead of watch-list
    await page.waitForSelector('tr.collection-row', { state: 'visible', timeout: 10000 });
    console.log("Navigated to addresses page");

    // Wait for state to load
    const zapAddress = testData.plain.zapomatic;
    await page.waitForFunction(
      (address) => {
        const element = document.querySelector(`[data-testid="${address}-chain-in"]`);
        return element && element.textContent.includes('0.00000000');
      },
      zapAddress,
      { timeout: 10000 }
    );

    // Verify single address monitor settings
    await expect(page.locator(`[data-testid="${zapAddress}-chain-in-auto-accept-icon"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${zapAddress}-chain-out-auto-accept-icon"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${zapAddress}-mempool-in-auto-accept-icon"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${zapAddress}-mempool-out-alert-icon"]`)).toBeVisible();
    console.log("Single address monitor settings verified");

    const extKeys = Object.entries(testData.extendedKeys).map(([id, key]) => ({
      name: `Test ${key.type.toUpperCase()}`,  // Base name, index will be added by server
      key: key.key,
      keyId: id,
      derivationPath: key.derivationPath,
      ...settings,
      monitor: {
        chain_in: "auto-accept",
        chain_out: "auto-accept",
        mempool_in: "auto-accept",
        mempool_out: "alert"
      }
    }));
    // Verify extended key address monitor settings (using the first extended key from earlier)
    // await findAndClick(page, `[data-testid="${extendedKeys[0].key}-expand-button"]`);
    const extendedKeyAddresses = await page.locator(`[data-testid="${extKeys[0].key}-address-list"] tr.address-row`).all();
    for (let i = 1; i < extendedKeyAddresses.length; i++) {
      const addressIndex = i + extKeys[0].skip; // Use the skip value from the extended key
      await expect(page.locator(`[data-testid="${extKeys[0].key}-address-${addressIndex}-chain-in-auto-accept-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${extKeys[0].key}-address-${addressIndex}-chain-out-auto-accept-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${extKeys[0].key}-address-${addressIndex}-mempool-in-auto-accept-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${extKeys[0].key}-address-${addressIndex}-mempool-out-alert-icon"]`)).toBeVisible();
    }
    await findAndClick(page, `[data-testid="${extKeys[0].key}-expand-button"]`);
    console.log("Extended key address monitor settings verified");

     const descKeys = Object.entries(testData.descriptors).map(([id, desc]) => ({
      name: id,
      descriptor: desc.key,
      derivationPath: desc.derivationPath,
      ...settings,
      monitor: {
        chain_in: "auto-accept",
        chain_out: "auto-accept",
        mempool_in: "auto-accept",
        mempool_out: "alert"
      }
    }));
    const firstDescriptor = descKeys[1];
    // Verify descriptor address monitor settings (using the first descriptor from earlier)
    await findAndClick(page, `[data-testid="${firstDescriptor.descriptor}-expand-button"]`);
    const descriptorAddresses = await page.locator(`[data-testid="${firstDescriptor.descriptor}-address-list"] tr.address-row`).all();
    for (let i = 1; i < descriptorAddresses.length; i++) {
      await expect(page.locator(`[data-testid="${firstDescriptor.descriptor}-address-${i}-chain-in-auto-accept-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${firstDescriptor.descriptor}-address-${i}-chain-out-auto-accept-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${firstDescriptor.descriptor}-address-${i}-mempool-in-auto-accept-icon"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${firstDescriptor.descriptor}-address-${i}-mempool-out-alert-icon"]`)).toBeVisible();
    }
    await findAndClick(page, `[data-testid="${firstDescriptor.descriptor}-expand-button"]`);
    console.log("Descriptor address monitor settings verified");

    // Verify new address dialog defaults
    await findAndClick(page, `[data-testid="Donations-add-address"]`);
    await expect(page.locator('[data-testid="address-dialog"]')).toBeVisible();
    
    // Check monitor settings in dialog
    await expect(page.locator('[data-testid="address-monitor-chain-in"] .MuiSelect-select')).toHaveText('Auto Accept');
    await expect(page.locator('[data-testid="address-monitor-chain-out"] .MuiSelect-select')).toHaveText('Auto Accept');
    await expect(page.locator('[data-testid="address-monitor-mempool-in"] .MuiSelect-select')).toHaveText('Auto Accept');
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
    const firstExtendedKey = extKeys[0];
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

    // 4. Delete the whole collection
    await findAndClick(page, `[data-testid="Donations-delete-button"]`);
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
    await expect(page.getByText("Remove all addresses from the collection?")).toBeVisible();
    await findAndClick(page, '[data-testid="delete-confirmation-confirm"]', { allowOverlay: true });
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
    
  });
});