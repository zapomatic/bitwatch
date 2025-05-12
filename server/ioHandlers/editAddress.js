import memory from "../memory.js";
import logger, { getMonitorLog } from "../logger.js";
import mempool from "../mempool.js";

export const editAddress = async ({ data, io }) => {
  console.log(`editAddress: ${JSON.stringify(data)}`);
  const { collection, address, name, monitor, trackWebsocket, parentKey } =
    data;
  logger.info(
    `editAddress: ${collection}/${address} with ${getMonitorLog(
      monitor
    )}, trackWebsocket: ${trackWebsocket}`
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

  // Try to find the address in the collection's addresses
  let addressIndex = targetCollection.addresses.findIndex(
    (a) => a.address === address
  );
  if (addressIndex !== -1) {
    const oldAddress = targetCollection.addresses[addressIndex];
    logger.info(
      `Found address in collection, old trackWebsocket: ${oldAddress.trackWebsocket}, new: ${trackWebsocket}`
    );

    targetCollection.addresses[addressIndex] = {
      ...oldAddress,
      address,
      name,
      trackWebsocket,
      monitor,
    };

    // Update tracking if websocket setting changed
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
  } else {
    // Try to find the address in extended keys
    const extendedKey = targetCollection.extendedKeys?.find((key) =>
      key.addresses.some((a) => a.address === address)
    );
    if (extendedKey) {
      addressIndex = extendedKey.addresses.findIndex(
        (a) => a.address === address
      );
      const oldAddress = extendedKey.addresses[addressIndex];
      logger.info(
        `Found address in extended key, old trackWebsocket: ${oldAddress.trackWebsocket}, new: ${trackWebsocket}`
      );

      extendedKey.addresses[addressIndex] = {
        ...oldAddress,
        address,
        name,
        trackWebsocket,
        monitor,
      };

      // Update tracking if websocket setting changed
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
    } else {
      // Try to find the address in descriptors
      const descriptor = targetCollection.descriptors?.find((desc) =>
        desc.addresses.some((a) => a.address === address)
      );
      if (descriptor) {
        addressIndex = descriptor.addresses.findIndex(
          (a) => a.address === address
        );
        const oldAddress = descriptor.addresses[addressIndex];
        logger.info(
          `Found address in descriptor, old trackWebsocket: ${oldAddress.trackWebsocket}, new: ${trackWebsocket}`
        );

        descriptor.addresses[addressIndex] = {
          ...oldAddress,
          address,
          name,
          trackWebsocket,
          monitor,
        };

        // Update tracking if websocket setting changed
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
      } else {
        logger.error("Address not found");
        return { error: "Address not found" };
      }
    }
  }

  const saveResult = memory.saveDb();
  if (!saveResult) {
    logger.error("Failed to save address changes");
    return { error: "Failed to save address changes" };
  }

  io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
