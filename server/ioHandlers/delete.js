import memory from "../memory.js";
import logger from "../logger.js";

export const deleteHandler = async (data) => {
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
      targetCollection.descriptors[descIndex].addresses.splice(addressIndex, 1);
    } else {
      const addressIndex = targetCollection.addresses.findIndex(
        (a) => a.address === address
      );
      if (addressIndex === -1) {
        logger.error("Address not found");
        return { error: "Address not found" };
      }
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
    targetCollection.extendedKeys.splice(keyIndex, 1);
  } else if (descriptor) {
    const descIndex = targetCollection.descriptors.findIndex(
      (d) => d.descriptor === descriptor
    );
    if (descIndex === -1) {
      logger.error("Descriptor not found");
      return { error: "Descriptor not found" };
    }
    targetCollection.descriptors.splice(descIndex, 1);
  } else {
    delete memory.db.collections[collection];
  }

  memory.saveDb();
  data.io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
