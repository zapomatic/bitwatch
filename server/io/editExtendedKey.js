import memory from "../lib/memory.js";
import logger, { getMonitorLog } from "../lib/logger.js";
import { deriveExtendedKeyAddresses } from "../lib/deriveExtendedKeyAddresses.js";
import enqueue from "../lib/queue/enqueue.js";

export default async ({ data, io }) => {
  logger.info(
    `editExtendedKey: ${data.collectionName}/${data.name}, path: ${
      data.derivationPath
    }, gap: ${data.gapLimit}, initialAddresses ${data.initialAddresses}, skip ${
      data.skip
    } with ${getMonitorLog(data.monitor)}`
  );
  if (!data.collectionName || !data.name || !data.key) {
    logger.error("editExtendedKey: Missing required fields");
    return { error: "Missing required fields" };
  }

  const collection = memory.db.collections[data.collectionName];
  if (!collection) {
    logger.error("editExtendedKey: Collection not found");
    return { error: "Collection not found" };
  }

  // Find extended key by its key string
  const keyIndex = collection.extendedKeys.findIndex((k) => k.key === data.key);
  if (keyIndex === -1) {
    logger.error("editExtendedKey: Extended key not found");
    return { error: "Extended key not found" };
  }

  // Check if another extended key with the same name exists (excluding the current one)
  const nameExists = collection.extendedKeys.some(
    (k, i) => i !== keyIndex && k.name === data.name
  );
  if (nameExists) {
    logger.error("Another extended key with this name already exists");
    return { error: "Another extended key with this name already exists" };
  }

  // Get all addresses in one batch
  const addresses = await deriveExtendedKeyAddresses({
    key: data.key,
    skip: data.skip || 0,
    startIndex: 0,
    count: data.initialAddresses || 5,
    derivationPath: data.derivationPath,
  });

  if (!addresses) {
    logger.error("Failed to derive addresses");
    return { error: "Failed to derive addresses" };
  }

  // Get existing monitor settings or use system defaults
  const existingKey = collection.extendedKeys[keyIndex];
  const monitor = data.monitor || existingKey.monitor || memory.db.monitor;

  // Update the extended key
  collection.extendedKeys[keyIndex] = {
    ...existingKey,
    ...data,
    monitor: {
      ...monitor,
    },
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
      monitor: { ...monitor },
      actual: null,
      error: false,
      errorMessage: null,
    })),
  };

  // Enqueue addresses for balance checking
  enqueue({
    collectionName: data.collectionName,
    extendedKeyName: data.name,
  });

  memory.saveDb();
  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
