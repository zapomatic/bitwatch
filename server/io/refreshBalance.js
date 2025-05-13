import { enqueueAddresses } from "../lib/balanceQueue.js";
import logger from "../lib/logger.js";

export default async ({ data }) => {
  // Handle single address refresh
  if (data.collection && data.address) {
    logger.info(
      `Adding ${data.address} to balance queue in ${data.collection}`
    );
    enqueueAddresses([
      {
        address: data.address,
        collection: data.collection,
        testResponse: data.testResponse,
      },
    ]);
    return { success: true };
  }

  // Handle batch refresh for descriptor or extended key
  if (
    data.collection &&
    (data.descriptor || data.extendedKey) &&
    data.addresses
  ) {
    logger.info(
      `Adding ${data.addresses.length} addresses to balance queue in ${
        data.collection
      } for ${data.descriptor ? "descriptor" : "extended key"}`
    );
    enqueueAddresses(
      data.addresses.map((address) => ({
        address,
        collection: data.collection,
        testResponse: data.testResponse,
      }))
    );
    return { success: true };
  }

  logger.error("Invalid refresh request - missing required parameters");
  return { error: "Invalid refresh request - missing required parameters" };
};
