import https from "https";
import http from "http";
import pjson from "../package.json" with { type: "json" };
import memory from "./memory.js";
import * as url from "node:url";
import logger from "./logger.js";
import socketIO from "./io.js";
import telegram from "./telegram.js";
import { deriveExtendedKeyAddresses } from "./deriveExtendedKeyAddresses.js";
import { deriveAddresses } from "./descriptors.js";

// Helper to check if an address has any activity
const hasAddressActivity = (addr) => {
  if (!addr?.actual) return false;
  return (
    addr.actual.chain_in > 0 ||
    addr.actual.chain_out > 0 ||
    addr.actual.mempool_in > 0 ||
    addr.actual.mempool_out > 0
  );
};

// Helper to find the last used address and empty count
const findLastUsedAndEmpty = (addresses) => {
  let lastUsedIndex = -1;
  let emptyCount = 0;

  // Sort addresses by index to ensure we check them in order
  const sortedAddresses = [...addresses].sort((a, b) => a.index - b.index);
  logger.debug(`Checking ${sortedAddresses.length} addresses for last used and empty count`);

  // First pass: find the last used index
  for (const addr of sortedAddresses) {
    if (hasAddressActivity(addr)) {
      lastUsedIndex = addr.index;
      logger.debug(`Found activity at index ${addr.index}: chain_in=${addr.actual?.chain_in}, chain_out=${addr.actual?.chain_out}, mempool_in=${addr.actual?.mempool_in}, mempool_out=${addr.actual?.mempool_out}`);
    }
  }

  // Second pass: count empty addresses after the last used index
  if (lastUsedIndex !== -1) {
    for (const addr of sortedAddresses) {
      if (addr.index > lastUsedIndex && !hasAddressActivity(addr)) {
        emptyCount++;
        logger.debug(`Empty address found at index ${addr.index}`);
      }
    }
  }

  logger.debug(`Last used index: ${lastUsedIndex}, Empty count: ${emptyCount}`);
  return { lastUsedIndex, emptyCount };
};

// Check if we need to generate more addresses to maintain gap limit
const checkAndUpdateGapLimit = (item) => {
  if (!item?.addresses) {
    logger.debug(`No addresses found for item ${item?.name}`);
    return false;
  }

  const { lastUsedIndex, emptyCount } = findLastUsedAndEmpty(item.addresses);

  // If we haven't found any activity yet, we don't need more addresses
  if (lastUsedIndex === -1) {
    logger.debug(`No activity found yet for ${item.name}`);
    return false;
  }

  // If we have enough empty addresses after the last used one, we're good
  if (emptyCount >= item.gapLimit) {
    logger.debug(`Gap limit maintained for ${item.name}: ${emptyCount} empty addresses after index ${lastUsedIndex} (gap limit: ${item.gapLimit})`);
    return false;
  }

  // Calculate how many more addresses we need to maintain the gap limit
  const addressesNeeded = item.gapLimit - emptyCount;

  // If we need more addresses, emit an event to trigger address generation
  logger.info(
    `Need more addresses for ${item.name}: last used index ${lastUsedIndex}, empty count ${emptyCount}, gap limit ${item.gapLimit}, generating ${addressesNeeded} more`
  );
  return addressesNeeded;
};

// Detect balance changes for notifications
const detectBalanceChanges = (
  address,
  balance,
  collectionName,
  addressName
) => {
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

  // Only return changes that need alerts
  const alertChanges = {};
  for (const [type, value] of Object.entries(changes)) {
    if (needsAlert(type)) {
      alertChanges[type] = value;
    }
  }

  return Object.keys(alertChanges).length > 0 ? alertChanges : null;
};

