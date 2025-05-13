import { parallelLimit } from "async";
import memory from "./memory.js";
import logger from "./logger.js";
import socketIO from "./io/index.js";
import getAddressList from "./lib/getAddressList.js";
import handleBalanceUpdate from "./lib/handleBalanceUpdate.js";
import getAddressBalance from "./lib/getAddressBalance.js";

// Queue state
let queue = [];
let isProcessing = false;
let lastProcessedTime = 0;

// Emit queue status update
const emitQueueStatus = () => {
  socketIO.io.emit("updateState", {
    collections: memory.db.collections,
    queueStatus: getQueueStatus(),
  });
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

    // Mark addresses as queued in collections memory
    newAddresses.forEach((addr) => {
      const collection = memory.db.collections[addr.collection];
      if (collection) {
        // Check regular addresses
        const address = collection.addresses.find(
          (a) => a.address === addr.address
        );
        if (address) {
          address.queued = true;
        }
        // Check extended key addresses
        if (collection.extendedKeys) {
          collection.extendedKeys.forEach((key) => {
            const extAddress = key.addresses.find(
              (a) => a.address === addr.address
            );
            if (extAddress) {
              extAddress.queued = true;
            }
          });
        }
        // Check descriptor addresses
        if (collection.descriptors) {
          collection.descriptors.forEach((desc) => {
            const descAddress = desc.addresses.find(
              (a) => a.address === addr.address
            );
            if (descAddress) {
              descAddress.queued = true;
            }
          });
        }
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
      null,
      addr.testResponse
    );
    lastProcessedTime = Date.now();

    // Clear queued state from the address
    const collection = memory.db.collections[addr.collection];
    if (collection) {
      // Check regular addresses
      const address = collection.addresses.find(
        (a) => a.address === addr.address
      );
      if (address) {
        address.queued = false;
      }
      // Check extended key addresses
      if (collection.extendedKeys) {
        collection.extendedKeys.forEach((key) => {
          const extAddress = key.addresses.find(
            (a) => a.address === addr.address
          );
          if (extAddress) {
            extAddress.queued = false;
          }
        });
      }
      // Check descriptor addresses
      if (collection.descriptors) {
        collection.descriptors.forEach((desc) => {
          const descAddress = desc.addresses.find(
            (a) => a.address === addr.address
          );
          if (descAddress) {
            descAddress.queued = false;
          }
        });
      }
    }

    if (balance.error) {
      logger.error(
        `Failed to fetch balance for ${addr.address}: ${balance.message}`
      );
      addr.error = true;
      addr.errorMessage = balance.message;
      addr.actual = null;
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

// Clear the queue
export const clearQueue = () => {
  queue = [];
  logger.info("Balance queue cleared");
  emitQueueStatus();
};
