import { parallelLimit } from "async";
import memory from "./memory.js";
import logger from "./logger.js";
import socketIO from "./io.js";
import { getAddressBalance, handleBalanceUpdate } from "./getAddressBalance.js";

// Queue state
let queue = [];
let isProcessing = false;
let lastProcessedTime = 0;

// Emit queue status update
const emitQueueStatus = () => {
  socketIO.io.emit("updateState", {
    queueStatus: getQueueStatus(),
  });
};

// Get all watched addresses
const getAllWatchedAddresses = () => {
  const allAddresses = [];
  for (const [collectionName, collection] of Object.entries(
    memory.db.collections
  )) {
    // Add regular addresses
    collection.addresses.forEach((addr) => {
      allAddresses.push({
        ...addr,
        collection: collectionName,
      });
    });

    // Add extended key addresses
    if (collection.extendedKeys) {
      collection.extendedKeys.forEach((extendedKey) => {
        extendedKey.addresses.forEach((addr) => {
          allAddresses.push({
            ...addr,
            collection: collectionName,
          });
        });
      });
    }

    // Add descriptor addresses
    if (collection.descriptors) {
      collection.descriptors.forEach((descriptor) => {
        descriptor.addresses.forEach((addr) => {
          allAddresses.push({
            ...addr,
            collection: collectionName,
          });
        });
      });
    }
  }
  return allAddresses;
};

// Add addresses to the queue
export const enqueueAddresses = (addresses) => {
  // Filter out addresses that are already in the queue
  const newAddresses = addresses.filter(
    (addr) =>
      !queue.some(
        (q) => q.address === addr.address && q.collection === addr.collection
      )
  );

  if (newAddresses.length > 0) {
    queue.push(...newAddresses);
    logger.debug(
      `Added ${newAddresses.length} addresses to queue. Queue size: ${queue.length}`
    );

    // Emit updated queue status
    emitQueueStatus();

    // Start processing if not already running
    if (!isProcessing) {
      processQueue();
    }
  }
};

// Process the queue
const processQueue = async () => {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;
  emitQueueStatus();

  logger.processing(
    `Processing balance queue with ${queue.length} addresses (${memory.db.apiParallelLimit} concurrent, ${memory.db.apiDelay}ms delay)`
  );

  // Create tasks for parallel processing
  const tasks = queue.map((addr) => async () => {
    // Ensure minimum delay between API calls
    const timeSinceLastProcess = Date.now() - lastProcessedTime;
    if (timeSinceLastProcess < memory.db.apiDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, memory.db.apiDelay - timeSinceLastProcess)
      );
    }

    const balance = await getAddressBalance(
      addr.address,
      (delay, retryCount, maxRetries) => {
        // Update state to BACKOFF when rate limited
        memory.state.apiState = "BACKOFF";
        emitQueueStatus();
      }
    );
    lastProcessedTime = Date.now();

    if (balance.error) {
      logger.error(
        `Failed to fetch balance for ${addr.address}: ${balance.message}`
      );
      addr.error = true;
      addr.errorMessage = balance.message;
      addr.actual = null;
      // Only set ERROR state if it's not a rate limit error
      if (
        !balance.message?.includes("429") &&
        !balance.message?.includes("Too Many Requests")
      ) {
        memory.state.apiState = "ERROR";
      }
    } else {
      // Use centralized balance update handler
      await handleBalanceUpdate(addr.address, balance, addr.collection);
      memory.state.apiState = "GOOD";
    }

    // Remove the processed address from the queue
    queue = queue.filter(
      (q) => q.address !== addr.address || q.collection !== addr.collection
    );

    // Emit updated queue status after each address is processed
    emitQueueStatus();
  });

  // Process the queue with parallelLimit
  await parallelLimit(tasks, memory.db.apiParallelLimit);

  // Save state and emit update
  memory.saveDb();
  emitQueueStatus();

  isProcessing = false;

  // If queue is empty, wait for the configured delay before re-queueing
  if (queue.length === 0) {
    logger.info(
      `Queue empty, waiting ${memory.db.apiDelay}ms before re-queueing all watched addresses`
    );
    setTimeout(() => {
      const allAddresses = getAllWatchedAddresses();
      enqueueAddresses(allAddresses);
    }, memory.db.apiDelay);
  } else {
    // If there are more items in the queue, continue processing
    processQueue();
  }
};

// Get queue status
export const getQueueStatus = () => ({
  queueSize: queue.length,
  isProcessing,
  lastProcessedTime,
});

// Clear the queue
export const clearQueue = () => {
  queue = [];
  logger.info("Balance queue cleared");
  emitQueueStatus();
};
