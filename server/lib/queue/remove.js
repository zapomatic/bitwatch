import queue from "./index.js";
import logger from "../logger.js";
import memory from "../memory.js";
import emitState from "../emitState.js";

export default (addresses) => {
  const initialLength = queue.items.length;
  queue.items = queue.items.filter(
    (addrObj) =>
      !addresses.some(
        (removeAddr) =>
          removeAddr.address === addrObj.address &&
          removeAddr.collectionName === addrObj.collectionName &&
          removeAddr.extendedKeyName === addrObj.extendedKeyName &&
          removeAddr.descriptorName === addrObj.descriptorName
      )
  );
  const removedCount = initialLength - queue.items.length;
  if (removedCount > 0) {
    logger.debug(
      `Removed ${removedCount} items from queue. Queue size: ${queue.items.length}`
    );
    emitState({
      collections: memory.db.collections,
      queue,
    });
  }
};
