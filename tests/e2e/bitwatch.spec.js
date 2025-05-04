import { test, expect } from "./test-environment.js";
import testData from "../../test-data/keys.json" with { type: 'json' };
import { addCollection, addAddress, addExtendedKey, addDescriptor } from "./test-environment.js";

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
    // Dismiss the notification
    await page.getByTestId("config-notification").getByRole("button", { name: "Close" }).click();
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
    // Dismiss the notification
    await page.getByTestId("config-notification").getByRole("button", { name: "Close" }).click();
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
    // Dismiss the notification
    await notification.getByRole("button", { name: "Close" }).click();
    console.log("Success notification verified");

    // Navigate to addresses page
    await page.getByTestId("watch-list-button").click();
    console.log("Navigated to addresses page");

    // Add a new collection
    await addCollection(page, "Donations");
    console.log("Added test collection");

    // Add single address
    await addAddress(page, "Donations", {
      name: "zapomatic",
      address: testData.addresses.zapomatic
    });
    console.log("Added single address");

    // Verify loading state
    await expect(page.locator('.balance-cell .crystal-text:has-text("Loading...")')).toBeVisible({ timeout: 30000 });
    console.log("Verified loading state");

    // Wait for balance change event
    await page.waitForSelector('[aria-label="Balance change detected"]', {
      timeout: 5000,
    });
    console.log("Balance change detected");

    // Verify balance change in UI
    await expect(page.getByText("Balance changed")).toBeVisible();
    console.log("Verified balance change in UI");

    // Accept balance change
    await page.getByRole("button", { name: "Accept" }).click();
    console.log("Accepted balance change");

    // Verify balance is confirmed
    await expect(page.getByText("Balance confirmed")).toBeVisible();
    console.log("Verified balance confirmation");

    // Delete address
    await page.getByTestId("delete-button").click();
    console.log("Deleted address");

    // Add extended keys (xpub, ypub, zpub)
    const extendedKeys = [
      {
        name: "Test XPub",
        key: testData.keys.xpub1,
        derivationPath: "m/0",
        skip: 2,
        gapLimit: 3,
        initialAddresses: 3
      },
      {
        name: "Test YPub",
        key: testData.keys.ypub1,
        derivationPath: "m/0",
        skip: 2,
        gapLimit: 3,
        initialAddresses: 3
      },
      {
        name: "Test ZPub",
        key: testData.keys.zpub1,
        derivationPath: "m/0",
        skip: 2,
        gapLimit: 3,
        initialAddresses: 3
      }
    ];

    for (const key of extendedKeys) {
      await addExtendedKey(page, "Test Collection", key);
      console.log(`Added ${key.name}`);

      // Verify addresses loading
      await expect(page.getByText("Loading addresses...")).toBeVisible();
      console.log("Verified addresses loading");

      // Wait for addresses to be generated
      await page.waitForSelector('[aria-label="Addresses generated"]', {
        timeout: 5000,
      });
      console.log("Addresses generated");

      // Verify values on chain and mempool
      await expect(page.getByText("Chain balance")).toBeVisible();
      await expect(page.getByText("Mempool balance")).toBeVisible();
      console.log("Verified chain and mempool values");

      // Wait for balance change event
      await page.waitForSelector('[aria-label="Balance change detected"]', {
        timeout: 5000,
      });
      console.log("Balance change detected");

      // Accept balance change
      await page.getByRole("button", { name: "Accept" }).click();
      console.log("Accepted balance change");

      // Verify balance is confirmed
      await expect(page.getByText("Balance confirmed")).toBeVisible();
      console.log("Verified balance confirmation");

      // Delete extended key
      await page.getByTestId("delete-button").click();
      console.log("Deleted extended key");
    }

    // Add descriptors
    const descriptors = [
      {
        name: "Test MultiSig",
        descriptor: testData.descriptors.multiSig
      },
      {
        name: "Test SortedMultiSig",
        descriptor: testData.descriptors.sortedMultiSig
      },
      {
        name: "Test MixedKeyTypes",
        descriptor: testData.descriptors.mixedKeyTypes
      }
    ];

    for (const descriptor of descriptors) {
      await addDescriptor(page, "Test Collection", descriptor);
      console.log(`Added ${descriptor.name}`);

      // Verify addresses loading
      await expect(page.getByText("Loading addresses...")).toBeVisible();
      console.log("Verified addresses loading");

      // Wait for addresses to be generated
      await page.waitForSelector('[aria-label="Addresses generated"]', {
        timeout: 5000,
      });
      console.log("Addresses generated");

      // Verify values on chain and mempool
      await expect(page.getByText("Chain balance")).toBeVisible();
      await expect(page.getByText("Mempool balance")).toBeVisible();
      console.log("Verified chain and mempool values");

      // Wait for balance change event
      await page.waitForSelector('[aria-label="Balance change detected"]', {
        timeout: 5000,
      });
      console.log("Balance change detected");

      // Accept balance change
      await page.getByRole("button", { name: "Accept" }).click();
      console.log("Accepted balance change");

      // Verify balance is confirmed
      await expect(page.getByText("Balance confirmed")).toBeVisible();
      console.log("Verified balance confirmation");

      // Delete descriptor
      await page.getByTestId("delete-button").click();
      console.log("Deleted descriptor");
    }

    // Delete collection
    await page.getByTestId("Test Collection-delete").click();
    console.log("Deleted test collection");
  });
});
