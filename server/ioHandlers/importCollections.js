import memory from "../memory.js";
import logger from "../logger.js";

export const importCollections = async ({ data, io }) => {
  logger.info("Importing collections");

  if (!data.collections || typeof data.collections !== "object") {
    logger.error("Invalid collections data");
    return { error: "Invalid collections data" };
  }

  // Validate the structure of each collection
  for (const [name, collection] of Object.entries(data.collections)) {
    if (!collection.addresses || !Array.isArray(collection.addresses)) {
      logger.error(`Invalid collection structure for ${name}`);
      return { error: `Invalid collection structure for ${name}` };
    }

    // Validate each address in the collection
    for (const addr of collection.addresses) {
      if (!addr.address || !addr.name || !addr.expect) {
        logger.error(`Invalid address structure in collection ${name}`);
        return { error: `Invalid address structure in collection ${name}` };
      }
    }

    // Validate extended keys if present
    if (collection.extendedKeys) {
      for (const extKey of collection.extendedKeys) {
        if (
          !extKey.key ||
          !extKey.name ||
          !extKey.derivationPath ||
          !extKey.addresses
        ) {
          logger.error(`Invalid extended key structure in collection ${name}`);
          return {
            error: `Invalid extended key structure in collection ${name}`,
          };
        }
      }
    }

    // Validate descriptors if present
    if (collection.descriptors) {
      for (const desc of collection.descriptors) {
        if (!desc.descriptor || !desc.name || !desc.addresses) {
          logger.error(`Invalid descriptor structure in collection ${name}`);
          return {
            error: `Invalid descriptor structure in collection ${name}`,
          };
        }
      }
    }
  }

  // Replace the existing collections with the imported ones
  memory.db.collections = data.collections;

  // Save to disk
  const saveResult = memory.saveDb();
  if (!saveResult) {
    logger.error("Failed to save imported collections");
    return { error: "Failed to save imported collections" };
  }

  // Emit the updated state to all clients
  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
