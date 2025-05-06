import memory from "../memory.js";
import logger from "../logger.js";

export const updateAddress = async (data) => {
  const { collection, address } = data;

  if (!collection || !address) {
    logger.error("Missing collection or address data");
    return { error: "Missing collection or address data" };
  }

  const targetCollection = memory.db.collections[collection];
  if (!targetCollection) {
    logger.error("Collection not found");
    return { error: "Collection not found" };
  }

  // Try to find the address in the collection's addresses
  let addressIndex = targetCollection.addresses.findIndex(
    (a) => a.address === address.address
  );
  if (addressIndex !== -1) {
    targetCollection.addresses[addressIndex] = {
      ...targetCollection.addresses[addressIndex],
      name: address.name,
      monitor:
        address.monitor || targetCollection.addresses[addressIndex].monitor,
    };
  } else {
    // Try to find the address in extended keys
    const extendedKey = targetCollection.extendedKeys?.find((key) =>
      key.addresses.some((a) => a.address === address.address)
    );
    if (extendedKey) {
      addressIndex = extendedKey.addresses.findIndex(
        (a) => a.address === address.address
      );
      extendedKey.addresses[addressIndex] = {
        ...extendedKey.addresses[addressIndex],
        name: address.name,
        monitor: address.monitor || extendedKey.addresses[addressIndex].monitor,
      };
    } else {
      // Try to find the address in descriptors
      const descriptor = targetCollection.descriptors?.find((desc) =>
        desc.addresses.some((a) => a.address === address.address)
      );
      if (descriptor) {
        addressIndex = descriptor.addresses.findIndex(
          (a) => a.address === address.address
        );
        descriptor.addresses[addressIndex] = {
          ...descriptor.addresses[addressIndex],
          name: address.name,
          monitor:
            address.monitor || descriptor.addresses[addressIndex].monitor,
        };
      } else {
        logger.error("Address not found");
        return { error: "Address not found" };
      }
    }
  }

  memory.saveDb();
  data.io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
