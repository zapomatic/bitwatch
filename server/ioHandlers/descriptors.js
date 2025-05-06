import memory from "../memory.js";
import logger from "../logger.js";
import { deriveAddresses, validateDescriptor } from "../descriptors.js";

export const addDescriptor = async (data) => {
  if (!data.collection || !data.name || !data.descriptor) {
    logger.error("Missing required fields");
    return { error: "Missing required fields" };
  }

  logger.info(
    `Adding descriptor ${data.name} to collection ${data.collection}`
  );

  // Validate descriptor
  const validation = validateDescriptor(data.descriptor);
  if (!validation.success) {
    logger.error(validation.error);
    return { error: validation.error };
  }

  // Create collection if it doesn't exist
  if (!memory.db.collections[data.collection]) {
    memory.db.collections[data.collection] = {
      addresses: [],
      extendedKeys: [],
      descriptors: [],
    };
  }

  // Check if descriptor already exists
  const collection = memory.db.collections[data.collection];
  if (collection.descriptors.some((d) => d.name === data.name)) {
    logger.error("Descriptor with this name already exists");
    return { error: "Descriptor with this name already exists" };
  }

  // Derive addresses
  const result = await deriveAddresses(
    data.descriptor,
    0, // start from index 0
    data.initialAddresses || 10, // number of addresses to derive
    data.skip || 0 // skip value
  );
  if (!result.success) {
    logger.error(result.error || "Failed to derive addresses");
    return { error: result.error || "Failed to derive addresses" };
  }

  // Add descriptor to collection
  collection.descriptors.push({
    name: data.name,
    descriptor: data.descriptor,
    gapLimit: data.gapLimit || 2,
    skip: data.skip || 0,
    initialAddresses: data.initialAddresses || 10,
    addresses: result.data.map((addr) => ({
      address: addr.address,
      name: `${data.name} ${addr.index}`,
      index: addr.index,
      expect: {
        chain_in: 0,
        chain_out: 0,
        mempool_in: 0,
        mempool_out: 0,
      },
      monitor: {
        chain_in: "auto-accept",
        chain_out: "alert",
        mempool_in: "auto-accept",
        mempool_out: "alert",
      },
      actual: null,
      error: false,
      errorMessage: null,
    })),
  });

  memory.saveDb();
  data.io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};

export const editDescriptor = async (data) => {
  if (
    !data.collection ||
    !data.name ||
    !data.descriptor ||
    data.descriptorIndex === undefined
  ) {
    logger.error("Missing required fields");
    return { error: "Missing required fields" };
  }

  const collection = memory.db.collections[data.collection];
  if (!collection || !collection.descriptors[data.descriptorIndex]) {
    logger.error("Descriptor not found");
    return { error: "Descriptor not found" };
  }

  // Get all addresses in one batch
  const allAddressesResult = await deriveAddresses(
    data.descriptor,
    0,
    parseInt(data.initialAddresses) || 10,
    parseInt(data.skip) || 0
  );

  if (!allAddressesResult.success) {
    logger.error(allAddressesResult.error || "Failed to derive addresses");
    return { error: allAddressesResult.error || "Failed to derive addresses" };
  }

  // Update the descriptor
  collection.descriptors[data.descriptorIndex] = {
    ...collection.descriptors[data.descriptorIndex],
    descriptor: data.descriptor,
    gapLimit: data.gapLimit,
    name: data.name,
    skip: data.skip || 0,
    initialAddresses: data.initialAddresses || 5,
    addresses: allAddressesResult.data.map((addr) => ({
      address: addr.address,
      name: `${data.name} ${addr.index}`,
      index: addr.index,
      expect: {
        chain_in: 0,
        chain_out: 0,
        mempool_in: 0,
        mempool_out: 0,
      },
      monitor: {
        chain_in: "auto-accept",
        chain_out: "alert",
        mempool_in: "auto-accept",
        mempool_out: "alert",
      },
      actual: null,
      error: false,
      errorMessage: null,
    })),
  };

  memory.saveDb();
  data.io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
