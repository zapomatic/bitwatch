import memory from "../lib/memory.js";
import logger from "../lib/logger.js";

export default async ({ data, io }) => {
  logger.info(`Adding collection: ${data.collection}`);

  if (memory.db.collections[data.collection]) {
    logger.error("Collection already exists");
    return { error: "Collection already exists" };
  }

  memory.db.collections[data.collection] = {
    addresses: data.addresses || [],
    extendedKeys: data.extendedKeys || [],
    descriptors: data.descriptors || [],
  };

  const saveResult = memory.saveDb();
  if (!saveResult) {
    logger.error("Failed to save collection");
    return { error: "Failed to save collection" };
  }

  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
