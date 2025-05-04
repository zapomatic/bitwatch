import { test, expect } from "./test-environment.js";
import testData from "../../test-data/keys.json" with { type: 'json' };
import testDb from "../../server/db.test.json" with { type: 'json' };
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
    await page.waitForSelector('[aria-label="Server status: CONNECTED"]');
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
    await page.waitForSelector('[aria-label="WebSocket status: CONNECTED"]');
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

    // Verify default test values first
    await expect(page.getByTestId("config-api")).toHaveValue(testDb.api);
    await expect(page.getByTestId("config-interval")).toHaveValue(testDb.interval.toString());
    await expect(page.getByTestId("config-apiDelay")).toHaveValue(testDb.apiDelay.toString());
    await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue(testDb.apiParallelLimit.toString());
    await expect(page.getByTestId("config-debugLogging")).not.toBeChecked();

    // Switch to public mode and verify public settings
    await page.getByTestId("use-public-api").click();
    console.log("Switched to public mode");
    await expect(page.getByTestId("config-api")).toHaveValue("https://mempool.space");
    await expect(page.getByTestId("config-interval")).toHaveValue("600000");
    await expect(page.getByTestId("config-apiDelay")).toHaveValue("2000");
    await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue("1");

    // Switch to private mode and verify private settings
    await page.getByTestId("use-local-node").click();
    console.log("Switched to private mode");
    await expect(page.getByTestId("config-api")).toHaveValue("http://10.21.21.26:3006");
    await expect(page.getByTestId("config-interval")).toHaveValue("60000");
    await expect(page.getByTestId("config-apiDelay")).toHaveValue("100");
    await expect(page.getByTestId("config-apiParallelLimit")).toHaveValue("100");

    // Return to test settings
    await page.getByTestId("use-public-api").click();
    console.log("Returned to public mode");
    await page.getByTestId("config-api").fill(testDb.api);
    await page.getByTestId("config-interval").fill(testDb.interval.toString());
    await page.getByTestId("config-apiDelay").fill(testDb.apiDelay.toString());
    await page.getByTestId("config-apiParallelLimit").fill(testDb.apiParallelLimit.toString());
    await page.getByTestId("config-debugLogging").click();
    await expect(page.getByTestId("config-debugLogging")).toBeChecked();
    console.log("Restored test settings");

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

    // Navigate to integrations
    await page.getByTestId("integrations-button").click();
    console.log("Integrations opened");
    // Fill in Telegram configuration
    await page.fill(
      "#telegram-token",
      "123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789"
    );
    await page.fill("#telegram-chatid", "test-chat-id");
    console.log("Telegram config filled");

    // Save the configuration
    await page.getByRole("button", { name: "Save Integrations" }).click();
    console.log("Integrations saved");

    // Wait for the success notification
    await page.waitForSelector("text=Integrations saved successfully");
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

    // Verify address is visible in the expanded table
    await expect(page.locator('text=Single Addresses')).toBeVisible();
    await expect(page.locator('table.address-subtable')).toBeVisible();
    await expect(page.locator(`text=${testData.addresses.zapomatic.slice(0, 8)}...`)).toBeVisible();
    console.log("Verified address table is visible");

    // Wait for the loading state to complete
    const address = testData.addresses.zapomatic;
    await expect(page.getByTestId(`${address}-chain-in`)).not.toContainText("Loading...");
    await expect(page.getByTestId(`${address}-chain-out`)).not.toContainText("Loading...");
    await expect(page.getByTestId(`${address}-mempool-in`)).not.toContainText("Loading...");
    await expect(page.getByTestId(`${address}-mempool-out`)).not.toContainText("Loading...");

    await expect(page.getByTestId(`${address}-mempool-in-auto-accept-icon`)).toBeVisible();
    await expect(page.getByTestId(`${address}-chain-in-auto-accept-icon`)).toBeVisible();
    await expect(page.getByTestId(`${address}-mempool-out-alert-icon`)).toBeVisible();
    await expect(page.getByTestId(`${address}-chain-out-alert-icon`)).toBeVisible();

    // Verify initial balance values
    await expect(page.getByTestId(`${address}-chain-in`)).toHaveText("0.00000000 ₿");
    await expect(page.getByTestId(`${address}-chain-out`)).toHaveText("0.00000000 ₿");
    await expect(page.getByTestId(`${address}-mempool-in`)).toHaveText("0.00000000 ₿");
    await expect(page.getByTestId(`${address}-mempool-out`)).toHaveText("0.00000000 ₿");
    
    // Wait for mempool input
    await expect(page.getByTestId(`${address}-mempool-in`).and(page.getByLabel("Balance value"))).toHaveText("0.00010000 ₿");
    // Wait for chain input
    await expect(page.getByTestId(`${address}-chain-in`).and(page.getByLabel("Balance value"))).toHaveText("0.00010000 ₿");
    // Wait for mempool output
    await expect(page.getByTestId(`${address}-mempool-out`).and(page.getByLabel("Balance value"))).toHaveText("0.00001000 ₿");
    // Wait for the diff to appear and have the correct value
    await expect(page.getByTestId(`${address}-mempool-out-diff`)).toBeVisible();
    await expect(page.getByTestId(`${address}-mempool-out-diff`)).toHaveText("(+0.00001000 ₿)");
    // Verify accept button for address change state
    await expect(page.getByTestId(`${address}-accept-button`)).toBeVisible();
    
    // Wait for chain output
    await expect(page.getByTestId(`${address}-chain-out`).and(page.getByLabel("Balance value"))).toHaveText("0.00001000 ₿");
    await expect(page.getByTestId(`${address}-chain-out-diff`)).toBeVisible();
    await expect(page.getByTestId(`${address}-chain-out-diff`)).toHaveText("(+0.00001000 ₿)");
    // Verify alert icon and accept button for chain-out
    await expect(page.getByTestId(`${address}-chain-out-alert-icon`)).toBeVisible();
    await expect(page.getByTestId(`${address}-accept-button`)).toBeVisible();
    // Accept the chain-out change
    await page.getByTestId(`${address}-accept-button`).click();
    // verify that the change took (no longer showing a diff)
    await expect(page.getByTestId(`${address}-chain-out-diff`)).not.toBeVisible();
    
    // Delete address
    await page.getByTestId(`${address}-delete-button`).click();
    // Verify delete confirmation dialog appears with correct message
    await expect(page.getByRole("heading", { name: "Confirm Delete" })).toBeVisible();
    await expect(page.getByText("Remove this address from the collection?")).toBeVisible();
    // Confirm deletion
    await page.getByRole("button", { name: "Delete" }).click();
    console.log("Deleted address");
    // verify that the address is deleted
    await expect(page.getByTestId(`${address}-delete-button`)).not.toBeVisible();
    // verify that the collection still exists
    await expect(page.getByTestId("Donations-add-address")).toBeVisible();

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
      await page.waitForSelector('[aria-label="Addresses generated"]');
      console.log("Addresses generated");

      // Verify values on chain and mempool
      await expect(page.getByText("Chain balance")).toBeVisible();
      await expect(page.getByText("Mempool balance")).toBeVisible();
      console.log("Verified chain and mempool values");

      // Wait for balance change event
      await page.waitForSelector('[aria-label="Balance change detected"]');
      console.log("Balance change detected");

      // Accept balance change
      await page.getByRole("button", { name: "Accept" }).click();
      console.log("Accepted balance change");

      // Verify balance is confirmed
      await expect(page.getByText("Balance confirmed")).toBeVisible();
      console.log("Verified balance confirmation");

      // Delete extended key
      await page.getByTestId(`${key.key}-delete-button`).click();
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
      await page.waitForSelector('[aria-label="Addresses generated"]');
      console.log("Addresses generated");

      // Verify values on chain and mempool
      await expect(page.getByText("Chain balance")).toBeVisible();
      await expect(page.getByText("Mempool balance")).toBeVisible();
      console.log("Verified chain and mempool values");

      // Wait for balance change event
      await page.waitForSelector('[aria-label="Balance change detected"]');
      console.log("Balance change detected");

      // Accept balance change
      await page.getByRole("button", { name: "Accept" }).click();
      console.log("Accepted balance change");

      // Verify balance is confirmed
      await expect(page.getByText("Balance confirmed")).toBeVisible();
      console.log("Verified balance confirmation");

      // Delete descriptor
      await page.getByTestId(`${descriptor.descriptor}-delete-button`).click();
      console.log("Deleted descriptor");
    }

    // Delete collection
    await page.getByTestId("Test Collection-delete").click();
    console.log("Deleted test collection");
  });
});
