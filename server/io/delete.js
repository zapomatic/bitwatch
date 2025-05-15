import memory from "../lib/memory.js";
import logger from "../lib/logger.js";
import mempool from "../lib/mempool.js";
import remove from "../lib/queue/remove.js";

export default async ({ data, io }) => {
  const { address, collectionName, extendedKeyName, descriptorName } = data;

  if (!collectionName) {
    logger.error("Collection not specified");
    return { error: "Collection not specified" };
  }

  const targetCollection = memory.db.collections[collectionName];
  if (!targetCollection) {
    logger.error("delete: Collection not found");
    return { error: "Collection not found" };
  }

  // Track addresses to remove from queue
  const addressesToRemove = [];

  // Handle address deletion
  if (address) {
    // If it's an extended key address
    if (extendedKeyName) {
      const keyIndex = targetCollection.extendedKeys.findIndex(
        (k) => k.name === extendedKeyName
      );
      if (keyIndex === -1) {
        logger.error("delete: Extended key not found");
        return { error: "Extended key not found" };
      }
      const addressIndex = targetCollection.extendedKeys[
        keyIndex
      ].addresses.findIndex((a) => a.address === address);
      if (addressIndex === -1) {
        logger.error("delete: Address not found in extended key");
        return { error: "Address not found in extended key" };
      }
      // Untrack the address before removing it
      mempool.untrackAddress(address);
      targetCollection.extendedKeys[keyIndex].addresses.splice(addressIndex, 1);
      addressesToRemove.push({
        address,
        collectionName,
        extendedKeyName,
        descriptorName: undefined,
      });
    } else if (descriptorName) {
      const descIndex = targetCollection.descriptors.findIndex(
        (d) => d.name === descriptorName
      );
      if (descIndex === -1) {
        logger.error("delete: Descriptor not found");
        return { error: "Descriptor not found" };
      }
      const addressIndex = targetCollection.descriptors[
        descIndex
      ].addresses.findIndex((a) => a.address === address);
      if (addressIndex === -1) {
        logger.error("Address not found in descriptor");
        return { error: "Address not found in descriptor" };
      }
      // Untrack the address before removing it
      mempool.untrackAddress(address);
      targetCollection.descriptors[descIndex].addresses.splice(addressIndex, 1);
      addressesToRemove.push({
        address,
        collectionName,
        extendedKeyName: undefined,
        descriptorName,
      });
    } else {
      const addressIndex = targetCollection.addresses.findIndex(
        (a) => a.address === address
      );
      if (addressIndex === -1) {
        logger.error("delete: Address not found");
        return { error: "Address not found" };
      }
      // Untrack the address before removing it
      mempool.untrackAddress(address);
      targetCollection.addresses.splice(addressIndex, 1);
      addressesToRemove.push({
        address,
        collectionName,
        extendedKeyName: undefined,
        descriptorName: undefined,
      });
    }
  } else if (extendedKeyName) {
    const keyIndex = targetCollection.extendedKeys.findIndex(
      (k) => k.name === extendedKeyName
    );
    if (keyIndex === -1) {
      logger.error("delete: Extended key not found");
      return { error: "Extended key not found" };
    }
    // Untrack all addresses in the extended key before removing it
    targetCollection.extendedKeys[keyIndex].addresses.forEach((addr) => {
      mempool.untrackAddress(addr.address);
      addressesToRemove.push({
        address: addr.address,
        collectionName,
        extendedKeyName,
        descriptorName: undefined,
      });
    });
    targetCollection.extendedKeys.splice(keyIndex, 1);
  } else if (descriptorName) {
    const descIndex = targetCollection.descriptors.findIndex(
      (d) => d.name === descriptorName
    );
    if (descIndex === -1) {
      logger.error("delete: Descriptor not found");
      return { error: "Descriptor not found" };
    }
    // Untrack all addresses in the descriptor before removing it
    targetCollection.descriptors[descIndex].addresses.forEach((addr) => {
      mempool.untrackAddress(addr.address);
      addressesToRemove.push({
        address: addr.address,
        collectionName,
        extendedKeyName: undefined,
        descriptorName,
      });
    });
    targetCollection.descriptors.splice(descIndex, 1);
  } else {
    // When deleting a collection, untrack all addresses in it
    targetCollection.addresses.forEach((addr) => {
      mempool.untrackAddress(addr.address);
      addressesToRemove.push({
        address: addr.address,
        collectionName,
        extendedKeyName: undefined,
        descriptorName: undefined,
      });
    });
    if (targetCollection.extendedKeys) {
      targetCollection.extendedKeys.forEach((key) => {
        key.addresses.forEach((addr) => {
          mempool.untrackAddress(addr.address);
          addressesToRemove.push({
            address: addr.address,
            collectionName,
            extendedKeyName: key.name,
            descriptorName: undefined,
          });
        });
      });
    }
    if (targetCollection.descriptors) {
      targetCollection.descriptors.forEach((desc) => {
        desc.addresses.forEach((addr) => {
          mempool.untrackAddress(addr.address);
          addressesToRemove.push({
            address: addr.address,
            collectionName,
            extendedKeyName: undefined,
            descriptorName: desc.name,
          });
        });
      });
    }
    delete memory.db.collections[collectionName];
  }

  // Remove the deleted addresses from the queue
  if (addressesToRemove.length > 0) {
    remove(addressesToRemove);
  }

  memory.saveDb();
  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
