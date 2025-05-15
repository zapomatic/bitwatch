import { expect } from "../test-environment.js";

export default async (page, address, expectedBalances) => {
  const expectation = {
    chain_in: "0.00000000 ₿",
    chain_out: "0.00000000 ₿",
    mempool_in: "0.00000000 ₿",
    mempool_out: "0.00000000 ₿",
    ...(expectedBalances || {}),
  };
  // console.log(`Verifying balance for ${address} is `, expectation);
  // Get selectors
  const selectors = {
    chain_in: page.getByTestId(`${address}-chain-in`),
    chain_out: page.getByTestId(`${address}-chain-out`),
    mempool_in: page.getByTestId(`${address}-mempool-in`),
    mempool_out: page.getByTestId(`${address}-mempool-out`),
  };

  // Wait for each balance to match expected value with timeout
  await Promise.all(
    Object.entries(expectation).map(([key, expectedValue]) =>
      expect(selectors[key]).toHaveText(expectedValue, { timeout: 30000 })
    )
  );

  // Log final values for debugging
  const balances = await Promise.all(
    Object.entries(selectors).map(async ([key, selector]) => {
      const value = await selector.textContent();
      return [key, value];
    })
  );
  console.log(`${address} final balances:`, Object.fromEntries(balances));
};
