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
    ...data,
    addresses: [],
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
    name: `${desc.name} ${index}`,
    index: index,
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
