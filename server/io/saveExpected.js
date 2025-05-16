import memory from "../lib/memory.js";
import logger from "../lib/logger.js";

export default async ({ data, io }) => {
  logger.processing(
    `Saving expected state for ${data.collectionName}/${data.address}`
  );
  const collection = memory.db.collections[data.collectionName];
  if (!collection) {
    logger.error("saveExpected: Collection not found");
    return { error: "Collection not found" };
  }

  // First check main addresses
  let record = collection.addresses.find((a) => a.address === data.address);

  // If not found, check extended keys
  if (!record && collection.extendedKeys) {
    for (const extendedKey of collection.extendedKeys) {
      record = extendedKey.addresses.find((a) => a.address === data.address);
      if (record) break;
    }
  }

  // If not found, check descriptors
  if (!record && collection.descriptors) {
    for (const descriptor of collection.descriptors) {
      record = descriptor.addresses.find((a) => a.address === data.address);
      if (record) break;
    }
  }

  if (!record) {
    logger.error("saveExpected: Address not found");
    return { error: "Address not found" };
  }

  // Update expect values while preserving the object structure
  // Use actual values if expect values aren't available
  record.expect = {
    chain_in: data.expect?.chain_in ?? data.actual?.chain_in ?? 0,
    chain_out: data.expect?.chain_out ?? data.actual?.chain_out ?? 0,
    mempool_in: data.expect?.mempool_in ?? data.actual?.mempool_in ?? 0,
    mempool_out: data.expect?.mempool_out ?? data.actual?.mempool_out ?? 0,
  };

  // Clear alerted state since user has acknowledged the current state
  record.alerted = {
    chain_in: false,
    chain_out: false,
    mempool_in: false,
    mempool_out: false,
  };

  memory.saveDb();
  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
