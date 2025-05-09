import memory from "../memory.js";
import logger, { getMonitorLog } from "../logger.js";
import { deriveAddresses, validateDescriptor } from "../descriptors.js";
import { descriptorExtractPaths } from "../descriptorExtractPaths.js";
export const addDescriptor = async ({ data, io }) => {
  if (!data.collection || !data.name || !data.descriptor) {
    logger.error("Missing required fields");
    return { error: "Missing required fields" };
  }

  logger.info(
    `Adding descriptor ${data.collection}/${data.name}, gap: ${
      data.gapLimit
    }, skip: ${data.skip}, initial: ${data.initialAddresses}, ${getMonitorLog(
      data.monitor
    )}`
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

  // Ensure descriptors array exists
  const collection = memory.db.collections[data.collection];
  if (!collection.descriptors) {
    collection.descriptors = [];
  }

  // Check if descriptor already exists
  if (collection.descriptors.some((d) => d.name === data.name)) {
    logger.error("Descriptor with this name already exists");
    return { error: "Descriptor with this name already exists" };
  }

  // Set default values if not provided
  const desc = {
    ...data,
    derivationPath: descriptorExtractPaths(data.descriptor),
    addresses: [],
  };

  // Derive initial addresses
  const addresses = deriveAddresses(
    desc.descriptor,
    0, // startIndex
    desc.initialAddresses || 5, // count
    desc.skip || 0 // skip
  );

  // Add monitor settings to each address
  desc.addresses = addresses.map((address) => ({
    ...address,
    name: `${desc.name} ${address.index}`,
    index: address.index,
    expect: {
      chain_in: 0,
      chain_out: 0,
      mempool_in: 0,
      mempool_out: 0,
    },
    monitor: {
      ...desc.monitor,
    },
    actual: null,
    error: false,
    errorMessage: null,
  }));

  // Add the descriptor to the collection
  collection.descriptors.push(desc);

  // Save the database
  memory.saveDb();

  // Emit the updated state
  io.emit("updateState", { collections: memory.db.collections });

  return { success: true };
};
