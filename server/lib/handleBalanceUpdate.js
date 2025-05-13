import memory from "../memory.js";
import logger from "../logger.js";
import getAddressBalance from "./getAddressBalance.js";
import detectBalanceChanges from "./detectBalanceChanges.js";
import getGapNeeded from "./getGapNeeded.js";
import { deriveExtendedKeyAddresses } from "../deriveExtendedKeyAddresses.js";
import { deriveAddresses } from "../descriptors.js";
import telegram from "../telegram.js";

export default async (address, balance, collectionName) => {
  const collection = memory.db.collections[collectionName];
  if (!collection) {
    logger.error(`Collection ${collectionName} not found`);
    return { error: "Collection not found" };
  }

  logger.debug(`Handling balance update for ${address} in ${collectionName}`);

  // Find address in either main addresses or extended key addresses
  let addr = collection.addresses.find((a) => a.address === address);
  let parentItem = null;
  let isExtendedKeyAddress = false;
  let isDescriptorAddress = false;

  logger.debug(`Found in main addresses: ${!!addr}`);

  // If not found in main addresses, check extended keys
  if (!addr && collection.extendedKeys) {
    logger.debug(`Checking ${collection.extendedKeys.length} extended keys`);
    for (const extendedKey of collection.extendedKeys) {
      addr = extendedKey.addresses.find((a) => a.address === address);
      if (addr) {
        logger.debug(`Found in extended key: ${extendedKey.name}`);
        parentItem = extendedKey;
        isExtendedKeyAddress = true;
        break;
      }
    }
  }

  // If not found in extended keys, check descriptors
  if (!addr && collection.descriptors) {
    logger.debug(`Checking ${collection.descriptors.length} descriptors`);
    for (const descriptor of collection.descriptors) {
      logger.debug(
        `Checking descriptor ${descriptor.name} with ${
          descriptor.addresses?.length || 0
        } addresses`
      );
      addr = descriptor.addresses.find((a) => a.address === address);
      if (addr) {
        logger.debug(`Found in descriptor: ${descriptor.name}`);
        parentItem = descriptor;
        isDescriptorAddress = true;
        break;
      }
    }
  }

  if (!addr) {
    logger.error(`Address ${address} not found in any location`);
    return { error: "Address not found" };
  }

  logger.debug(
    `Found address ${address} in ${
      isDescriptorAddress
        ? "descriptor"
        : isExtendedKeyAddress
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

  // Check if balance changed
  const balanceChanged =
    oldBalance.chain_in !== newBalance.chain_in ||
    oldBalance.chain_out !== newBalance.chain_out ||
    oldBalance.mempool_in !== newBalance.mempool_in ||
    oldBalance.mempool_out !== newBalance.mempool_out;

  logger.debug(`Balance changed: ${balanceChanged}`);

  // If balance changed and this is part of an extended key or descriptor
  if (balanceChanged && parentItem) {
    // Function to check balances and derive more addresses if needed
    const checkBalancesAndDeriveMore = async () => {
      // Check balances for all addresses
      await Promise.all(
        parentItem.addresses.map(async (addr) => {
          const balance = await getAddressBalance(addr.address);
          if (balance.error) {
            addr.error = true;
            addr.errorMessage = balance.message;
            logger.debug(
              `Error checking balance for address ${addr.address} at index ${addr.index}: ${balance.message}`
            );
          } else {
            // Store old balance for comparison
            const oldBalance = addr.actual || {
              chain_in: 0,
              chain_out: 0,
              mempool_in: 0,
              mempool_out: 0,
            };

            // Update the address with new balance
            addr.actual = {
              chain_in: balance.actual?.chain_in ?? 0,
              chain_out: balance.actual?.chain_out ?? 0,
              mempool_in: balance.actual?.mempool_in ?? 0,
              mempool_out: balance.actual?.mempool_out ?? 0,
            };
            addr.error = false;
            addr.errorMessage = null;

            // Check if balance changed
            const balanceChanged =
              oldBalance.chain_in !== addr.actual.chain_in ||
              oldBalance.chain_out !== addr.actual.chain_out ||
              oldBalance.mempool_in !== addr.actual.mempool_in ||
              oldBalance.mempool_out !== addr.actual.mempool_out;

            if (balanceChanged) {
              logger.debug(
                `Balance changed for address ${addr.address} at index ${addr.index}: chain_in=${addr.actual.chain_in}, chain_out=${addr.actual.chain_out}, mempool_in=${addr.actual.mempool_in}, mempool_out=${addr.actual.mempool_out}`
              );

              // Check for notifications
              const changes = detectBalanceChanges(
                addr.address,
                addr.actual,
                collectionName,
                addr.name
              );
              if (changes) {
                // Notify via telegram if needed
                telegram.notifyBalanceChange(
                  addr.address,
                  changes,
                  collectionName,
                  addr.name
                );
              }
            }
          }
        })
      );

      // Check if we need to derive more addresses
      const addressesNeeded = getGapNeeded(parentItem);
      if (addressesNeeded) {
        logger.debug(
          `After checking balances, need ${addressesNeeded} more to maintain gap limit`
        );
        // Calculate the next index to derive from
        const maxIndex = Math.max(
          ...parentItem.addresses.map((addr) => addr.index)
        );
        const nextIndex = maxIndex + 1;

        logger.debug(
          `Deriving ${addressesNeeded} more addresses starting at index ${nextIndex} for ${parentItem.name}`
        );

        // Derive more addresses
        const additionalAddresses = isExtendedKeyAddress
          ? deriveExtendedKeyAddresses({
              key: parentItem.key,
              skip: 0,
              startIndex: nextIndex,
              count: addressesNeeded,
              derivationPath: parentItem.derivationPath,
            })
          : deriveAddresses(
              parentItem.descriptor,
              nextIndex,
              addressesNeeded,
              0
            );

        if (
          isExtendedKeyAddress
            ? additionalAddresses
            : additionalAddresses?.success
        ) {
          // Add new addresses to parent item
          const additionalAddressRecords = (
            isExtendedKeyAddress
              ? additionalAddresses
              : additionalAddresses.data
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
          logger.debug(
            `Added ${additionalAddressRecords.length} additional addresses to ${
              isDescriptorAddress ? "descriptor" : "extended key"
            }: ${additionalAddressRecords.map((a) => a.index).join(", ")}`
          );

          // Recursively check balances and derive more if needed
          await checkBalancesAndDeriveMore();
        }
      }
    };

    // Start the recursive process
    await checkBalancesAndDeriveMore();
  }

  // If balance changed, check for notifications for the original address
  if (balanceChanged) {
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
  }

  // Save the database if changes were detected
  memory.saveDb();

  return { success: true };
};
