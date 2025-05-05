import { getAddressBalance, handleBalanceUpdate } from "./getAddressBalance.js";
import { parallelLimit } from "async";
import socketIO from "./io.js";
import memory from "./memory.js";
import logger from "./logger.js";

// Helper function to check balances for a set of addresses
const checkAddressBalances = async (addresses) => {
  // Process addresses in parallel with a limit and delay
  const queue = addresses.map((addr) => async () => {
    const balance = await getAddressBalance(addr.address);

    if (balance.error) {
      logger.error(
        `Failed to fetch balance for ${addr.address}: ${balance.message}`
      );
      addr.error = true;
      addr.errorMessage = balance.message;
      addr.actual = null;
    } else {
      // Use centralized balance update handler
      await handleBalanceUpdate(addr.address, balance, addr.collection);
    }

    // Add delay between API calls
    await new Promise((resolve) => setTimeout(resolve, memory.db.apiDelay));
  });

  // Process the queue with parallelLimit
  await parallelLimit(queue, memory.db.apiParallelLimit);
};

const engine = async () => {
  // Create a flat list of all addresses with their collection info
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

  // Set API state to CHECKING when starting a new check
  memory.state.apiState = "CHECKING";
  socketIO.io.emit("updateState", {
    collections: memory.db.collections,
    apiState: memory.state.apiState,
  });

  logger.processing(
    `Starting balance check for ${allAddresses.length} addresses (${memory.db.apiParallelLimit} concurrent, ${memory.db.apiDelay}ms delay)`
  );

  // Check balances for all addresses
  await checkAddressBalances(allAddresses);

  // Save state and emit update
  memory.saveDb();
  socketIO.io.emit("updateState", {
    collections: memory.db.collections,
    apiState: "GOOD",
  });

  // Schedule next update
  setTimeout(engine, memory.db.interval);
};

export default engine;
