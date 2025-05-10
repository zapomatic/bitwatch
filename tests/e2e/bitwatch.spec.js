import { test, expect } from "@playwright/test";
import testData from "../../test-data/keys.json" with { type: 'json' };
import findAndClick from "./lib/findAndClick.js";
import loadApp from "./sequences/loadApp.js";
import configurationPage from "./sequences/configurationPage.js";
import integrationsPage from "./sequences/integrationsPage.js";
import manageCollections from "./sequences/manageCollections.js";
import singleAddress from "./sequences/singleAddress.js";
import extendedKeys from "./sequences/extendedKeys.js";
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

    // Wait for and close the notification before proceeding
    // await page.getByTestId("config-notification").getByRole("button").click();
    await expect(page.getByTestId("config-notification")).not.toBeVisible();

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