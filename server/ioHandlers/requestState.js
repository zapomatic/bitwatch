import memory from "../memory.js";
import logger from "../logger.js";
import { getQueueStatus } from "../balanceQueue.js";

export const requestState = async ({ socketID, io }) => {
  logger.info(`Client ${socketID} requested state update`);

  // Get current queue status
  const queueStatus = getQueueStatus();

  // Emit the current state to the requesting client
  io.to(socketID).emit("updateState", {
    collections: memory.db.collections,
    monitor: memory.db.monitor,
    queueStatus,
  });

  return { success: true };
};
