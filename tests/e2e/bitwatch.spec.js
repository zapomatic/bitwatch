import { test, expect } from "./test-environment.js";
import testData from "../../test-data/keys.json" with { type: 'json' };

test.describe("Bitwatch", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and wait for it to load
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("complete flow: configure telegram and monitor address", async ({ page, mockServices }) => {
    // Step 1: Configure Telegram Bot
    await page.getByRole("button", { name: "Integrations" }).click();
    await page.waitForLoadState("networkidle");

    // Fill in telegram bot configuration
    await page
      .getByLabel("Bot Token")
      .fill("123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
    await page.getByLabel("Chat ID").fill("123456789");

    // Save configuration
    const saveButton = page.getByRole("button", { name: "Save Integrations" });
    await saveButton.click();
    await page.waitForLoadState("networkidle");
    
    // Wait for the button to be visible and enabled again
    await expect(saveButton).toBeVisible();
    await expect(saveButton).not.toBeDisabled();

    // Wait for success message
    await expect(page.getByText("Settings saved successfully!")).toBeVisible();

    // Verify mock telegram bot is configured
    expect(mockServices.telegram).toBeDefined();
    expect(mockServices.telegram.token).toBe(
      "123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
    );
    expect(mockServices.telegram.chatId).toBe("123456789");

    // Step 2: Return to main page and add address
    await page.getByRole("button", { name: "Watch List" }).click();
    await page.waitForLoadState("networkidle");

    // Setup test data
    const testAddress = testData.addresses.zpub1.addresses[0];
    
    // Set up initial balance
    mockServices.mempool.setAddressBalance(testAddress.address, {
      chain_in: 0,
      chain_out: 0,
      mempool_in: 0,
      mempool_out: 0
    });
    
    // Update client mock balances
    await page.evaluate(balances => {
      window.__setMockBalances(balances);
    }, mockServices.mempool.getBalances());
    
    // Add collection
    await page.getByRole('button', { name: 'Add Collection' }).click();
    await page.getByRole('textbox').fill('Test Collection');
    await page.getByRole('button', { name: /^Add$/ }).click();
    
    // Expand the collection
    await page.getByRole('row').filter({ hasText: 'Test Collection' })
      .getByRole('button')
      .first()
      .click();
    
    // Add address to collection
    await page.getByTestId('Test Collection-add-address').click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Test Address');
    await page.getByRole('textbox', { name: 'Address' }).fill(testAddress.address);
    await page.getByRole('button', { name: 'Save' }).click();

    // Wait for dialog to close and state to update
    await page.waitForSelector('text=Test Address');
    await page.waitForSelector(`text=${testAddress.address}`);

    // Step 3: Simulate balance change and verify Telegram notification
    mockServices.mempool.setAddressBalance(testAddress.address, {
      chain_in: 100000,
      chain_out: 0,
      mempool_in: 50000,
      mempool_out: 0
    });

    // Update client mock balances
    await page.evaluate(balances => {
      window.__setMockBalances(balances);
    }, mockServices.mempool.getBalances());

    // Emit state update
    mockServices.websocket.emit('updateState', {
      collections: {
        'Test Collection': {
          name: 'Test Collection',
          addresses: [{
            name: 'Test Address',
            address: testAddress.address,
            actual: {
              chain_in: 100000,
              chain_out: 0,
              mempool_in: 50000,
              mempool_out: 0
            }
          }]
        }
      }
    });

    // Wait for balance update
    await page.waitForSelector('text=100,000');
    await page.waitForSelector('text=50,000');

    // Verify Telegram notification was sent
    expect(mockServices.telegram.messages.length).toBeGreaterThan(0);
    const lastMessage = mockServices.telegram.messages[mockServices.telegram.messages.length - 1];
    expect(lastMessage).toContain('Balance Change Detected');
    expect(lastMessage).toContain('Test Collection/Test Address');
    expect(lastMessage).toContain('Chain In: 100000');
    expect(lastMessage).toContain('Mempool In: 50000');
  });
}); 