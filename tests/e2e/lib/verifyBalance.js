import { expect } from "../test-environment.js";

export default async (page, address, expectedBalances) => {
  const expectation = {
    chain_in: expectedBalances.chain_in || "0.00000000 ₿",
    chain_out: expectedBalances.chain_out || "0.00000000 ₿",
    mempool_in: expectedBalances.mempool_in || "0.00000000 ₿",
    mempool_out: expectedBalances.mempool_out || "0.00000000 ₿",
    ...(expectedBalances || {}),
  };
  console.log(`Verifying balance for ${address} is `, expectation);

  // For balance cells, we now use the address as the test ID prefix
  const testIdPrefix = address;

  // First verify all balance selectors exist and are visible
  const chainInSelector = page.getByTestId(`${testIdPrefix}-chain-in`);
  const chainOutSelector = page.getByTestId(`${testIdPrefix}-chain-out`);
  const mempoolInSelector = page.getByTestId(`${testIdPrefix}-mempool-in`);
  const mempoolOutSelector = page.getByTestId(`${testIdPrefix}-mempool-out`);

  // Wait for all selectors to be visible first
  await Promise.all([
    chainInSelector.waitFor({ state: "visible", timeout: 10000 }),
    chainOutSelector.waitFor({ state: "visible", timeout: 10000 }),
    mempoolInSelector.waitFor({ state: "visible", timeout: 10000 }),
    mempoolOutSelector.waitFor({ state: "visible", timeout: 10000 }),
  ]);

  // Log current values before verification
  console.log("Current values:");
  console.log("Chain-in:", await chainInSelector.textContent());
  console.log("Chain-out:", await chainOutSelector.textContent());
  console.log("Mempool-in:", await mempoolInSelector.textContent());
  console.log("Mempool-out:", await mempoolOutSelector.textContent());

  // Then verify all balance values match expected values
  const errors = [];

  // Wait for and verify chain-in balance
  console.log(`Verifying chain-in matches ${expectation.chain_in}`);
  try {
    await expect(chainInSelector).toHaveText(expectation.chain_in);
  } catch (error) {
    errors.push(
      `Chain-in balance mismatch. Expected: ${
        expectedBalances.chain_in
      }, Got: ${await chainInSelector.textContent()}`
    );
  }

  // Wait for and verify chain-out balance
  if (expectation.chain_out) {
    console.log(`Verifying chain-out matches ${expectation.chain_out}`);
    try {
      await expect(chainOutSelector).toHaveText(expectation.chain_out);
    } catch (error) {
      errors.push(
        `Chain-out balance mismatch. Expected: ${
          expectation.chain_out
        }, Got: ${await chainOutSelector.textContent()}`
      );
    }
  }

  // Wait for and verify mempool-in balance
  if (expectation.mempool_in) {
    console.log(`Verifying mempool-in matches ${expectation.mempool_in}`);
    try {
      const actualMempoolIn = await mempoolInSelector.textContent();
      console.log("Actual mempool-in value from UI:", actualMempoolIn);
      await expect(mempoolInSelector).toHaveText(expectation.mempool_in, {
        // timeout: 10000,
      });
    } catch (error) {
      errors.push(
        `Mempool-in balance mismatch. Expected: ${
          expectation.mempool_in
        }, Got: ${await mempoolInSelector.textContent()}`
      );
    }
  }

  // Wait for and verify mempool-out balance
  if (expectation.mempool_out) {
    console.log(`Verifying mempool-out matches ${expectation.mempool_out}`);
    try {
      await expect(mempoolOutSelector).toHaveText(
        expectation.mempool_out
        // { timeout: 5000 }
      );
    } catch (error) {
      errors.push(
        `Mempool-out balance mismatch. Expected: ${
          expectedBalances.mempool_out
        }, Got: ${await mempoolOutSelector.textContent()}`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`Balance verification failed:\n${errors.join("\n")}`);
  }
};