// Centralized function to handle balance updates and gap limit checks
const handleBalanceUpdate = async (address, balance, collectionName) => {
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
      logger.debug(`Checking descriptor ${descriptor.name} with ${descriptor.addresses?.length || 0} addresses`);
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

  logger.debug(`Found address ${address} in ${isDescriptorAddress ? 'descriptor' : isExtendedKeyAddress ? 'extended key' : 'main addresses'}`);

  // Store old balance for comparison
  const oldBalance = addr.actual || {
    chain_in: 0,
    chain_out: 0,
    mempool_in: 0,
    mempool_out: 0
  };

  // Ensure balance.actual exists and has all required fields
  const newBalance = {
    chain_in: balance.actual?.chain_in ?? 0,
    chain_out: balance.actual?.chain_out ?? 0,
    mempool_in: balance.actual?.mempool_in ?? 0,
    mempool_out: balance.actual?.mempool_out ?? 0
  };

  logger.debug(`Updating balance from ${JSON.stringify(oldBalance)} to ${JSON.stringify(newBalance)}`);

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
            logger.debug(`Error checking balance for address ${addr.address} at index ${addr.index}: ${balance.message}`);
          } else {
            // Store old balance for comparison
            const oldBalance = addr.actual || {
              chain_in: 0,
              chain_out: 0,
              mempool_in: 0,
              mempool_out: 0
            };

            // Update the address with new balance
            addr.actual = {
              chain_in: balance.actual?.chain_in ?? 0,
              chain_out: balance.actual?.chain_out ?? 0,
              mempool_in: balance.actual?.mempool_in ?? 0,
              mempool_out: balance.actual?.mempool_out ?? 0
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
              logger.debug(`Balance changed for address ${addr.address} at index ${addr.index}: chain_in=${addr.actual.chain_in}, chain_out=${addr.actual.chain_out}, mempool_in=${addr.actual.mempool_in}, mempool_out=${addr.actual.mempool_out}`);
              
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
      const addressesNeeded = checkAndUpdateGapLimit(parentItem);
      if (addressesNeeded) {
        logger.debug(`After checking balances, need ${addressesNeeded} more to maintain gap limit`);
        // Calculate the next index to derive from
        const maxIndex = Math.max(...parentItem.addresses.map(addr => addr.index));
        const nextIndex = maxIndex + 1;

        logger.debug(`Deriving ${addressesNeeded} more addresses starting at index ${nextIndex} for ${parentItem.name}`);

        // Derive more addresses
        const additionalAddresses = isExtendedKeyAddress
          ? deriveExtendedKeyAddresses({
              key: parentItem.key,
              skip: 0,
              startIndex: nextIndex,
              count: addressesNeeded,
              derivationPath: parentItem.derivationPath
            })
          : deriveAddresses(
              parentItem.descriptor,
              nextIndex,
              addressesNeeded,
              0
            );

        if (isExtendedKeyAddress ? additionalAddresses : additionalAddresses?.success) {
          // Add new addresses to parent item
          const additionalAddressRecords = (isExtendedKeyAddress ? additionalAddresses : additionalAddresses.data).map((addr) => ({
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
          parentItem.addresses = [...parentItem.addresses, ...additionalAddressRecords].sort((a, b) => a.index - b.index);
          logger.debug(`Added ${additionalAddressRecords.length} additional addresses to ${isDescriptorAddress ? 'descriptor' : 'extended key'}: ${additionalAddressRecords.map(a => a.index).join(', ')}`);

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
      telegram.notifyBalanceChange(
        address,
        changes,
        collectionName,
        addr.name
      );
    }
  }

  // Save the database if changes were detected
  memory.saveDb();

  return { success: true };
};

const attemptCall = async (addr, testResponse) => {
  return new Promise((resolve, reject) => {
    const api = url.parse(memory.db.api);
    const options = {
      headers: {
        Origin: `${api.protocol}//${api.hostname}${api.port ? `:${api.port}` : ''}`,
        "User-Agent": `Bitwatch/${pjson.version}`,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/json;charset=UTF-8",
        "Content-Length": 0,
        Connection: "keep-alive",
      },
      method: "GET",
      host: api.hostname,
      port: api.port || (api.protocol === "https:" ? 443 : 80),
      path: '/api/address',
    };

    const currentOpt = { ...options };
    currentOpt.path = `${options.path}/${addr}`;
    
    // If we have a test response, add it to the headers
    if (testResponse) {
      currentOpt.headers["x-test-response"] = testResponse;
    }
    
    const req = (api.protocol === "https:" ? https : http).request(
      currentOpt,
      function (res) {
        const { statusCode } = res;
        res.setEncoding("utf8");
        let body = "";
        res.on("data", function (d) {
          body += d;
        });
        res.on("end", function () {
          if (statusCode !== 200) {
            logger.error(`API error for ${addr}: ${statusCode} ${body}`);
            reject({ error: true, message: `API error: ${statusCode} ${body}` });
            return;
          }

          const json = JSON.parse(body);
          if (!json) {
            logger.error(`Failed to parse JSON response for ${addr}`);
            reject({ error: true, message: "Invalid JSON response" });
            return;
          }

          const result = {
            actual: {
              chain_in: json.chain_stats?.funded_txo_sum || 0,
              chain_out: json.chain_stats?.spent_txo_sum || 0,
              mempool_in: json.mempool_stats?.funded_txo_sum || 0,
              mempool_out: json.mempool_stats?.spent_txo_sum || 0,
            }
          };

          logger.success(`Balance ${addr}: chain (in=${result.actual.chain_in}, out=${result.actual.chain_out}), mempool (in=${result.actual.mempool_in}, out=${result.actual.mempool_out})`);
          resolve(result);
        });
      }
    );
    req.on("error", (e) => {
      if(e.statusCode === 504) {
        logger.warning(`Server capacity exceeded for ${addr} - address will be ignored`);
        reject({ error: true, message: "Server capacity exceeded" });
      } else {
        logger.error(`Network error for ${addr}: ${e.message}`);
        reject({ error: true, message: `Network error: ${e.message}` });
      }
    });

    req.end();
  });
};

const getAddressBalance = async (addr, onRateLimit, testResponse) => {
  let retryCount = 0;
  const maxRetries = 5;
  const baseDelay = 2000; // Start with 2 seconds

  while (retryCount < maxRetries) {
    const result = await attemptCall(addr, testResponse).catch((e) => {
      return { error: true, message: e.message };
    });
    if (!result.error) {
      // If we got here after retries, notify that API is good again
      if (retryCount > 0) {
        socketIO.io.emit("updateState", { 
          collections: memory.db.collections,
          apiState: "GOOD"
        });
      }
      return {
        actual: {
          chain_in: result.actual?.chain_in ?? 0,
          chain_out: result.actual?.chain_out ?? 0,
          mempool_in: result.actual?.mempool_in ?? 0,
          mempool_out: result.actual?.mempool_out ?? 0
        }
      };
    }

    // Check if it's a rate limit error
    if (result.message?.includes('429') || result.message?.includes('Too Many Requests')) {
      retryCount++;
      if (retryCount === maxRetries) {
        logger.error(`Rate limit exceeded for ${addr} after ${maxRetries} retries`);
        return { error: true, message: "Rate limit exceeded. Please try again later." };
      }
      
      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, retryCount - 1);
      logger.warning(`Rate limited for ${addr}, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);

      // Notify about rate limit through callback if provided
      if (onRateLimit) {
        onRateLimit(delay, retryCount, maxRetries);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    
    // For other errors, return immediately
    logger.error(`Failed to fetch balance for ${addr}: ${result.message}`);
    return { error: true, message: result.message };
  }
  
  return { error: true, message: "Max retries exceeded" };
};

export { getAddressBalance, handleBalanceUpdate };
