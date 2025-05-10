import { expect } from "../test-environment.js";

export default async (
  page,
  address,
  expectedBalances,
  index = 0,
  parentKey = null
) => {
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

  // Then verify all balance values match expected values
  if (expectedBalances.chain_in) {
    await expect(chainInSelector).toHaveText(expectedBalances.chain_in);
  }
  if (expectedBalances.chain_out) {
    await expect(chainOutSelector).toHaveText(expectedBalances.chain_out);
  }
  if (expectedBalances.mempool_in) {
    await expect(mempoolInSelector).toHaveText(expectedBalances.mempool_in);
  }
  if (expectedBalances.mempool_out) {
    await expect(mempoolOutSelector).toHaveText(expectedBalances.mempool_out);
  }
};
