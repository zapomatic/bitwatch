import queue from "./index.js";
import memory from "../memory.js";
import logger from "../logger.js";
import emitState from "../emitState.js";
import getAddressObj from "../getAddressObj.js";
// Add addresses to the queue
export default ({
  address,
  collectionName,
  extendedKeyName,
  descriptorName,
  testResponse,
}) => {
  const baseData = {
    collectionName,
    extendedKeyName,
    descriptorName,
    testResponse,
  };
  const addresses = [];
  // construct the list of addresses to enqueue
  // if address is provided, add it to the list
  // if collectionName is provided, add all addresses in the collection to the list
  // if extendedKeyName is provided, add all addresses in the extended key to the list
  // if descriptorName is provided, add all addresses in the descriptor to the list
  if (address) {
    addresses.push({ ...baseData, address });
  } else {
    const collection = memory.db.collections[collectionName];

    if (extendedKeyName) {
      const extendedKey = collection.extendedKeys.find(
        (k) => k.name === extendedKeyName
      );
      if (extendedKey) {
        addresses.push(
          ...extendedKey.addresses.map((a) => ({
            ...baseData,
            address: a.address,
          }))
        );
      }
    } else if (descriptorName) {
      const descriptor = collection.descriptors.find(
        (d) => d.name === descriptorName
      );
      if (descriptor) {
        addresses.push(
          ...descriptor.addresses.map((a) => ({
            ...baseData,
            address: a.address,
          }))
        );
      }
    } else if (collectionName) {
      // Only add main collection addresses if no specific extended key or descriptor is specified
      addresses.push(
        ...collection.addresses.map((a) => ({
          ...baseData,
          address: a.address,
        }))
      );
    }
  }
  logger.debug(`Enqueuing ${addresses.length} addresses`);
  // Filter out addresses that are already in the queue
  const newAddresses = addresses.filter(
    (addr) => !queue.items.some((q) => q.address === addr.address)
  );
  logger.debug(`New addresses: ${newAddresses.length}`);

  if (newAddresses.length > 0) {
    queue.items.push(...newAddresses);
    logger.debug(
      `Added ${newAddresses.length} addresses to queue. Queue size: ${queue.items.length}`
    );

    // Mark addresses as queued in collections memory
    newAddresses.forEach((addr) => {
      const found = getAddressObj(addr);
      if (found) {
        found.address.queued = true;
      }
    });

    // Emit updated queue status
    emitState({
      collections: memory.db.collections,
      queue,
    });
  }
};
