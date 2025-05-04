import { test, expect } from "./test-environment.js";
// import testData from "../../test-data/keys.json" with { type: 'json' };

test.describe("Bitwatch", () => {
  // test.beforeEach(async ({}) => {});

  // NOTE: we put all of the sequences of events in a single test to make the tests faster
  // we don't need to load the page fresh, we want to navigate around it like a real user
  test("Bitwatch full test suite", async ({ page }) => {
    // Navigate to the app and wait for it to load
    console.log("Navigating to app...");
    await page.goto("/");
    console.log("Waiting for network idle...");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("text=itwatch");
    console.log("Page loaded");

    // Wait for server connection
    console.log("Waiting for server connection...");
    await page.waitForSelector('[aria-label="Server status: CONNECTED"]', {
      timeout: 5000,
    });
    const serverState = await page.evaluate(() => {
      const statusElement = document.querySelector(
        '[aria-label="Server status: CONNECTED"]'
      ).parentElement;
      return statusElement.querySelector("p").textContent;
    });
    expect(serverState).toBe("Server");
    console.log("Server connected");

    // Wait for WebSocket connection
    console.log("Waiting for WebSocket connection...");
    await page.waitForSelector('[aria-label="WebSocket status: CONNECTED"]', {
      timeout: 5000,
    });
    const websocketState = await page.evaluate(() => {
      const statusElement = document.querySelector(
        '[aria-label="WebSocket status: CONNECTED"]'
      ).parentElement;
      return statusElement.querySelector("p").textContent;
    });
    expect(websocketState).toBe("WebSocket");
    console.log("WebSocket connected");
    // Click the settings button
    await page.getByTestId("settings-button").click();
    console.log("Settings opened");

    // Verify default values (should match mock API server)
    await expect(page.getByTestId("config-api")).toHaveValue(
      "http://localhost:3006"
    );
    await expect(page.getByTestId("config-interval")).toHaveValue("600000");
    await expect(page.getByTestId("config-apiDelay")).toHaveValue("2000");
    await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue("1");
    await expect(page.getByTestId("config-debugLogging")).not.toBeChecked();

    // Switch to private mode
    await page.getByTestId("use-local-node").click();
    console.log("Switched to private mode");

    // Verify private mode values (should match PRIVATE_CONFIG)
    await expect(page.getByTestId("config-api")).toHaveValue(
      "http://10.21.21.26:3006"
    );
    await expect(page.getByTestId("config-interval")).toHaveValue("60000");
    await expect(page.getByTestId("config-apiDelay")).toHaveValue("100");
    await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue(
      "100"
    );

    // Toggle debug logging
    await page.getByTestId("config-debugLogging").click();
    await expect(page.getByTestId("config-debugLogging")).toBeChecked();
    console.log("Toggled debug logging");

    // Save configuration
    await page.getByTestId("save-configuration").click();
    console.log("Saved configuration");

    // Verify success notification
    await expect(page.getByTestId("config-notification")).toBeVisible();
    await expect(page.getByTestId("config-notification")).toContainText(
      "Configuration saved successfully"
    );
    console.log("Verified success notification");

    // Switch back to public mode
    await page.getByTestId("use-public-api").click();
    console.log("Switched back to public mode");

    // Manually set the API endpoint back to the mock server
    await page.getByTestId("config-api").fill("http://localhost:3006");
    console.log("Set API endpoint back to mock server");

    // Save configuration again
    await page.getByTestId("save-configuration").click();
    console.log("Saved public configuration");

    // Verify success notification
    await expect(page.getByTestId("config-notification")).toBeVisible();
    await expect(page.getByTestId("config-notification")).toContainText(
      "Configuration saved successfully"
    );
    console.log("Verified success notification");

    // Navigate to integrations
    await page.getByTestId("integrations-button").click();
    console.log("Integrations opened");
    // Fill in Telegram configuration
    await page.fill(
      "#telegram-token",
      "123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789",
      {
        timeout: 1000,
      }
    );
    await page.fill("#telegram-chatid", "test-chat-id", {
      timeout: 1000,
    });
    console.log("Telegram config filled");

    // Save the configuration
    await page.getByRole("button", { name: "Save Integrations" }).click();
    console.log("Integrations saved");

    // Wait for the success notification
    await page.waitForSelector("text=Integrations saved successfully", {
      timeout: 2000,
    });
    console.log("Success notification shown");

    // Verify the success notification
    const notification = page.getByRole("alert");
    await expect(notification).toBeVisible();
    await expect(notification).toContainText("Integrations saved successfully");
    await expect(notification).toHaveClass(/MuiAlert-standardSuccess/);
    console.log("Success notification verified");

    // Wait for notification to disappear (6 seconds + animation)
    // await page.waitForTimeout(6500);

    // TODO: Add tests for actual notifications
    // For example:
    // - Add a watch address
    // - Trigger a balance change
    // - Verify that a Telegram notification was sent
  });
});
