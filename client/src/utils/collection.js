export const calculateCollectionTotals = (collection) => {
  const totals = {
    chain_in: 0,
    chain_out: 0,
    mempool_in: 0,
    mempool_out: 0,
    expect_chain_in: 0,
    expect_chain_out: 0,
    expect_mempool_in: 0,
    expect_mempool_out: 0,
    hasError: false,
    hasPending: false,
  };

  const allAddresses = [
    ...(collection.addresses || []),
    ...(collection.extendedKeys || []).flatMap((key) => key.addresses || []),
    ...(collection.descriptors || []).flatMap((desc) => desc.addresses || []),
  ];

  allAddresses.forEach((address) => {
    if (address.error) {
      totals.hasError = true;
    } else if (!address.actual) {
      totals.hasPending = true;
    } else {
      totals.chain_in += address.actual.chain_in || 0;
      totals.chain_out += address.actual.chain_out || 0;
      totals.mempool_in += address.actual.mempool_in || 0;
      totals.mempool_out += address.actual.mempool_out || 0;
      totals.expect_chain_in += address.expect?.chain_in || 0;
      totals.expect_chain_out += address.expect?.chain_out || 0;
      totals.expect_mempool_in += address.expect?.mempool_in || 0;
      totals.expect_mempool_out += address.expect?.mempool_out || 0;
    }
  });

  return totals;
};
