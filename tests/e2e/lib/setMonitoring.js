export default async (page, monitor) => {
  if (!monitor) return;
  // Chain In monitoring
  const chainInSelect = page.getByTestId("address-monitor-chain-in");
  await chainInSelect.click();
  await page
    .getByTestId(`address-monitor-chain-in-${monitor.chain_in}`)
    .click();

  // Chain Out monitoring
  const chainOutSelect = page.getByTestId("address-monitor-chain-out");
  await chainOutSelect.click();
  await page
    .getByTestId(`address-monitor-chain-out-${monitor.chain_out}`)
    .click();

  // Mempool In monitoring
  const mempoolInSelect = page.getByTestId("address-monitor-mempool-in");
  await mempoolInSelect.click();
  await page
    .getByTestId(`address-monitor-mempool-in-${monitor.mempool_in}`)
    .click();

  // Mempool Out monitoring
  const mempoolOutSelect = page.getByTestId("address-monitor-mempool-out");
  await mempoolOutSelect.click();
  await page
    .getByTestId(`address-monitor-mempool-out-${monitor.mempool_out}`)
    .click();
};
