import memory from "../memory.js";
import logger from "../logger.js";

export const requestState = async (data) => {
  logger.info(`Client ${data.socketID} requested state update`);

  // Emit the current state to the requesting client
  data.io.to(data.socketID).emit("updateState", {
    collections: memory.db.collections,
  });

  return { success: true };
};
