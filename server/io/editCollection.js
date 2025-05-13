import memory from "../memory.js";
import logger from "../logger.js";

export default async ({ data, io }) => {
  const { oldName, newName } = data;
  logger.info(`Renaming collection from ${oldName} to ${newName}`);

  if (!oldName || !newName) {
    logger.error("Missing oldName or newName");
    return { error: "Missing oldName or newName" };
  }

  // Check if old collection exists
  if (!memory.db.collections[oldName]) {
    logger.error("Collection not found");
    return { error: "Collection not found" };
  }

  // Check if new name already exists
  if (memory.db.collections[newName]) {
    logger.error("Collection with new name already exists");
    return { error: "Collection with new name already exists" };
  }

  // Rename the collection
  memory.db.collections[newName] = memory.db.collections[oldName];
  delete memory.db.collections[oldName];

  const saveResult = memory.saveDb();
  if (!saveResult) {
    logger.error("Failed to save collection rename");
    return { error: "Failed to save collection rename" };
  }

  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
