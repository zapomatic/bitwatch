import memory from "./memory.js";
import logger from "./logger.js";

export const detectBalanceChanges = (
  address,
  balance,
  collectionName,
  addressName
) => {
  const collections = memory.db.collections;
  const collection = collections[collectionName];
  if (!collection) return null;

  const addr = collection.addresses.find((a) => a.address === address);
  if (!addr) return null;

  // Initialize alerted field if it doesn't exist
  if (!addr.alerted) {
    addr.alerted = {
      chain_in: false,
      chain_out: false,
      mempool_in: false,
      mempool_out: false,
    };
  }

  // Store old balance for comparison
  const oldBalance = { ...addr.actual };
  const newBalance = { ...balance };

  // Check for changes that need alerts
  const changes = {};
  const needsAlert = (type) => {
    if (!addr.monitor) return true; // Default to alert if no monitor settings
    return addr.monitor[type] === "alert" && !addr.alerted[type];
  };

  // Check each balance type for changes
  if (newBalance.chain_in !== addr.expect.chain_in) {
    changes.chain_in = newBalance.chain_in;
    if (needsAlert("chain_in")) {
      logger.info(
        `alert chain_in (${newBalance.chain_in}) for ${address} (${collectionName}/${addressName})`
      );
      addr.alerted.chain_in = true;
    } else {
      logger.info(
        `auto-accept chain_in (${newBalance.chain_in}) for ${address} (${collectionName}/${addressName})`
      );
      addr.expect.chain_in = newBalance.chain_in;
      addr.alerted.chain_in = false;
    }
  }
  if (newBalance.chain_out !== addr.expect.chain_out) {
    changes.chain_out = newBalance.chain_out;
    if (needsAlert("chain_out")) {
      logger.info(
        `alert chain_out (${newBalance.chain_out}) for ${address} (${collectionName}/${addressName})`
      );
      addr.alerted.chain_out = true;
    } else {
      logger.info(
        `auto-accept chain_out (${newBalance.chain_out}) for ${address} (${collectionName}/${addressName})`
      );
      addr.expect.chain_out = newBalance.chain_out;
      addr.alerted.chain_out = false;
    }
  }
  if (newBalance.mempool_in !== addr.expect.mempool_in) {
    changes.mempool_in = newBalance.mempool_in;
    if (needsAlert("mempool_in")) {
      logger.info(
        `alert mempool_in (${newBalance.mempool_in}) for ${address} (${collectionName}/${addressName})`
      );
      addr.alerted.mempool_in = true;
    } else {
      logger.info(
        `auto-accept mempool_in (${newBalance.mempool_in}) for ${address} (${collectionName}/${addressName})`
      );
      addr.expect.mempool_in = newBalance.mempool_in;
      addr.alerted.mempool_in = false;
    }
  }
  if (newBalance.mempool_out !== addr.expect.mempool_out) {
    changes.mempool_out = newBalance.mempool_out;
    if (needsAlert("mempool_out")) {
      logger.info(
        `alert mempool_out (${newBalance.mempool_out}) for ${address} (${collectionName}/${addressName})`
      );
      addr.alerted.mempool_out = true;
    } else {
      logger.info(
        `auto-accept mempool_out (${newBalance.mempool_out}) for ${address} (${collectionName}/${addressName})`
      );
      addr.expect.mempool_out = newBalance.mempool_out;
      addr.alerted.mempool_out = false;
    }
  }

  // Update the address with new balance
  addr.actual = newBalance;

  // If there are any changes, log them
  if (Object.keys(changes).length > 0) {
    logger.info(`Balance changes detected for ${address} (${collectionName}/${addressName}):
Expected: chain_in=${addr.expect.chain_in}, chain_out=${addr.expect.chain_out}, mempool_in=${addr.expect.mempool_in}, mempool_out=${addr.expect.mempool_out}
Actual: chain_in=${newBalance.chain_in}, chain_out=${newBalance.chain_out}, mempool_in=${newBalance.mempool_in}, mempool_out=${newBalance.mempool_out}
Previous: chain_in=${oldBalance.chain_in}, chain_out=${oldBalance.chain_out}, mempool_in=${oldBalance.mempool_in}, mempool_out=${oldBalance.mempool_out}`);

    // Save the database if changes were detected
    memory.saveDb();
  }

  return Object.keys(changes).length > 0 ? changes : null;
};
