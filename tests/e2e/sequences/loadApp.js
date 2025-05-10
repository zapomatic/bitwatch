import { expect } from "@playwright/test";

export default async (page) => {
  // Navigate to the app and wait for it to load
  console.log("Navigating to app...");
  await page.goto("/");
  console.log("Waiting for network idle...");
  await page.waitForLoadState("networkidle");
  await page.waitForSelector("text=bitwatch");
  console.log("Page loaded");

  // Small delay to ensure page is fully loaded
  await page.waitForTimeout(1000);

  // Wait for status indicators to be present
  console.log("Waiting for status indicators...");
  await page.waitForSelector('[data-testid="bitwatch-socket-status"]');
  await page.waitForSelector('[data-testid="mempool-socket-status"]');

  // Verify the states
  const serverState = await page.evaluate(() => {
    const statusElement = document.querySelector(
      '[data-testid="bitwatch-socket-status"]'
    );
    return statusElement.textContent;
  });
  expect(serverState).toBe("Bitwatch Socket");
  console.log("Server connected");

  const websocketState = await page.evaluate(() => {
    const statusElement = document.querySelector(
      '[data-testid="mempool-socket-status"]'
    );
    return statusElement.textContent;
  });
  expect(websocketState).toBe("Mempool Socket");
  console.log("Mempool Socket connected");
};
