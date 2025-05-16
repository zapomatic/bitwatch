import memory from "./memory.js";
import logger from "./logger.js";

export default (address, balance, collectionName, addressName) => {
  const collections = memory.db.collections;
  const collection = collections[collectionName];
  if (!collection) return null;

  // Find address in either main addresses or extended key addresses
  let addr = collection.addresses.find((a) => a.address === address);

  // If not found in main addresses, check extended keys
  if (!addr && collection.extendedKeys) {
    for (const extendedKey of collection.extendedKeys) {
      addr = extendedKey.addresses.find((a) => a.address === address);
      if (addr) break;
    }
  }

  // If not found in extended keys, check descriptors
  if (!addr && collection.descriptors) {
    for (const descriptor of collection.descriptors) {
      addr = descriptor.addresses.find((a) => a.address === address);
      if (addr) break;
    }
  }

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
  const shouldAutoAccept = (type) => {
    if (!addr.monitor) return false; // Default to alert if no monitor settings
    return addr.monitor[type] === "auto-accept";
  };

  // Check each balance type for changes
  if (newBalance.chain_in !== addr.expect.chain_in) {
    changes.chain_in = newBalance.chain_in;
    if (shouldAutoAccept("chain_in")) {
      logger.info(
        `auto-accept chain_in (${newBalance.chain_in}) for ${address} (${collectionName}/${addressName})`
      );
      addr.expect.chain_in = newBalance.chain_in;
      addr.alerted.chain_in = false;
    } else if (
      newBalance.chain_in !== oldBalance.chain_in &&
      !addr.alerted.chain_in
    ) {
      // Only alert if the actual balance has changed and we haven't alerted yet
      logger.info(
        `alert chain_in (${newBalance.chain_in}) for ${address} (${collectionName}/${addressName})`
      );
      addr.alerted.chain_in = true;
    }
  }
  if (newBalance.chain_out !== addr.expect.chain_out) {
    changes.chain_out = newBalance.chain_out;
    if (shouldAutoAccept("chain_out")) {
      logger.info(
        `auto-accept chain_out (${newBalance.chain_out}) for ${address} (${collectionName}/${addressName})`
      );
      addr.expect.chain_out = newBalance.chain_out;
      addr.alerted.chain_out = false;
    } else if (
      newBalance.chain_out !== oldBalance.chain_out &&
      !addr.alerted.chain_out
    ) {
      // Only alert if the actual balance has changed and we haven't alerted yet
      logger.info(
        `alert chain_out (${newBalance.chain_out}) for ${address} (${collectionName}/${addressName})`
      );
      addr.alerted.chain_out = true;
    }
  }
  if (newBalance.mempool_in !== addr.expect.mempool_in) {
    changes.mempool_in = newBalance.mempool_in;
    if (shouldAutoAccept("mempool_in")) {
      logger.info(
        `auto-accept mempool_in (${newBalance.mempool_in}) for ${address} (${collectionName}/${addressName})`
      );
      addr.expect.mempool_in = newBalance.mempool_in;
      addr.alerted.mempool_in = false;
    } else if (
      newBalance.mempool_in !== oldBalance.mempool_in &&
      !addr.alerted.mempool_in
    ) {
      // Only alert if the actual balance has changed and we haven't alerted yet
      logger.info(
        `alert mempool_in (${newBalance.mempool_in}) for ${address} (${collectionName}/${addressName})`
      );
      addr.alerted.mempool_in = true;
    }
  }
  if (newBalance.mempool_out !== addr.expect.mempool_out) {
    changes.mempool_out = newBalance.mempool_out;
    if (shouldAutoAccept("mempool_out")) {
      logger.info(
        `auto-accept mempool_out (${newBalance.mempool_out}) for ${address} (${collectionName}/${addressName})`
      );
      addr.expect.mempool_out = newBalance.mempool_out;
      addr.alerted.mempool_out = false;
    } else if (
      newBalance.mempool_out !== oldBalance.mempool_out &&
      !addr.alerted.mempool_out
    ) {
      // Only alert if the actual balance has changed and we haven't alerted yet
      logger.info(
        `alert mempool_out (${newBalance.mempool_out}) for ${address} (${collectionName}/${addressName})`
      );
      addr.alerted.mempool_out = true;
    }
  }

  // Update the address with new balance
  addr.actual = newBalance;

  // If there are any changes, log them
  if (Object.keys(changes).length > 0) {
    logger.debug(`Balance changes detected for ${address} (${collectionName}/${addressName}):
Expected: chain_in=${addr.expect.chain_in}, chain_out=${addr.expect.chain_out}, mempool_in=${addr.expect.mempool_in}, mempool_out=${addr.expect.mempool_out}
Actual: chain_in=${newBalance.chain_in}, chain_out=${newBalance.chain_out}, mempool_in=${newBalance.mempool_in}, mempool_out=${newBalance.mempool_out}
Previous: chain_in=${oldBalance.chain_in}, chain_out=${oldBalance.chain_out}, mempool_in=${oldBalance.mempool_in}, mempool_out=${oldBalance.mempool_out}`);

    // Save the database if changes were detected
    memory.saveDb();
  }

  // Only return changes that need alerts and haven't been alerted yet
  const alertChanges = {};
  for (const [type, value] of Object.entries(changes)) {
    if (!shouldAutoAccept(type) && !addr.alerted[type]) {
      alertChanges[type] = value;
    }
  }

  return Object.keys(alertChanges).length > 0 ? alertChanges : null;
};
