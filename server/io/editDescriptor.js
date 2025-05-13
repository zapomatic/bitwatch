import memory from "../lib/memory.js";
import logger, { getMonitorLog } from "../lib/logger.js";
import { deriveAddresses, deriveAddress } from "../lib/descriptors.js";
import { descriptorExtractPaths } from "../lib/descriptorExtractPaths.js";

export default async ({ data, io }) => {
  logger.info(
    `editDescriptor: ${data.collection}/${data.descriptor}, gap ${
      data.gapLimit
    }, initialAddresses ${data.initialAddresses}, skip ${
      data.skip
    } with ${getMonitorLog(data.monitor)}`
  );
  if (!data.collection || !data.name || !data.descriptor) {
    logger.error("editDescriptor: Missing required fields");
    return { error: "Missing required fields" };
  }

  const collection = memory.db.collections[data.collection];
  if (!collection) {
    logger.error("editDescriptor: Collection not found");
    return { error: "Collection not found" };
  }

  // Find descriptor by its descriptor string
  const descriptorIndex = collection.descriptors.findIndex(
    (d) => d.descriptor === data.descriptor
  );
  if (descriptorIndex === -1) {
    logger.error("editDescriptor: Descriptor not found");
    return { error: "Descriptor not found" };
  }

  // Get existing descriptor
  const existingDescriptor = collection.descriptors[descriptorIndex];

  // Only check for name conflicts if the name is actually changing
  if (data.name !== existingDescriptor.name) {
    const nameExists = collection.descriptors.some((d) => d.name === data.name);
    if (nameExists) {
      logger.error("Another descriptor with this name already exists");
      return { error: "Another descriptor with this name already exists" };
    }
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
    return { error: allAddressesResult.error || "Failed to derive addresses" };
  }

  // Get existing monitor settings or use system defaults
  const monitor =
    data.monitor || existingDescriptor.monitor || memory.db.monitor;

  // Update the descriptor
  collection.descriptors[descriptorIndex] = {
    ...existingDescriptor,
    ...data,
    derivationPath: descriptorExtractPaths(data.descriptor),
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
