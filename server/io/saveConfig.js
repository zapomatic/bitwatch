import memory from "../lib/memory.js";
import logger, { getMonitorLog } from "../lib/logger.js";

export default async ({ data }) => {
  if (!data?.api || !data?.apiDelay || data?.apiParallelLimit === undefined) {
    logger.error("Missing required config fields");
    return { error: "Missing required config fields" };
  }

  logger.info(
    `Saving config ${data.api} at delay ${data.apiDelay}ms, parallel ${data.apiParallelLimit}, debug=${data.debugLogging}`
  );

  memory.db.api = data.api;
  memory.db.apiDelay = data.apiDelay;
  memory.db.apiParallelLimit = data.apiParallelLimit;
  memory.db.debugLogging = data.debugLogging;
  memory.db.monitor = data.monitor;

  // Update all addresses if requested
  if (data.updateAllAddresses && data.monitor) {
    logger.info(
      `Updating all addresses with new monitor settings: ${getMonitorLog(
        data.monitor
      )}`
    );

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
