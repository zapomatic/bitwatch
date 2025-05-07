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

export const saveConfig = async ({ data }) => {
  if (
    !data?.api ||
    !data?.interval ||
    !data?.apiDelay ||
    data?.apiParallelLimit === undefined
  ) {
    logger.error("Missing required config fields");
    return { error: "Missing required config fields" };
  }

  logger.info(
    `Saving config ${data.api} at ${data.interval}ms, delay ${data.apiDelay}ms, parallel ${data.apiParallelLimit}, debug=${data.debugLogging}`
  );

  memory.db.interval = data.interval;
  memory.db.api = data.api;
  memory.db.apiDelay = data.apiDelay;
  memory.db.apiParallelLimit = data.apiParallelLimit;
  memory.db.debugLogging = data.debugLogging;
  memory.db.monitor = data.monitor;

  // Update all addresses if requested
  if (data.updateAllAddresses && data.monitor) {
    logger.info("Updating all addresses with new monitor settings");

    // Iterate through all collections
    Object.values(memory.db.collections || {}).forEach((collection) => {
      // Update single addresses
      (collection.addresses || []).forEach((address) => {
        address.monitor = { ...data.monitor };
      });

      // Update extended key defaults and their addresses
      (collection.extendedKeys || []).forEach((key) => {
        key.monitor = { ...data.monitor };
        (key.addresses || []).forEach((address) => {
          address.monitor = { ...data.monitor };
        });
      });

      // Update descriptor defaults and their addresses
      (collection.descriptors || []).forEach((descriptor) => {
        descriptor.monitor = { ...data.monitor };
        (descriptor.addresses || []).forEach((address) => {
          address.monitor = { ...data.monitor };
        });
      });
    });
  }

  const saveResult = memory.saveDb();
  if (!saveResult) {
    logger.error("Failed to save config");
    return { error: "Failed to save config" };
  }

  return { success: true };
};
