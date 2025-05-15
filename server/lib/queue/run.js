import queue from "./index.js";
import enqueue from "./enqueue.js";
import memory from "../memory.js";
import logger from "../logger.js";
import emitState from "../emitState.js";
import getAddressBalance from "../getAddressBalance.js";
import getAddressObj from "../getAddressObj.js";
import handleBalanceUpdate from "../handleBalanceUpdate.js";
import parallelLimit from "async/parallelLimit.js";
const runQueue = async () => {
  const delay = memory.db.apiDelay * (process.env.TEST_MODE ? 100 : 1);
  if (queue.items.length === 0) {
    for (const collectionName of Object.keys(memory.db.collections)) {
      logger.debug(`Enqueuing collection ${collectionName}`);
      enqueue({
        collectionName,
      });
    }
  }
  emitState({
    collections: memory.db.collections,
    queue,
  });

  logger.processing(
    `Processing api queue with ${queue.items.length} addresses (${memory.db.apiParallelLimit} concurrent, ${delay}ms delay)`
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
      addrObj.testResponse
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
          extendedKeyName: found.extendedKeyName,
          descriptorName: found.descriptorName,
        });
        memory.state.apiState = "GOOD";
      } else {
        logger.error(
          `runQueue: Address ${
            addrObj.address
          } not found in any collection: ${JSON.stringify(addrObj)}`
        );
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

  setTimeout(() => {
    runQueue();
  }, delay);
};

export default runQueue;
