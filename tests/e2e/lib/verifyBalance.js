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

  await expect(chainInSelector).toBeVisible();
  await expect(chainOutSelector).toBeVisible();
  await expect(mempoolInSelector).toBeVisible();
  await expect(mempoolOutSelector).toBeVisible();

  // Log current values before verification
  console.log("Current values:");
  console.log("Chain-in:", await chainInSelector.textContent());
  console.log("Chain-out:", await chainOutSelector.textContent());
  console.log("Mempool-in:", await mempoolInSelector.textContent());
  console.log("Mempool-out:", await mempoolOutSelector.textContent());

  // Then verify all balance values match expected values
  if (expectedBalances.chain_in) {
    console.log(`Verifying chain-in matches ${expectedBalances.chain_in}`);
    await expect(chainInSelector).toHaveText(expectedBalances.chain_in);
  }
  if (expectedBalances.chain_out) {
    console.log(`Verifying chain-out matches ${expectedBalances.chain_out}`);
    await expect(chainOutSelector).toHaveText(expectedBalances.chain_out);
  }
  if (expectedBalances.mempool_in) {
    console.log(`Verifying mempool-in matches ${expectedBalances.mempool_in}`);
    await expect(mempoolInSelector).toHaveText(expectedBalances.mempool_in);
  }
  if (expectedBalances.mempool_out) {
    console.log(
      `Verifying mempool-out matches ${expectedBalances.mempool_out}`
    );
    await expect(mempoolOutSelector).toHaveText(expectedBalances.mempool_out);
  }
};
