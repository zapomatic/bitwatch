export default async (page, selector, value, options = {}) => {
  const { timeout = 10000, exact = false } = options;
  const locator = page.locator(`${selector} input`);

  // Wait for any matching element to be visible
  await page.waitForSelector(`${selector} input`, {
    state: "visible",
    timeout,
  });

  if (exact) {
    await locator.first().fill(value);
  } else {
    await locator.fill(value);
  }
};
