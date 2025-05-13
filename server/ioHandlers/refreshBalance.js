import { enqueueAddresses } from "../balanceQueue.js";
import logger from "../logger.js";

export const refreshBalance = async ({ data, io }) => {
  if (!data.collection || !data.address) {
    logger.error("Missing collection or address");
    return { error: "Missing collection or address" };
  }

  logger.info(`Adding ${data.address} to balance queue in ${data.collection}`);

  // Add the address to the queue
  enqueueAddresses([
    {
      address: data.address,
      collection: data.collection,
    },
  ]);

  return { success: true };
};
