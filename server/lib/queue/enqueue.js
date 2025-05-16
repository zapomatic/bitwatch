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
  logger.info(
    `Enqueuing address ${collectionName}/${
      extendedKeyName || descriptorName || "root"
    }/${address} to queue: ${queue.items.length}`
  );
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
      // Add main collection addresses
      addresses.push(
        ...collection.addresses.map((a) => ({
          ...baseData,
          address: a.address,
        }))
      );

      // Add all addresses from extended keys
      if (collection.extendedKeys) {
        collection.extendedKeys.forEach((extKey) => {
          addresses.push(
            ...extKey.addresses.map((a) => ({
              ...baseData,
              extendedKeyName: extKey.name,
              address: a.address,
            }))
          );
        });
      }

      // Add all addresses from descriptors
      if (collection.descriptors) {
        collection.descriptors.forEach((desc) => {
          addresses.push(
            ...desc.addresses.map((a) => ({
              ...baseData,
              descriptorName: desc.name,
              address: a.address,
            }))
          );
        });
      }
    }
  }

  // Mark addresses as queued in collections memory
  addresses.forEach((addr) => {
    const found = getAddressObj(addr);
    if (found) {
      found.address.queued = true;
    } else {
      logger.error(`Address ${addr.address} not found in collections memory`);
    }
  });

  // Filter out duplicates before adding to queue
  const uniqueAddresses = addresses.filter((newAddr) => {
    // Check if there's already an identical item in the queue
    const isDuplicate = queue.items.some((existingAddr) => {
      // Compare all relevant fields
      return (
        existingAddr.address === newAddr.address &&
        existingAddr.collectionName === newAddr.collectionName &&
        existingAddr.extendedKeyName === newAddr.extendedKeyName &&
        existingAddr.descriptorName === newAddr.descriptorName &&
        // Compare testResponse objects if they exist
        ((!existingAddr.testResponse && !newAddr.testResponse) ||
          (existingAddr.testResponse &&
            newAddr.testResponse &&
            existingAddr.testResponse === newAddr.testResponse))
      );
    });

    if (isDuplicate) {
      logger.debug(
        `Skipping duplicate address ${newAddr.address} in queue (${
          newAddr.collectionName
        }/${newAddr.extendedKeyName || newAddr.descriptorName || "root"})`
      );
    }
    return !isDuplicate;
  });

  // Add only unique addresses to the queue
  queue.items.push(...uniqueAddresses);

  // Emit updated queue status
  emitState({
    collections: memory.db.collections,
    queue,
  });
  logger.info(
    `enqueue: Added ${uniqueAddresses.length} address(es) to queue. Queue size: ${queue.items.length}`
  );
};
