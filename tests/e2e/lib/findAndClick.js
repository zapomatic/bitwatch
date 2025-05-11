export default async (page, selector, options = {}) => {
  const {
    timeout = 10000,
    exact = false,
    allowOverlay = false,
    force = false,
  } = options;
  const locator = page.locator(selector);

  console.log(`Waiting for selector: ${selector}`);

  // Wait for any matching element to be visible
  await page.waitForSelector(selector, { state: "visible", timeout });

  // Only check for overlays if we're not trying to click something in a dialog
  if (!allowOverlay) {
    // Wait for any overlays/dialogs to be gone
    const overlaySelector = ".MuiDialog-root, .MuiModal-root";
    const overlay = page.locator(overlaySelector);
    const hasOverlay = await overlay.isVisible().catch(() => false);
    if (hasOverlay) {
      console.log("Overlay detected, waiting for it to disappear...");
      await page.waitForSelector(overlaySelector, { state: "hidden", timeout });
    }
  }

  // Wait for the element to be stable with retries
  let retries = 3;
  while (retries > 0) {
    try {
      await page.waitForFunction(
        (sel) => {
          const element = document.querySelector(sel);
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        selector,
        { timeout: timeout / 3 }
      );
      break;
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      console.log(`Element not stable, retrying... (${retries} attempts left)`);
      await page.waitForTimeout(1000);
    }
  }

  // Click with stability checks
  console.log(`Clicking element: ${selector}`);
  if (exact) {
    await locator.first().click({ timeout, force });
  } else {
    await locator.click({ timeout, force });
  }
  await page.waitForTimeout(350);
};
