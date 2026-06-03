import memory from "../lib/memory.js";
import logger, { getMonitorLog } from "../lib/logger.js";
import { deriveAddresses, deriveAddress } from "../lib/descriptors.js";
import { descriptorExtractPaths } from "../lib/descriptorExtractPaths.js";
import enqueue from "../lib/queue/enqueue.js";

export default async ({ data, io }) => {
  logger.info(
    `Adding descriptor ${data.collectionName}/${data.name} as ${
      data.descriptor
    }, gap: ${data.gapLimit}, skip: ${data.skip}, initial: ${
      data.initialAddresses
    }, monitor:${getMonitorLog(data.monitor)}`
  );

  if (!data.collectionName || !data.name || !data.descriptor) {
    logger.error("Missing required fields");
    return { error: "Missing required fields" };
  }

  // Create collection if it doesn't exist
  if (!memory.db.collections[data.collectionName]) {
    memory.db.collections[data.collectionName] = {
      addresses: [],
      extendedKeys: [],
      descriptors: [],
    };
  }

  // Check if descriptor already exists
  const collection = memory.db.collections[data.collectionName];
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
  try {
    deriveAddress(data.descriptor, 0);
  } catch (error) {
    logger.error(`Invalid descriptor: ${error.message}`);
    return { error: `Invalid descriptor: ${error.message}` };
  }

  // If the descriptor is just an extended key, wrap it in the appropriate format
  let descriptor = data.descriptor;
  if (descriptor.match(/^[xyz]pub/i)) {
    const keyType = descriptor.toLowerCase().slice(0, 4);
    switch (keyType) {
      case "xpub":
        descriptor = `pkh(${descriptor}/0/*)`;
        break;
      case "ypub":
        descriptor = `sh(wpkh(${descriptor}/0/*))`;
        break;
      case "zpub":
        descriptor = `wpkh(${descriptor}/0/*)`;
        break;
      case "vpub":
        descriptor = `tr(${descriptor}/0/*)`;
        break;
    }
    logger.info(`Wrapped extended key in descriptor format: ${descriptor}`);
  }

  // Get all addresses in one batch
  const allAddressesResult = await deriveAddresses(
    descriptor,
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

  // Enqueue addresses for balance checking
  enqueue({
    collectionName: data.collectionName,
    descriptorName: data.name,
  });

  memory.saveDb();
  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
