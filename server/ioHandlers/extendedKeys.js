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

  // Set default values if not provided
  const key = {
    ...data,
    derivationPath: data.derivationPath || "m/0",
    gapLimit: data.gapLimit || 10,
    skip: data.skip || 0,
    initialAddresses: data.initialAddresses || 10,
    addresses: [],
    // Use provided monitor settings or get from database
    monitor: data.monitor ||
      memory.db.monitor || {
        chain_in: "auto-accept",
        chain_out: "alert",
        mempool_in: "auto-accept",
        mempool_out: "alert",
      },
  };

  // Derive initial addresses
  const addresses = await deriveExtendedKeyAddresses(
    { key: key.key, skip: key.skip || 0 },
    0,
    key.initialAddresses || 10,
    key.derivationPath
  );

  if (!addresses) {
    logger.error("Failed to derive addresses");
    return { error: "Failed to derive addresses" };
  }

  // Add monitor settings to each address
  key.addresses = addresses.map((address, index) => ({
    ...address,
    name: `${key.name} ${index + 1}`,
    index: index + 1,
    expect: {
      chain_in: 0,
      chain_out: 0,
      mempool_in: 0,
      mempool_out: 0,
    },
    // Use the extended key's monitor settings
    monitor: key.monitor,
  }));

  // Add extended key to collection
  collection.extendedKeys.push(key);

  const saveResult = memory.saveDb();
  if (!saveResult) {
    logger.error("Failed to save extended key");
    return { error: "Failed to save extended key" };
  }

  data.io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
