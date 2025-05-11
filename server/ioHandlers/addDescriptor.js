import memory from "../memory.js";
import logger, { getMonitorLog } from "../logger.js";
import { deriveAddresses, deriveAddress } from "../descriptors.js";
import { descriptorExtractPaths } from "../descriptorExtractPaths.js";

export const addDescriptor = async ({ data, io }) => {
  logger.info(
    `Adding descriptor ${data.collection}/${data.name} as ${
      data.descriptor
    }, gap: ${data.gapLimit}, skip: ${data.skip}, initial: ${
      data.initialAddresses
    }, monitor:${getMonitorLog(data.monitor)}`
  );

  if (!data.collection || !data.name || !data.descriptor) {
    logger.error("Missing required fields");
    return { error: "Missing required fields" };
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
  // upgrade old db versions
  if (!collection.descriptors) {
    collection.descriptors = [];
  }
  if (
    collection.descriptors.some(
      (d) => d.name === data.name || d.descriptor === data.descriptor
    )
  ) {
    logger.error("Descriptor with this name or key already exists");
    return { error: "Descriptor with this name or key already exists" };
  }

  // Validate by trying to derive the first address
  const testAddress = deriveAddress(data.descriptor, 0);
  if (!testAddress) {
    logger.error(`Invalid descriptor: Could not derive address`);
    return { error: "Invalid descriptor: Could not derive address" };
  }

  // Get all addresses in one batch
  const allAddressesResult = await deriveAddresses(
    data.descriptor,
    0,
    data.initialAddresses || 5,
    data.skip || 0
  );

  if (!allAddressesResult.success) {
    logger.error(`Failed to derive addresses: ${allAddressesResult.error}`);
    return { error: allAddressesResult.error };
  }

  // Create descriptor object
  const desc = {
    name: data.name,
    descriptor: data.descriptor,
    derivationPath: descriptorExtractPaths(data.descriptor),
    gapLimit: data.gapLimit || 2,
    skip: data.skip || 0,
    initialAddresses: data.initialAddresses || 5,
    monitor: { ...data.monitor },
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
      monitor: { ...data.monitor },
      actual: null,
      error: false,
      errorMessage: null,
    })),
  };

  // Add descriptor to collection
  collection.descriptors.push(desc);

  memory.saveDb();
  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
