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

  // For balance cells, we use the new format
  const testIdPrefix = parentKey ? `${parentKey}-address-${index}` : address;

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

  if (expectedBalances.chain_in) {
    console.log(`Verifying chain-in matches ${expectedBalances.chain_in}`);
    const actualChainIn = await chainInSelector.textContent();
    if (actualChainIn !== expectedBalances.chain_in) {
      errors.push(
        `Chain-in balance mismatch. Expected: ${expectedBalances.chain_in}, Got: ${actualChainIn}`
      );
    }
  }

  if (expectedBalances.chain_out) {
    console.log(`Verifying chain-out matches ${expectedBalances.chain_out}`);
    const actualChainOut = await chainOutSelector.textContent();
    if (actualChainOut !== expectedBalances.chain_out) {
      errors.push(
        `Chain-out balance mismatch. Expected: ${expectedBalances.chain_out}, Got: ${actualChainOut}`
      );
    }
  }

  if (expectedBalances.mempool_in) {
    console.log(`Verifying mempool-in matches ${expectedBalances.mempool_in}`);
    const actualMempoolIn = await mempoolInSelector.textContent();
    if (actualMempoolIn !== expectedBalances.mempool_in) {
      errors.push(
        `Mempool-in balance mismatch. Expected: ${expectedBalances.mempool_in}, Got: ${actualMempoolIn}`
      );
    }
  }

  if (expectedBalances.mempool_out) {
    console.log(
      `Verifying mempool-out matches ${expectedBalances.mempool_out}`
    );
    const actualMempoolOut = await mempoolOutSelector.textContent();
    if (actualMempoolOut !== expectedBalances.mempool_out) {
      errors.push(
        `Mempool-out balance mismatch. Expected: ${expectedBalances.mempool_out}, Got: ${actualMempoolOut}`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`Balance verification failed:\n${errors.join("\n")}`);
  }
};
