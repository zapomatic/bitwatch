import memory from "../memory.js";
import logger from "../logger.js";
import { deriveExtendedKeyAddresses } from "../addressDeriver.js";

export const addExtendedKey = async (data) => {
  if (!data.collection || !data.name || !data.key) {
    logger.error("Missing required fields");
    return { error: "Missing required fields" };
  }

  logger.info(
    `Adding extended key ${data.name} to collection ${data.collection}`
  );

  // Create collection if it doesn't exist
  if (!memory.db.collections[data.collection]) {
    memory.db.collections[data.collection] = {
      addresses: [],
      extendedKeys: [],
      descriptors: [],
    };
  }

  // Check if extended key already exists
  const collection = memory.db.collections[data.collection];
  if (
    collection.extendedKeys.some(
      (k) => k.name === data.name || k.key === data.key
    )
  ) {
    logger.error("Extended key with this name or key already exists");
    return { error: "Extended key with this name or key already exists" };
  }

  // Derive initial addresses
  const addresses = await deriveExtendedKeyAddresses(
    { key: data.key, skip: data.skip || 0 },
    0,
    data.initialAddresses || 5,
    data.derivationPath
  );

  if (!addresses) {
    logger.error("Failed to derive addresses");
    return { error: "Failed to derive addresses" };
  }

  // Add extended key to collection
  collection.extendedKeys.push({
    name: data.name,
    key: data.key,
    derivationPath: data.derivationPath,
    gapLimit: data.gapLimit || 2,
    initialAddresses: data.initialAddresses || 5,
    skip: data.skip || 0,
    addresses: addresses.map((addr) => ({
      address: addr.address,
      name: `${data.name} ${addr.index}`,
      index: addr.index,
      expect: {
        chain_in: 0,
        chain_out: 0,
        mempool_in: 0,
        mempool_out: 0,
      },
      monitor: {
        chain_in: "auto-accept",
        chain_out: "alert",
        mempool_in: "auto-accept",
        mempool_out: "alert",
      },
      actual: null,
      error: false,
      errorMessage: null,
    })),
  });

  const saveResult = memory.saveDb();
  if (!saveResult) {
    logger.error("Failed to save extended key");
    return { error: "Failed to save extended key" };
  }

  data.io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
