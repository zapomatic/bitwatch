import logger from "../logger.js";
import hasAddressActivity from "./hasAddressActivity.js";
export default (addresses) => {
  let lastUsedIndex = -1;
  let emptyCount = 0;

  // Sort addresses by index to ensure we check them in order
  const sortedAddresses = [...addresses].sort((a, b) => a.index - b.index);
  logger.debug(
    `Checking ${sortedAddresses.length} addresses for last used and empty count`
  );

  // First pass: find the last used index
  for (const addr of sortedAddresses) {
    if (hasAddressActivity(addr)) {
      lastUsedIndex = addr.index;
      logger.debug(
        `Found activity at index ${addr.index}: chain_in=${addr.actual?.chain_in}, chain_out=${addr.actual?.chain_out}, mempool_in=${addr.actual?.mempool_in}, mempool_out=${addr.actual?.mempool_out}`
      );
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
