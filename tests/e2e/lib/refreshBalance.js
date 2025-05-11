import { expect } from "@playwright/test";
import findAndClick from "./findAndClick.js";
import verifyBalance from "./verifyBalance.js";

export default async (
  page,
  address,
  expectedBalances,
  index = 0,
  parentKey = null
) => {
  // For balance cells, we use the new format
  const testIdPrefix = parentKey ? `${parentKey}-address-${index}` : address;

  // If this is a child address, ensure the parent section is expanded
  if (parentKey) {
    const expandButton = page.getByTestId(`${parentKey}-expand-button`);
    const expandedState = await expandButton.getAttribute("aria-expanded");
    console.log(`expandedState of ${parentKey}-expand-button`, expandedState);

    // Only expand if explicitly collapsed (aria-expanded="false")
    // If it's null or "true", we want to leave it as is
    if (expandedState === "false") {
      await findAndClick(page, `[data-testid="${parentKey}-expand-button"]`);
    }

    // Log all data-testid attributes on the page to see what's available
    // console.log("Logging all data-testid elements on page:");
    // const allTestIds = await page.evaluate(() => {
    //   const elements = document.querySelectorAll("[data-testid]");
    //   return Array.from(elements).map((el) => ({
    //     testId: el.getAttribute("data-testid"),
    //     tagName: el.tagName,
    //     className: el.className,
    //     isVisible: el.offsetParent !== null,
    //   }));
    // });
    // console.log(JSON.stringify(allTestIds, null, 2));

    // Check if this is a descriptor (starts with pkh, sh, wpkh, etc) or an extended key
    const isDescriptor =
      parentKey.startsWith("pkh(") ||
      parentKey.startsWith("sh(") ||
      parentKey.startsWith("wpkh(");
    console.log("Is descriptor:", isDescriptor);

    const addressListSelector = isDescriptor
      ? `[data-testid="${parentKey}-address-list"]`
      : `[data-testid="${parentKey}-address-list"]`;
    console.log("Looking for address list with selector:", addressListSelector);

    // Wait for the address list to be visible with a longer timeout
    await page.waitForSelector(addressListSelector, {
      state: "visible",
      timeout: 10000,
    });

    // Wait for the address list to be visible first
    const addressList = page.locator(addressListSelector);

    // Log whether the element exists and its state
    const exists = (await addressList.count()) > 0;
    console.log(`Address list exists: ${exists}`);
    if (exists) {
      const isVisible = await addressList.isVisible();
      console.log(`Address list is visible: ${isVisible}`);
      // const html = await addressList.evaluate((el) => el.outerHTML);
      // console.log(`Address list HTML: ${html}`);
    }

    // Log the parent container state
    // const parentContainer = await page.evaluate((selector) => {
    //   const el = document.querySelector(selector);
    //   if (el) {
    //     const parent = el.closest(".MuiCollapse-root");
    //     return parent
    //       ? {
    //           className: parent.className,
    //           style: parent.getAttribute("style"),
    //           isVisible: window.getComputedStyle(parent).display !== "none",
    //         }
    //       : null;
    //   }
    //   return null;
    // }, addressListSelector);
    // console.log("Parent container state:", parentContainer);

    await expect(addressList).toBeVisible();

    // Now verify the specific address row is visible
    const addressRow = page.getByTestId(`${testIdPrefix}-row`);
    await expect(addressRow).toBeVisible();
  }

  // Find and verify the refresh button exists and is visible
  const refreshButton = page.getByTestId(`${testIdPrefix}-refresh-button`);
  await expect(refreshButton).toBeVisible();

  // Click the refresh button and wait for loading state
  await findAndClick(page, `[data-testid="${testIdPrefix}-refresh-button"]`, {
    force: true,
  });

  // Wait for the notification to appear
  const notification = page.getByTestId("notification");
  await expect(notification).toBeVisible();

  // Verify it's a success notification
  await expect(notification).toHaveClass(/MuiAlert-standardSuccess/);

  // Try to close the notification if it has a close button
  const closeButton = notification.locator('button[aria-label="Close"]');
  if (await closeButton.isVisible()) {
    await closeButton.click();
  }

  // Wait for the notification to disappear
  await page
    .waitForSelector('[data-testid="notification"]', {
      state: "hidden",
      timeout: 5000,
    })
    .catch(async () => {
      // If notification doesn't disappear, try clicking the close button again
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForSelector('[data-testid="notification"]', {
          state: "hidden",
          timeout: 5000,
        });
      }
    });

  // Add a small delay to ensure all state updates are complete
  await page.waitForTimeout(500);

  // Now verify the balances
  verifyBalance(page, address, expectedBalances, index, parentKey);
};
