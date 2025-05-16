import logger from "./logger.js";
import getGap from "./getGap.js";

export default (item) => {
  if (!item?.addresses) {
    logger.warning(`No addresses found for item ${item?.name}`);
    return false;
  }

  const { lastUsedIndex, emptyCount } = getGap(item.addresses);

  // If we haven't found any activity yet, we don't need more addresses
  if (lastUsedIndex === -1) {
    logger.warning(`No activity found yet for ${item.name}`);
    return false;
  }

  // If we have enough empty addresses after the last used one, we're good
  if (emptyCount >= item.gapLimit) {
    logger.info(
      `Gap limit maintained for ${item.name}: ${emptyCount} empty addresses after index ${lastUsedIndex} (gap limit: ${item.gapLimit})`
    );
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
