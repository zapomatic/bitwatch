import { expect } from "../test-environment.js";

// Escape a literal balance string so it can anchor a RegExp prefix match.
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default async (page, address, expectedBalances) => {
  const expectation = {
    chain_in: "0.00000000 ₿",
    chain_out: "0.00000000 ₿",
    mempool_in: "0.00000000 ₿",
    mempool_out: "0.00000000 ₿",
    ...(expectedBalances || {}),
  };

  const selectors = {
    chain_in: page.getByTestId(`${address}-chain-in`),
    chain_out: page.getByTestId(`${address}-chain-out`),
    mempool_in: page.getByTestId(`${address}-mempool-in`),
    mempool_out: page.getByTestId(`${address}-mempool-out`),
  };

  // Wait for all balance values to be visible and match expected
  await Promise.all(
    Object.entries(selectors).map(async ([key, locator]) => {
      await locator.waitFor({ state: "visible", timeout: 5000 });
      // Alert-monitored balances whose actual value differs from the accepted
      // baseline render a pending-diff annotation inside the same cell, e.g.
      // "0.00001000 ₿(+0.00001000 ₿)". Assert the value appears at the start of
      // the cell and tolerate a trailing diff (asserted separately where it
      // matters) so this doesn't depend on a transient single-frame render.
      await expect(locator).toHaveText(
        new RegExp(`^${escapeRegExp(expectation[key])}`),
        { timeout: 10000 }
      );
    })
  );

  // Log final values for debugging
  const results = await Promise.all(
    Object.entries(selectors).map(async ([key, selector]) => {
      const value = (await selector.textContent())?.trim();
      return [key, value];
    })
  );
  // console.log(`${address} final balances:`, Object.fromEntries(results));
  return true;
};
