import memory from "../memory.js";
import logger, { getMonitorLog } from "../logger.js";

export default async ({ data, io }) => {
  logger.info(
    `Adding address ${data.collection}/${data.name}, ${
      data.address
    }, ${getMonitorLog(data.monitor)}, ${
      data.trackWebsocket ? "trackWebsocket" : "no trackWebsocket"
    }`
  );

  if (!memory.db.collections[data.collection]) {
    memory.db.collections[data.collection] = {
      addresses: [],
      extendedKeys: [],
      descriptors: [],
    };
  }
  const collection = memory.db.collections[data.collection];
  if (!collection) {
    logger.error("Collection not found");
    return { error: "Collection not found" };
  }

  // Check if address already exists
  if (collection.addresses.some((addr) => addr.address === data.address)) {
    logger.error("Address already exists in this collection");
    return { error: "Address already exists in this collection" };
  }

  // Add the new address
  collection.addresses.push({
    address: data.address,
    name: data.name,
    expect: {
      chain_in: data.expect?.chain_in || 0,
      chain_out: data.expect?.chain_out || 0,
      mempool_in: data.expect?.mempool_in || 0,
      mempool_out: data.expect?.mempool_out || 0,
    },
    monitor: { ...(data.monitor || memory.db.monitor) },
    trackWebsocket: data.trackWebsocket || false,
    actual: null,
    error: false,
    errorMessage: null,
  });

  const saveResult = memory.saveDb();
  if (!saveResult) {
    logger.error("Failed to save address");
    return { error: "Failed to save address" };
  }

  io.emit("updateState", { collections: memory.db.collections });
  return { success: true, record: true };
};
