import memory from "../lib/memory.js";
import logger from "../lib/logger.js";
import { getQueueStatus } from "../lib/balanceQueue.js";

export default async ({ socketID, io }) => {
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
