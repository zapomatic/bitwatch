export default (addr) => {
  if (!addr?.actual && !addr?.expect) return false;

  // Check actual balances
  const hasActualActivity =
    addr.actual &&
    (addr.actual.chain_in > 0 ||
      addr.actual.chain_out > 0 ||
      addr.actual.mempool_in > 0 ||
      addr.actual.mempool_out > 0);

  // Check expected balances
  const hasExpectedActivity =
    addr.expect &&
    (addr.expect.chain_in > 0 ||
      addr.expect.chain_out > 0 ||
      addr.expect.mempool_in > 0 ||
      addr.expect.mempool_out > 0);

  return hasActualActivity || hasExpectedActivity;
};
