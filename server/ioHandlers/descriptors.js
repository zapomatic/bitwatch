import memory from "../memory.js";
import logger from "../logger.js";
import { deriveAddresses, validateDescriptor } from "../descriptors.js";

export const addDescriptor = async ({ data, io }) => {
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

  // Set default values if not provided
  const desc = {
    name: data.name,
    descriptor: data.descriptor,
    derivationPath: data.derivationPath || "m/0",
    gapLimit: data.gapLimit || 2,
    skip: data.skip || 0,
    initialAddresses: data.initialAddresses || 5,
    addresses: [],
    // Use provided monitor settings or get from database
    monitor: { ...data.monitor },
  };

  // Derive initial addresses
  const addresses = deriveAddresses(
    desc.descriptor,
    desc.derivationPath,
    desc.skip,
    desc.initialAddresses
  );

  // Add monitor settings to each address
  desc.addresses = addresses.map((address, index) => ({
    ...address,
    name: `${desc.name} ${index + 1}`,
    index: index + 1,
    expect: {
      chain_in: 0,
      chain_out: 0,
      mempool_in: 0,
      mempool_out: 0,
    },
    monitor: {
      ...desc.monitor,
    },
  }));

  // Add the descriptor to the collection
  if (!collection.descriptors) {
    collection.descriptors = [];
  }
  collection.descriptors.push(desc);

  memory.saveDb();
  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};

export const editDescriptor = async ({ data, io }) => {
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

  // Get existing monitor settings or use system defaults
  const existingDescriptor = collection.descriptors[data.descriptorIndex];
  const monitor =
    data.monitor || existingDescriptor.monitor || memory.db.monitor;

  // Update the descriptor
  collection.descriptors[data.descriptorIndex] = {
    ...existingDescriptor,
    descriptor: data.descriptor,
    gapLimit: data.gapLimit,
    name: data.name,
    skip: data.skip || 0,
    initialAddresses: data.initialAddresses || 5,
    monitor: {
      ...monitor,
    },
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
      monitor: { ...monitor },
      actual: null,
      error: false,
      errorMessage: null,
    })),
  };

  memory.saveDb();
  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
