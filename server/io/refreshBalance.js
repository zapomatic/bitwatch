import enqueue from "../lib/queue/enqueue.js";
import logger from "../lib/logger.js";
import memory from "../lib/memory.js";

export default async ({ data }) => {
  const {
    testResponse,
    address,
    collectionName,
    descriptorName,
    extendedKeyName,
  } = data;
  // logger.debug(`refreshBalance: ${JSON.stringify(data)}`);
  if (address) {
    // just a single address
    logger.info(
      `refreshBalance: ${collectionName}/${
        descriptorName || extendedKeyName || "root"
      }/${address}, testResponse ${testResponse}`
    );
    enqueue({
      address,
      collectionName,
      descriptorName,
      extendedKeyName,
      testResponse,
    });
    return { success: true };
  }

  if (descriptorName && collectionName) {
    const collection = memory.db.collections[collectionName];
    const descriptorObj = collection?.descriptors?.find(
      (d) => d.name === descriptorName
    );
    if (!descriptorObj) {
      logger.error(
        `Descriptor ${descriptorName} not found in collection ${collectionName}`
      );
      return {
        success: false,
        error: `Descriptor ${descriptorName} not found in collection ${collectionName}`,
      };
    }
    // descriptor
    logger.info(
      `Adding ${descriptorObj.addresses.length} addresses to api queue in collection ${collectionName} in ${descriptorName}`
    );
    enqueue({
      collectionName,
      descriptorName,
      testResponse,
    });
    return { success: true };
  }

  if (extendedKeyName && collectionName) {
    const collection = memory.db.collections[collectionName];
    const extendedKeyObj = collection?.extendedKeys?.find(
      (k) => k.name === extendedKeyName
    );
    if (!extendedKeyObj) {
      logger.error(
        `Extended key ${extendedKeyName} not found in collection ${collectionName}`
      );
      return {
        success: false,
        error: `Extended key ${extendedKeyName} not found in collection ${collectionName}`,
      };
    }
    logger.info(
      `Adding ${extendedKeyObj.addresses.length} addresses to api queue in collection ${collectionName} in ${extendedKeyName}`
    );
    enqueue({
      collectionName,
      extendedKeyName,
      testResponse,
    });
    return { success: true };
  }

  logger.error(
    "No valid address, descriptorName, extendedKeyName, or collectionName provided to refreshBalance"
  );
  return {
    success: false,
    error:
      "No valid address, descriptorName, extendedKeyName, or collectionName provided",
  };
};
