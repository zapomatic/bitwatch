import { test, expect } from "./test-environment.js";
// import testData from "../../test-data/keys.json" with { type: 'json' };

test.describe("Bitwatch", () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test("Configuration Page", async ({ page, mockServices, serverLogs }) => {
    // Click the settings button
    await page.click("button[aria-label='Settings']", { timeout: 5000 });
    console.log("Settings opened");

    // see that we have the appropriate settings
  });

  test("Telegram Page", async ({ page, mockServices }) => {
    // Fill in Telegram configuration
    await page.fill("input[name='telegramToken']", "test-token", {
      timeout: 5000,
    });
    await page.fill("input[name='telegramChatId']", "test-chat-id", {
      timeout: 5000,
    });
    console.log("Telegram config filled");

    // Save the configuration
    await page.click("button:has-text('Save')", { timeout: 5000 });
    console.log("Configuration saved");

    // Wait for the save to complete
    await page.waitForSelector("text=Configuration saved successfully", {
      timeout: 5000,
    });
    console.log("Configuration saved confirmed");

    // Verify the server received the configuration
    const telegramConfig = mockServices.telegram.getConfig();
    expect(telegramConfig).toEqual({
      token: "test-token",
      chatId: "test-chat-id",
    });

    // Verify the server attempted to initialize Telegram
    const telegramInitAttempts = mockServices.telegram.getInitAttempts();
    expect(telegramInitAttempts).toBe(1);

    // Verify the server attempted to send a test message
    const testMessages = mockServices.telegram.getMessages();
    expect(testMessages).toContain(
      "✅ Bitwatch Telegram notifications configured successfully!"
    );
    // Configure mock service to fail
    mockServices.telegram.failNextInit = true;

    // Navigate to integrations
    console.log("Clicking Integrations button...");
    await page.getByRole("button", { name: "Integrations" }).click();
    console.log("Waiting for network idle after clicking Integrations...");
    await page.waitForLoadState("networkidle");
    console.log("Integrations page loaded");

    // Wait for the form to be visible
    console.log("Waiting for Bot Token input...");
    await page
      .getByLabel("Bot Token")
      .waitFor({ state: "visible", timeout: 10000 });
    console.log("Bot Token input visible");

    // Fill in invalid telegram bot configuration
    console.log("Filling in invalid bot configuration...");
    await page.getByLabel("Bot Token").fill("invalid-token");
    await page.getByLabel("Chat ID").fill("invalid-chat-id");
    console.log("Invalid bot configuration filled");

    // Save configuration
    console.log("Looking for Save Integrations button...");
    const saveButton = page.getByRole("button", { name: "Save Integrations" });
    await saveButton.waitFor({ state: "visible", timeout: 10000 });
    console.log("Save Integrations button found, clicking...");
    await saveButton.click();
    console.log("Waiting for network idle after save...");
    await page.waitForLoadState("networkidle");

    // Wait for the button to be visible and enabled again
    console.log("Waiting for Save Integrations button to be visible again...");
    await expect(saveButton).toBeVisible();
    await expect(saveButton).not.toBeDisabled();
    console.log("Save Integrations button is visible and enabled");

    // Wait for error notification
    console.log("Waiting for error notification...");
    const errorNotification = page
      .getByRole("alert")
      .filter({ hasText: "Failed to create telegram bot" });
    await expect(errorNotification).toBeVisible();
    console.log("Error notification visible");

    // Verify notification has error styling
    await expect(errorNotification).toHaveClass(/MuiAlert-standardError/);
    console.log("Error notification has correct styling");

    // Verify notification auto-dismisses after 6 seconds
    await expect(errorNotification).not.toBeVisible({ timeout: 7000 });
    console.log("Error notification auto-dismissed");
  });
});
