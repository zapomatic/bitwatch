import memory from "../lib/memory.js";
import logger, { getMonitorLog } from "../lib/logger.js";
import { deriveExtendedKeyAddresses } from "../lib/deriveExtendedKeyAddresses.js";
import editExtendedKey from "./editExtendedKey.js";
import enqueue from "../lib/queue/enqueue.js";

export default async ({ data, io }) => {
  // Debug log incoming data (excluding io property)
  const debugData = { ...data };
  delete debugData.io; // Remove the Socket.IO instance
  logger.info(`Incoming extended key data: ${JSON.stringify(debugData)}`);

  // Validate required fields
  const requiredFields = ["collectionName", "name", "key", "derivationPath"];
  const missingFields = requiredFields.filter((field) => !data[field]);

  if (missingFields.length > 0) {
    logger.error(`Missing required fields: ${missingFields.join(", ")}`);
    return { error: `Missing required fields: ${missingFields.join(", ")}` };
  }

  logger.info(
    `Adding extended key ${data.collectionName}/${data.name} as ${
      data.key
    }, path: ${data.derivationPath}, gap: ${data.gapLimit}, skip: ${
      data.skip
    }, initial: ${data.initialAddresses}, ${getMonitorLog(data.monitor)}`
  );

  // Create collection if it doesn't exist
  if (!memory.db.collections[data.collectionName]) {
    memory.db.collections[data.collectionName] = {
      addresses: [],
      extendedKeys: [],
      descriptors: [],
    };
  }

  // Check if extended key already exists
  const collection = memory.db.collections[data.collectionName];
  if (!collection.extendedKeys) {
    collection.extendedKeys = [];
  }
  const existingKey = collection.extendedKeys.find(
    (k) => k.name === data.name || k.key === data.key
  );

  if (existingKey) {
    logger.info("Extended key already exists, editing instead");
    return editExtendedKey({ data, io });
  }

  // Set default values if not provided
  const key = {
    ...data,
    addresses: [],
    // Use provided monitor settings or get from database
    monitor: { ...data.monitor },
  };

  // Derive initial addresses
  const addresses = await deriveExtendedKeyAddresses({
    key: key.key,
    skip: key.skip,
    startIndex: 0,
    count: key.initialAddresses,
    derivationPath: key.derivationPath,
  });

  if (!addresses) {
    logger.error("Failed to derive addresses");
    return { error: "Failed to derive addresses" };
  }

  // Add monitor settings to each address
  key.addresses = addresses.map((address, index) => {
    const addr = {
      ...address,
      name: `${key.name} ${address.index}`,
      index: address.index,
      expect: {
        chain_in: 0,
        chain_out: 0,
        mempool_in: 0,
        mempool_out: 0,
      },
      monitor: {
        ...key.monitor,
      },
    };
    // Debug log the address object
    logger.debug(
      `Address ${index + 1} structure:`,
      JSON.stringify(addr, null, 2)
    );
    return addr;
  });

  // Debug log the key object before adding to collection
  const debugKey = { ...key };
  delete debugKey.io; // Remove any Socket.IO instance
  logger.debug(`Extended key structure:`, JSON.stringify(debugKey, null, 2));

  // Add extended key to collection
  collection.extendedKeys.push(key);

  // Enqueue addresses for balance checking
  enqueue({
    collectionName: data.collectionName,
    extendedKeyName: data.name,
  });

  // Debug log the collection before saving
  // const debugCollection = {
  //   name: collection.name,
  //   addresses: collection.addresses,
  //   extendedKeys: collection.extendedKeys.map((k) => ({
  //     name: k.name,
  //     key: k.key,
  //     derivationPath: k.derivationPath,
  //     gapLimit: k.gapLimit,
  //     skip: k.skip,
  //     initialAddresses: k.initialAddresses,
  //     monitor: k.monitor,
  //     addresses: k.addresses,
  //   })),
  //   descriptors: collection.descriptors,
  // };
  // logger.debug(
  //   `Collection structure:`,
  //   JSON.stringify(debugCollection, null, 2)
  // );

  const saveResult = memory.saveDb();
  if (!saveResult) {
    logger.error("Failed to save extended key");
    return { error: "Failed to save extended key" };
  }

  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
