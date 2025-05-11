import { expect } from "@playwright/test";
import findAndClick from "../lib/findAndClick.js";

export default async (page) => {
  // Navigate to integrations
  await findAndClick(page, '[data-testid="integrations-button"]');
  console.log("Integrations opened");
  // Fill in Telegram configuration
  await page.fill(
    "#telegram-token",
    "123456789:ABCdefGHIjklMNOpqrsTUVwxyz123456789"
  );
  await page.fill("#telegram-chatid", "test-chat-id");
  console.log("Telegram config filled");

  // Save the configuration
  await findAndClick(page, '[data-testid="save-integrations"]');
  console.log("Integrations saved");

  // Wait for the success notification
  const notification = page.getByRole("alert");
  await expect(notification).toBeVisible();
  await expect(notification).toContainText("Integrations saved successfully");
  await expect(notification).toHaveClass(/MuiAlert-standardSuccess/);
  console.log("Success notification verified");
};
