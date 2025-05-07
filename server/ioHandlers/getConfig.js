import memory from "../memory.js";
import logger from "../logger.js";

export const getConfig = async () => {
  logger.info("Getting config");
  return {
    interval: memory.db.interval,
    api: memory.db.api,
    apiDelay: memory.db.apiDelay,
    apiParallelLimit: memory.db.apiParallelLimit,
    debugLogging: memory.db.debugLogging,
    monitor: memory.db.monitor,
  };
};
