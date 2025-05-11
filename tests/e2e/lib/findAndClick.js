export default async (page, testId, options = {}) => {
  const {
    timeout = 10000,
    exact = false,
    allowOverlay = false,
    force = false,
  } = options;

  console.log(`Waiting for element with testId: ${testId}`);

  // Get the element using data-testid
  const element = page.getByTestId(testId);

  // Wait for the element to be visible
  await element.waitFor({ state: "visible", timeout });

  await element.scrollIntoViewIfNeeded();

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
        (id) => {
          const element = document.querySelector(`[data-testid="${id}"]`);
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        testId,
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

  // Scroll element into view if needed
  await element.scrollIntoViewIfNeeded();

  // Click with stability checks
  console.log(`Clicking element with testId: ${testId}`);
  if (exact) {
    await element.first().click({ timeout, force });
  } else {
    await element.click({ timeout, force });
  }
  await page.waitForTimeout(350);
};
