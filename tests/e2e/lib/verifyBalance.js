import { expect } from "../test-environment.js";

export default async (
  page,
  address,
  expectedBalances,
  index = 0,
  parentKey = null
) => {
  console.log(`Verifying balance for ${address} at index ${index}`);
  console.log(`Expected balances:`, expectedBalances);

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
  if (expectedBalances.chain_in) {
    console.log(`Verifying chain-in matches ${expectedBalances.chain_in}`);
    try {
      await expect(chainInSelector).toHaveText(expectedBalances.chain_in, {
        // timeout: 10000,
      });
    } catch (error) {
      errors.push(
        `Chain-in balance mismatch. Expected: ${
          expectedBalances.chain_in
        }, Got: ${await chainInSelector.textContent()}`
      );
    }
  }

  // Wait for and verify chain-out balance
  if (expectedBalances.chain_out) {
    console.log(`Verifying chain-out matches ${expectedBalances.chain_out}`);
    try {
      await expect(chainOutSelector).toHaveText(expectedBalances.chain_out, {
        // timeout: 10000,
      });
    } catch (error) {
      errors.push(
        `Chain-out balance mismatch. Expected: ${
          expectedBalances.chain_out
        }, Got: ${await chainOutSelector.textContent()}`
      );
    }
  }

  // Wait for and verify mempool-in balance
  if (expectedBalances.mempool_in) {
    console.log(`Verifying mempool-in matches ${expectedBalances.mempool_in}`);
    try {
      const actualMempoolIn = await mempoolInSelector.textContent();
      console.log("Actual mempool-in value from UI:", actualMempoolIn);
      await expect(mempoolInSelector).toHaveText(expectedBalances.mempool_in, {
        // timeout: 10000,
      });
    } catch (error) {
      errors.push(
        `Mempool-in balance mismatch. Expected: ${
          expectedBalances.mempool_in
        }, Got: ${await mempoolInSelector.textContent()}`
      );
    }
  }

  // Wait for and verify mempool-out balance
  if (expectedBalances.mempool_out) {
    console.log(
      `Verifying mempool-out matches ${expectedBalances.mempool_out}`
    );
    try {
      await expect(mempoolOutSelector).toHaveText(
        expectedBalances.mempool_out
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
