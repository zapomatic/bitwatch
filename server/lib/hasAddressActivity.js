export default (addr) => {
  if (!addr?.actual) return false;
  return (
    addr.actual.chain_in > 0 ||
    addr.actual.chain_out > 0 ||
    addr.actual.mempool_in > 0 ||
    addr.actual.mempool_out > 0
  );
};
