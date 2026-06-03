import memory from "../lib/memory.js";
import logger from "../lib/logger.js";

export default async ({ data, io }) => {
  const { oldName, newName = oldName, notify } = data;
  logger.info(
    `editCollection ${oldName}${
      newName !== oldName ? ` -> ${newName}` : ""
    }${notify !== undefined ? ` notify chatId: ${notify?.chatId || "(cleared)"}` : ""}`
  );

  if (!oldName) {
    logger.error("editCollection: Missing oldName");
    return { error: "Missing oldName" };
  }

  // Check if old collection exists
  if (!memory.db.collections[oldName]) {
    logger.error("editCollection: Collection not found");
    return { error: "Collection not found" };
  }

  // Rename only when the name actually changes
  if (newName !== oldName) {
    if (memory.db.collections[newName]) {
      logger.error("editCollection: Collection with new name already exists");
      return { error: "Collection with new name already exists" };
    }
    memory.db.collections[newName] = memory.db.collections[oldName];
    delete memory.db.collections[oldName];
  }

  // Apply a notification chat ID override when provided (blank clears it)
  if (notify !== undefined) {
    const collection = memory.db.collections[newName];
    if (notify?.chatId) {
      collection.notify = { chatId: notify.chatId };
    } else {
      delete collection.notify;
    }
  }

  const saveResult = memory.saveDb();
  if (!saveResult) {
    logger.error("Failed to save collection changes");
    return { error: "Failed to save collection changes" };
  }

  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
