import memory from "../memory.js";
import logger from "../logger.js";
import { deriveExtendedKeyAddresses } from "../deriveExtendedKeyAddresses.js";

export const editExtendedKey = async ({ data, io }) => {
  if (
    !data.collection ||
    !data.name ||
    !data.key ||
    data.keyIndex === undefined
  ) {
    logger.error("Missing required fields");
    return { error: "Missing required fields" };
  }

  const collection = memory.db.collections[data.collection];
  if (!collection || !collection.extendedKeys[data.keyIndex]) {
    logger.error("Extended key not found");
    return { error: "Extended key not found" };
  }

  // Check if another extended key with the same name exists (excluding the current one)
  const nameExists = collection.extendedKeys.some(
    (k, i) => i !== data.keyIndex && k.name === data.name
  );
  if (nameExists) {
    logger.error("Another extended key with this name already exists");
    return { error: "Another extended key with this name already exists" };
  }

  // Get all addresses in one batch
  const allAddressesResult = await deriveExtendedKeyAddresses(
    data.key,
    0,
    data.initialAddresses || 5,
    data.skip || 0
  );

  if (!allAddressesResult.success) {
    logger.error(allAddressesResult.error || "Failed to derive addresses");
    return { error: allAddressesResult.error || "Failed to derive addresses" };
  }

  // Get existing monitor settings or use system defaults
  const existingKey = collection.extendedKeys[data.keyIndex];
  const monitor = data.monitor || existingKey.monitor || memory.db.monitor;

  // Update the extended key
  collection.extendedKeys[data.keyIndex] = {
    ...existingKey,
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
