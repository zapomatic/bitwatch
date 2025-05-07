import memory from "../memory.js";
import logger from "../logger.js";

export const add = async ({ data, io }) => {
  logger.info(
    `Adding ${data.name || "collection"} to ${data.collection || "root"}`
  );

  // Handle adding a collection
  if (data.collection && !data.name && !data.address) {
    if (memory.db.collections[data.collection]) {
      logger.error("Collection already exists");
      return { error: "Collection already exists" };
    }

    memory.db.collections[data.collection] = {
      addresses: [],
      extendedKeys: [],
      descriptors: [],
    };

    const saveResult = memory.saveDb();
    if (!saveResult) {
      logger.error("Failed to save collection");
      return { error: "Failed to save collection" };
    }

    io.emit("updateState", { collections: memory.db.collections });
    return { success: true };
  }

  // Handle adding an address
  if (data.collection && data.name && data.address) {
    const collection = memory.db.collections[data.collection];
    if (!collection) {
      logger.error("Collection not found");
      return { error: "Collection not found" };
    }

    // Check if address already exists
    if (collection.addresses.some((addr) => addr.address === data.address)) {
      logger.error("Address already exists in this collection");
      return { error: "Address already exists in this collection" };
    }

    // Add the new address
    collection.addresses.push({
      address: data.address,
      name: data.name,
      expect: {
        chain_in: 0,
        chain_out: 0,
        mempool_in: 0,
        mempool_out: 0,
      },
      monitor: data.monitor || memory.db.monitor,
      actual: null,
      error: false,
      errorMessage: null,
    });

    const saveResult = memory.saveDb();
    if (!saveResult) {
      logger.error("Failed to save address");
      return { error: "Failed to save address" };
    }

    io.emit("updateState", { collections: memory.db.collections });
    return { success: true, record: true };
  }

  logger.error("Invalid request");
  return { error: "Invalid request" };
};
