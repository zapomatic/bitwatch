import memory from "./memory.js";
import logger from "./logger.js";
import detectBalanceChanges from "./detectBalanceChanges.js";
import getGapNeeded from "./getGapNeeded.js";
import { deriveExtendedKeyAddresses } from "./deriveExtendedKeyAddresses.js";
import { deriveAddresses } from "./descriptors.js";
import telegram from "./telegram.js";
import getAddressObj from "./getAddressObj.js";

export default async ({
  address,
  balance,
  collectionName,
  extendedKeyName,
  descriptorName,
}) => {
  logger.info(
    `handleBalanceUpdate: Handling balance update for ${address} in ${collectionName}/${
      extendedKeyName || descriptorName || "root"
    }`
  );

  // Find address using getAddressObj helper
  const found = getAddressObj({
    address,
    collectionName,
    extendedKeyName,
    descriptorName,
  });

  if (!found) {
    logger.error(
      `handleBalanceUpdate: Address ${address} not found in any location: ${JSON.stringify(
        {
          collectionName,
          extendedKeyName,
          descriptorName,
        }
      )}`
    );
    return { error: "Address not found" };
  }

  const { address: addr, parentItem } = found;

  logger.debug(
    `Found address ${address} in ${
      descriptorName
        ? "descriptor"
        : extendedKeyName
        ? "extended key"
        : "main addresses"
    }`
  );

  // Store old balance for comparison
  const oldBalance = addr.actual || {
    chain_in: 0,
    chain_out: 0,
    mempool_in: 0,
    mempool_out: 0,
  };

  // Ensure balance.actual exists and has all required fields
  const newBalance = {
    chain_in: balance.actual?.chain_in ?? 0,
    chain_out: balance.actual?.chain_out ?? 0,
    mempool_in: balance.actual?.mempool_in ?? 0,
    mempool_out: balance.actual?.mempool_out ?? 0,
  };

  logger.debug(
    `Updating balance from ${JSON.stringify(oldBalance)} to ${JSON.stringify(
      newBalance
    )}`
  );

  // Update the address with new balance, preserving expect object
  addr.actual = newBalance;
  addr.error = balance.error || false;
  addr.errorMessage = balance.errorMessage || null;
  addr.expect = addr.expect || {
    chain_in: 0,
    chain_out: 0,
    mempool_in: 0,
    mempool_out: 0,
  };

  // Check for balance changes and handle notifications
  const changes = detectBalanceChanges(
    address,
    newBalance,
    collectionName,
    addr.name
  );
  if (changes) {
    // Notify via telegram if needed
    telegram.notifyBalanceChange(address, changes, collectionName, addr.name);
  }

  // Check if we need to derive more addresses after any balance update
  if (parentItem) {
    const addressesNeeded = getGapNeeded(parentItem);
    logger.info(
      `Gap check for ${parentItem.name}: addressesNeeded=${addressesNeeded}, totalAddresses=${parentItem.addresses.length}`
    );
    if (addressesNeeded) {
      logger.debug(
        `After balance update, need ${addressesNeeded} more to maintain gap limit`
      );
      // Calculate the next index to derive from
      const maxIndex = Math.max(
        ...parentItem.addresses.map((addr) => addr.index)
      );
      const nextIndex = maxIndex + 1;

      logger.info(
        `Deriving ${addressesNeeded} more addresses starting at index ${nextIndex} for ${parentItem.name}`
      );

      // Derive more addresses
      const additionalAddresses = extendedKeyName
        ? deriveExtendedKeyAddresses({
            key: parentItem.key,
            skip: 0,
            startIndex: nextIndex,
            count: addressesNeeded,
            derivationPath: parentItem.derivationPath,
          })
        : deriveAddresses(parentItem.descriptor, nextIndex, addressesNeeded, 0);

      if (
        extendedKeyName ? additionalAddresses : additionalAddresses?.success
      ) {
        // Add new addresses to parent item
        const additionalAddressRecords = (
          extendedKeyName ? additionalAddresses : additionalAddresses.data
        ).map((addr) => ({
          address: addr.address,
          name: `${parentItem.name} ${addr.index}`,
          index: addr.index,
          expect: {
            chain_in: 0,
            chain_out: 0,
            mempool_in: 0,
            mempool_out: 0,
          },
          monitor: parentItem.monitor || memory.db.monitor,
          actual: null,
          error: false,
          errorMessage: null,
        }));

        // Add new addresses and sort by index to maintain order
        parentItem.addresses = [
          ...parentItem.addresses,
          ...additionalAddressRecords,
        ].sort((a, b) => a.index - b.index);
        logger.info(
          `Added ${additionalAddressRecords.length} additional addresses to ${
            descriptorName ? "descriptor" : "extended key"
          }: ${additionalAddressRecords.map((a) => a.index).join(", ")}`
        );
      }
    }
  }

  // Save the database if changes were detected
  memory.saveDb();

  return { success: true };
};
