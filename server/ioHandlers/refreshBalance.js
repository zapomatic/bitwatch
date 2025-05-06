import {
  getAddressBalance,
  handleBalanceUpdate,
} from "../getAddressBalance.js";
import memory from "../memory.js";
import logger from "../logger.js";

export const refreshBalance = async (data) => {
  if (!data.collection || !data.address) {
    logger.error("Missing collection or address");
    return { error: "Missing collection or address" };
  }

  logger.info(`Refreshing balance for ${data.address} in ${data.collection}`);

  // Fetch new balance
  const balance = await getAddressBalance(data.address);
  if (balance.error) {
    logger.error(balance.message);
    return { error: balance.message };
  }

  // Use centralized balance update handler
  const result = await handleBalanceUpdate(
    data.address,
    balance,
    data.collection
  );
  if (result.error) {
    logger.error(result.error);
    return { error: result.error };
  }

  // Emit update to all clients
  data.io.emit("updateState", { collections: memory.db.collections });
  return { success: true };
};
