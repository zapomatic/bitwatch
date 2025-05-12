import memory from "../memory.js";
import logger, { getMonitorLog } from "../logger.js";
import mempool from "../mempool.js";

function updateAddressInParent(
  addresses,
  addressIndex,
  address,
  name,
  monitor,
  trackWebsocket
) {
  if (addressIndex === -1) return false;
  const oldAddress = addresses[addressIndex];
  logger.info(
    `Updating address: ${address}, old trackWebsocket: ${oldAddress.trackWebsocket}, new: ${trackWebsocket}`
  );
  addresses[addressIndex] = {
    ...oldAddress,
    address,
    name,
    trackWebsocket,
    monitor,
  };
  if (oldAddress.trackWebsocket !== trackWebsocket) {
    logger.info(
      `Updating tracking for ${address}, trackWebsocket changed from ${oldAddress.trackWebsocket} to ${trackWebsocket}`
    );
    if (trackWebsocket) {
      mempool.trackAddress(address);
    } else {
      mempool.untrackAddress(address);
    }
  }
  return true;
}

export const editAddress = async ({ data, io }) => {
  // console.log(`editAddress: ${JSON.stringify(data)}`);
  const { collection, address, name, monitor, trackWebsocket, parentKey } =
    data;
  logger.info(
    `editAddress: ${collection}/${address} with ${getMonitorLog(
      monitor
    )}, trackWebsocket: ${trackWebsocket}, parentKey: ${parentKey}`
  );

  if (!collection || !address) {
    logger.error("Missing collection or address data");
    return { error: "Missing collection or address data" };
  }

  const targetCollection = memory.db.collections[collection];
  if (!targetCollection) {
    logger.error("Collection not found");
    return { error: "Collection not found" };
  }

  let found = false;
  if (parentKey) {
    // Try extended keys first
    const extendedKey = targetCollection.extendedKeys?.find(
      (key) => key.key === parentKey
    );
    if (extendedKey) {
      const addressIndex = extendedKey.addresses.findIndex(
        (a) => a.address === address
      );
      found = updateAddressInParent(
        extendedKey.addresses,
        addressIndex,
        address,
        name,
        monitor,
        trackWebsocket
      );
    }
    // Try descriptors if not found in extended keys
    if (!found) {
      const descriptor = targetCollection.descriptors?.find(
        (desc) => desc.descriptor === parentKey
      );
      if (descriptor) {
        const addressIndex = descriptor.addresses.findIndex(
          (a) => a.address === address
        );
        found = updateAddressInParent(
          descriptor.addresses,
          addressIndex,
          address,
          name,
          monitor,
          trackWebsocket
        );
      }
    }
  } else {
    // Fallback: Try to find the address in the collection's addresses
    let addressIndex = targetCollection.addresses.findIndex(
      (a) => a.address === address
    );
    found = updateAddressInParent(
      targetCollection.addresses,
      addressIndex,
      address,
      name,
      monitor,
      trackWebsocket
    );
    if (!found) {
      // Try to find the address in extended keys (legacy fallback)
      const extendedKey = targetCollection.extendedKeys?.find((key) =>
        key.addresses.some((a) => a.address === address)
      );
      if (extendedKey) {
        addressIndex = extendedKey.addresses.findIndex(
          (a) => a.address === address
        );
        found = updateAddressInParent(
          extendedKey.addresses,
          addressIndex,
          address,
          name,
          monitor,
          trackWebsocket
        );
      } else {
        // Try to find the address in descriptors (legacy fallback)
        const descriptor = targetCollection.descriptors?.find((desc) =>
          desc.addresses.some((a) => a.address === address)
        );
        if (descriptor) {
          addressIndex = descriptor.addresses.findIndex(
            (a) => a.address === address
          );
          found = updateAddressInParent(
            descriptor.addresses,
            addressIndex,
            address,
            name,
            monitor,
            trackWebsocket
          );
        }
      }
    }
  }

  if (!found) {
    logger.error("Address not found");
    return { error: "Address not found" };
  }

  const saveResult = memory.saveDb();
  if (!saveResult) {
    logger.error("Failed to save address changes");
    return { error: "Failed to save address changes" };
  }

  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
