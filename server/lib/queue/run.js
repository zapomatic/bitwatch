import queue from "./index.js";
import enqueue from "./enqueue.js";
import memory from "../memory.js";
import logger from "../logger.js";
import emitState from "../emitState.js";
import getAddressBalance from "../getAddressBalance.js";
import getAddressObj from "../getAddressObj.js";
import handleBalanceUpdate from "../handleBalanceUpdate.js";
import getAddressList from "../getAddressList.js";
import parallelLimit from "async/parallelLimit.js";
const runQueue = async () => {
  if (queue.isProcessing || queue.items.length === 0) return;

  queue.isProcessing = true;
  emitState({
    collections: memory.db.collections,
    queue,
  });

  logger.processing(
    `Processing balance queue with ${queue.items.length} addresses (${memory.db.apiParallelLimit} concurrent, ${memory.db.apiDelay}ms delay)`
  );

  // Create tasks for parallel processing
  const tasks = queue.items.map((addrObj) => async () => {
    // Ensure minimum delay between API calls
    const timeSinceLastProcess = Date.now() - queue.lastProcessedTime;
    if (timeSinceLastProcess < memory.db.apiDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, memory.db.apiDelay - timeSinceLastProcess)
      );
    }

    const balance = await getAddressBalance(
      addrObj.address,
      null,
      null // testResponse is no longer needed since we're not passing collection info
    );
    queue.lastProcessedTime = Date.now();

    // Find the address in collections and clear queued state
    const found = getAddressObj(addrObj);
    if (found) {
      found.address.queued = false;
    }

    if (balance.error) {
      logger.error(
        `Failed to fetch balance for ${addrObj.address}: ${balance.message}`
      );
      // Find the address in collections and set error state
      const found = getAddressObj(addrObj);
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
      const found = getAddressObj(addrObj);
      if (found) {
        await handleBalanceUpdate({
          address: addrObj.address,
          balance,
          collectionName: found.collectionName,
          extendedKey: found.extendedKeyName,
          descriptor: found.descriptorName,
        });
        memory.state.apiState = "GOOD";
      } else {
        logger.error(`Address ${addrObj.address} not found in any collection`);
        memory.state.apiState = "ERROR";
      }
    }

    // Remove the processed address from the queue
    queue.items = queue.items.filter(
      (a) =>
        !(
          a.address === addrObj.address &&
          a.collectionName === addrObj.collectionName &&
          a.extendedKeyName === addrObj.extendedKeyName &&
          a.descriptorName === addrObj.descriptorName
        )
    );

    // Emit updated queue status after each address is processed
    emitState({
      collections: memory.db.collections,
      queue,
    });
  });

  // Process the queue with parallelLimit
  await parallelLimit(tasks, memory.db.apiParallelLimit);

  // Emit queue status
  emitState({
    collections: memory.db.collections,
    queue,
  });

  queue.isProcessing = false;

  // If queue is empty, wait for the configured delay before re-queueing all watched addresses
  if (queue.items.length === 0) {
    setTimeout(() => {
      const allAddresses = getAddressList();
      enqueue(allAddresses);
    }, memory.db.apiDelay);
  } else {
    // If there are more items in the queue, continue processing
    runQueue();
  }
};

export default runQueue;
