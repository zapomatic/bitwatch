import { expect } from "@playwright/test";
import { findAndClick } from "../test-environment.js";
import testDb from "../../../server/db.test.json" with { type: 'json' };
export default async (page) => {
  // Click the settings button
  await findAndClick(page, '[data-testid="settings-button"]');
  console.log("Settings opened");

  // Verify default test values first
  await expect(page.getByTestId("config-api")).toHaveValue(testDb.api);
  await expect(page.getByTestId("config-interval")).toHaveValue(
    testDb.interval.toString()
  );
  await expect(page.getByTestId("config-apiDelay")).toHaveValue(
    testDb.apiDelay.toString()
  );
  await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue(
    testDb.apiParallelLimit.toString()
  );
  await expect(page.getByTestId("config-debugLogging")).not.toBeChecked();

  // Switch to public mode and verify public settings
  await findAndClick(page, '[data-testid="use-public-api"]');
  console.log("Switched to public mode");
  await expect(page.getByTestId("config-api")).toHaveValue(
    "https://mempool.space"
  );
  await expect(page.getByTestId("config-interval")).toHaveValue("600000");
  await expect(page.getByTestId("config-apiDelay")).toHaveValue("2000");
  await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue("1");

  // Switch to private mode and verify private settings
  await findAndClick(page, '[data-testid="use-local-node"]');
  console.log("Switched to private mode");
  await expect(page.getByTestId("config-api")).toHaveValue(
    "http://10.21.21.26:3006"
  );
  await expect(page.getByTestId("config-interval")).toHaveValue("60000");
  await expect(page.getByTestId("config-apiDelay")).toHaveValue("100");
  await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue("100");
  await findAndClick(page, '[data-testid="config-debugLogging"]');
  await expect(page.getByTestId("config-debugLogging")).toBeChecked();

  // Return to test settings
  await page.getByTestId("config-api").fill(testDb.api);
  await page.getByTestId("config-interval").fill(testDb.interval.toString());
  await page.getByTestId("config-apiDelay").fill(testDb.apiDelay.toString());
  await page
    .getByTestId("config-apiParallelLimit")
    .fill(testDb.apiParallelLimit.toString());
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
  await findAndClick(page, '[data-testid="config-notification"] button', {
    allowOverlay: true,
  });
  console.log("Verified success notification");
};
