import memory from "../memory.js";
import logger from "../logger.js";
import mempool from "../mempool.js";

export default async ({ data, io }) => {
  const { address, collection, extendedKey, descriptor } = data;

  if (!collection) {
    logger.error("Collection not specified");
    return { error: "Collection not specified" };
  }

  const targetCollection = memory.db.collections[collection];
  if (!targetCollection) {
    logger.error("Collection not found");
    return { error: "Collection not found" };
  }

  // Handle address deletion
  if (address) {
    // If it's an extended key address
    if (extendedKey) {
      const keyIndex = targetCollection.extendedKeys.findIndex(
        (k) => k.key === extendedKey
      );
      if (keyIndex === -1) {
        logger.error("Extended key not found");
        return { error: "Extended key not found" };
      }
      const addressIndex = targetCollection.extendedKeys[
        keyIndex
      ].addresses.findIndex((a) => a.address === address);
      if (addressIndex === -1) {
        logger.error("Address not found in extended key");
        return { error: "Address not found in extended key" };
      }
      // Untrack the address before removing it
      mempool.untrackAddress(address);
      targetCollection.extendedKeys[keyIndex].addresses.splice(addressIndex, 1);
    } else if (descriptor) {
      const descIndex = targetCollection.descriptors.findIndex(
        (d) => d.descriptor === descriptor
      );
      if (descIndex === -1) {
        logger.error("Descriptor not found");
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
    } else {
      const addressIndex = targetCollection.addresses.findIndex(
        (a) => a.address === address
      );
      if (addressIndex === -1) {
        logger.error("Address not found");
        return { error: "Address not found" };
      }
      // Untrack the address before removing it
      mempool.untrackAddress(address);
      targetCollection.addresses.splice(addressIndex, 1);
    }
  } else if (extendedKey) {
    const keyIndex = targetCollection.extendedKeys.findIndex(
      (k) => k.key === extendedKey
    );
    if (keyIndex === -1) {
      logger.error("Extended key not found");
      return { error: "Extended key not found" };
    }
    // Untrack all addresses in the extended key before removing it
    targetCollection.extendedKeys[keyIndex].addresses.forEach((addr) => {
      mempool.untrackAddress(addr.address);
    });
    targetCollection.extendedKeys.splice(keyIndex, 1);
  } else if (descriptor) {
    const descIndex = targetCollection.descriptors.findIndex(
      (d) => d.descriptor === descriptor
    );
    if (descIndex === -1) {
      logger.error("Descriptor not found");
      return { error: "Descriptor not found" };
    }
    // Untrack all addresses in the descriptor before removing it
    targetCollection.descriptors[descIndex].addresses.forEach((addr) => {
      mempool.untrackAddress(addr.address);
    });
    targetCollection.descriptors.splice(descIndex, 1);
  } else {
    // When deleting a collection, untrack all addresses in it
    targetCollection.addresses.forEach((addr) => {
      mempool.untrackAddress(addr.address);
    });
    if (targetCollection.extendedKeys) {
      targetCollection.extendedKeys.forEach((key) => {
        key.addresses.forEach((addr) => {
          mempool.untrackAddress(addr.address);
        });
      });
    }
    if (targetCollection.descriptors) {
      targetCollection.descriptors.forEach((desc) => {
        desc.addresses.forEach((addr) => {
          mempool.untrackAddress(addr.address);
        });
      });
    }
    delete memory.db.collections[collection];
  }

  memory.saveDb();
  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
