import memory from "../memory.js";
import logger from "../logger.js";
import { deriveAddresses } from "../descriptors.js";

export const editDescriptor = async ({ data, io }) => {
  if (
    !data.collection ||
    !data.name ||
    !data.descriptor ||
    data.descriptorIndex === undefined
  ) {
    logger.error("Missing required fields");
    return { error: "Missing required fields" };
  }

  const collection = memory.db.collections[data.collection];
  if (!collection || !collection.descriptors[data.descriptorIndex]) {
    logger.error("Descriptor not found");
    return { error: "Descriptor not found" };
  }

  // Get all addresses in one batch
  const allAddressesResult = await deriveAddresses(
    data.descriptor,
    0,
    data.initialAddresses,
    data.skip
  );

  if (!allAddressesResult.success) {
    logger.error(allAddressesResult.error || "Failed to derive addresses");
    return { error: allAddressesResult.error || "Failed to derive addresses" };
  }

  // Get existing monitor settings or use system defaults
  const existingDescriptor = collection.descriptors[data.descriptorIndex];
  const monitor =
    data.monitor || existingDescriptor.monitor || memory.db.monitor;

  // Update the descriptor
  collection.descriptors[data.descriptorIndex] = {
    ...existingDescriptor,
    ...data,
    monitor: {
      ...monitor,
    },
    addresses: allAddressesResult.data.map((addr) => ({
      address: addr.address,
      name: `${data.name} ${addr.index}`,
      index: addr.index,
      expect: {
        chain_in: 0,
        chain_out: 0,
        mempool_in: 0,
        mempool_out: 0,
      },
      monitor: { ...monitor },
      actual: null,
      error: false,
      errorMessage: null,
    })),
  };

  memory.saveDb();
  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
