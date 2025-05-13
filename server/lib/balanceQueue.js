import { parallelLimit } from "async";
import memory from "./memory.js";
import logger from "./logger.js";
import getAddressList from "./getAddressList.js";
import handleBalanceUpdate from "./handleBalanceUpdate.js";
import getAddressBalance from "./getAddressBalance.js";
import getAddressObj from "./getAddressObj.js";
import emitState from "./emitState.js";

// Queue state
let queue = [];
let isProcessing = false;
let lastProcessedTime = 0;

// Emit queue status update
const emitQueueStatus = () => {
  emitState({
    collections: memory.db.collections,
    queueStatus: getQueueStatus(),
  });
};

// Add addresses to the queue
// addresses is an array of objects with address object, collection name,  properties
export const enqueueAddresses = (addresses) => {
  // Filter out addresses that are already in the queue
  const newAddresses = addresses.filter(
    (addr) => !queue.includes(addr.address)
  );

  if (newAddresses.length > 0) {
    queue.push(...newAddresses.map((addr) => addr.address));
    logger.debug(
      `Added ${newAddresses.length} addresses to queue. Queue size: ${queue.length}`
    );

    // Mark addresses as queued in collections memory
    newAddresses.forEach((addr) => {
      const found = getAddressObj(addr.address);
      if (found) {
        found.address.queued = true;
      }
    });

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
  const tasks = queue.map((address) => async () => {
    // Ensure minimum delay between API calls
    const timeSinceLastProcess = Date.now() - lastProcessedTime;
    if (timeSinceLastProcess < memory.db.apiDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, memory.db.apiDelay - timeSinceLastProcess)
      );
    }

    const balance = await getAddressBalance(
      address,
      null,
      null // testResponse is no longer needed since we're not passing collection info
    );
    lastProcessedTime = Date.now();

    // Find the address in collections and clear queued state
    const found = getAddressObj(address);
    if (found) {
      found.address.queued = false;
    }

    if (balance.error) {
      logger.error(
        `Failed to fetch balance for ${address}: ${balance.message}`
      );
      // Find the address in collections and set error state
      const found = getAddressObj(address);
      if (found) {
        found.address.error = true;
        found.address.errorMessage = balance.message;
        found.address.actual = null;
      }
      // Set appropriate state based on error type
      if (
        balance.message?.includes("429") ||
        balance.message?.includes("Too Many Requests")
      ) {
        memory.state.apiState = "BACKOFF";
      } else {
        memory.state.apiState = "ERROR";
      }
    } else {
      // Use centralized balance update handler
      await handleBalanceUpdate(address, balance);
      memory.state.apiState = "GOOD";
    }

    // Remove the processed address from the queue
    queue = queue.filter((a) => a !== address);

    // Emit updated queue status after each address is processed
    emitQueueStatus();
  });

  // Process the queue with parallelLimit
  await parallelLimit(tasks, memory.db.apiParallelLimit);

  // Emit queue status
  emitQueueStatus();

  isProcessing = false;

  // If queue is empty, wait for the configured delay before re-queueing all watched addresses
  if (queue.length === 0) {
    logger.info(
      `Queue empty, waiting ${memory.db.apiDelay}ms before re-queueing all watched addresses`
    );
    setTimeout(() => {
      const allAddresses = getAddressList();
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

// Remove specific items from the queue
export const removeFromQueue = (addresses) => {
  const initialLength = queue.length;
  queue = queue.filter((addr) => !addresses.includes(addr));
  const removedCount = initialLength - queue.length;
  if (removedCount > 0) {
    logger.debug(
      `Removed ${removedCount} items from queue. Queue size: ${queue.length}`
    );
    emitQueueStatus();
  }
};

// Clear the queue
export const clearQueue = () => {
  queue = [];
  logger.info("Balance queue cleared");
  emitQueueStatus();
};
