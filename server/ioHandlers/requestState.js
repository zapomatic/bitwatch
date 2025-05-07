import memory from "../memory.js";
import logger from "../logger.js";

export const requestState = async ({ socketID, io }) => {
  logger.info(`Client ${socketID} requested state update`);

  // Emit the current state to the requesting client
  io.to(socketID).emit("updateState", {
    collections: memory.db.collections,
    monitor: memory.db.monitor,
  });

  return { success: true };
};
