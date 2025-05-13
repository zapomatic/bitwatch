import { expect } from "@playwright/test";
import testDb from "../../../server/db.test.json" with { type: 'json' };
import findAndClick from "../lib/findAndClick.js";
export default async (page) => {
  // Click the settings button
  await findAndClick(page, "settings-button");
  console.log("Settings opened");

  // Verify default test values first
  await expect(page.getByTestId("config-api")).toHaveValue(testDb.api);
  await expect(page.getByTestId("config-apiDelay")).toHaveValue(
    testDb.apiDelay.toString()
  );
  await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue(
    testDb.apiParallelLimit.toString()
  );
  await expect(page.getByTestId("config-debugLogging")).not.toBeChecked();

  // Switch to public mode and verify public settings
  await findAndClick(page, "use-public-api");
  console.log("Switched to public mode");
  await expect(page.getByTestId("config-api")).toHaveValue(
    "https://mempool.space"
  );
  await expect(page.getByTestId("config-apiDelay")).toHaveValue("2000");
  await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue("1");

  // Switch to private mode and verify private settings
  await findAndClick(page, "use-local-node");
  console.log("Switched to private mode");
  await expect(page.getByTestId("config-api")).toHaveValue(
    "http://10.21.21.26:3006"
  );
  await expect(page.getByTestId("config-apiDelay")).toHaveValue("5000");
  await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue("10");
  await findAndClick(page, "config-debugLogging");
  await expect(page.getByTestId("config-debugLogging")).toBeChecked();

  // Return to test settings
  await page.getByTestId("config-api").fill(testDb.api);
  await page.getByTestId("config-apiDelay").fill(testDb.apiDelay.toString());
  await page
    .getByTestId("config-apiParallelLimit")
    .fill(testDb.apiParallelLimit.toString());
  await findAndClick(page, "config-debugLogging");
  await expect(page.getByTestId("config-debugLogging")).not.toBeChecked();
  console.log("Restored test settings");

  // Save configuration
  await findAndClick(page, "save-configuration");
  console.log("Saved configuration");

  // Verify success notification
  const configNotification = page.getByTestId("config-notification");
  await expect(configNotification).toBeVisible();
  await expect(configNotification).toContainText(
    "Configuration saved successfully"
  );
  // Dismiss the notification
  await findAndClick(page, "config-notification", {
    allowOverlay: true,
  });
  console.log("Verified success notification");
};
