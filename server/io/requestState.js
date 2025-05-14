import memory from "../lib/memory.js";
import logger from "../lib/logger.js";
import queue from "../lib/queue/index.js";

export default async ({ socketID, io }) => {
  logger.info(`Client ${socketID} requested state update`);

  // Emit the current state to the requesting client
  io.to(socketID).emit("updateState", {
    collections: memory.db.collections,
    monitor: memory.db.monitor,
    queue,
  });

  return { success: true };
};
