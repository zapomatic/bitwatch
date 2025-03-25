import getAddressBalance from "./getAddressBalance.js";
import { parallelLimit } from "async";
import socketIO from "./io.js";
import memory from "./memory.js";
import telegram from "./telegram.js";
import logger from "./logger.js";

const detectChanges = (
  actual,
  expected,
  address,
  collectionName,
  addressName
) => {
  if (!actual || !expected) return null;
  const changes = {};
  if (actual.chain_in !== expected.chain_in) changes.chain_in = actual.chain_in;
  if (actual.chain_out !== expected.chain_out)
    changes.chain_out = actual.chain_out;
  if (actual.mempool_in !== expected.mempool_in)
    changes.mempool_in = actual.mempool_in;
  if (actual.mempool_out !== expected.mempool_out)
    changes.mempool_out = actual.mempool_out;

  if (Object.keys(changes).length > 0) {
    logger.warning(`Balance mismatch detected for ${address} (${collectionName}/${addressName}):
Expected: chain_in=${expected.chain_in}, chain_out=${expected.chain_out}, mempool_in=${expected.mempool_in}, mempool_out=${expected.mempool_out}
Actual: chain_in=${actual.chain_in}, chain_out=${actual.chain_out}, mempool_in=${actual.mempool_in}, mempool_out=${actual.mempool_out}`);
  }

  return Object.keys(changes).length > 0 ? changes : null;
};

const calculateCollectionTotals = (addresses) => {
  return addresses.reduce(
    (totals, addr) => {
      if (!addr.actual || addr.error) return totals;
      return {
        chain_in: (totals.chain_in || 0) + (addr.actual.chain_in || 0),
        chain_out: (totals.chain_out || 0) + (addr.actual.chain_out || 0),
        mempool_in: (totals.mempool_in || 0) + (addr.actual.mempool_in || 0),
        mempool_out: (totals.mempool_out || 0) + (addr.actual.mempool_out || 0),
      };
    },
    {
      chain_in: 0,
      chain_out: 0,
      mempool_in: 0,
      mempool_out: 0,
    }
  );
};

const updateAddressAndEmit = (addr, balance) => {
  const collections = { ...memory.db.collections };
  const collection = collections[addr.collection];
  if (!collection) return;

  const index = collection.addresses.findIndex(
    (a) => a.address === addr.address
  );
  if (index === -1) return;

  // Update the address with new balance
  collection.addresses[index] = {
    ...collection.addresses[index],
    actual: balance.actual,
    error: balance.error,
    errorMessage: balance.errorMessage,
    expect: collection.addresses[index].expect || {
      chain_in: 0,
      chain_out: 0,
      mempool_in: 0,
      mempool_out: 0,
    },
  };

  // Check for changes and notify
  const changes = detectChanges(
    balance.actual,
    collection.addresses[index].expect,
    addr.address,
    addr.collection,
    collection.addresses[index].name
  );
  if (changes) {
    telegram.notifyBalanceChange(
      addr.address,
      changes,
      addr.collection,
      collection.addresses[index].name
    );
  }

  // Determine API state based on address data
  const hasActualData = Object.values(collections).some((col) =>
    col.addresses.some((addr) => addr.actual !== null)
  );
  const hasErrors = Object.values(collections).some((col) =>
    col.addresses.some((addr) => addr.error)
  );
  const hasLoading = Object.values(collections).some((col) =>
    col.addresses.some((addr) => addr.actual === null && !addr.error)
  );

  let apiState = "?";
  if (hasErrors) {
    apiState = "ERROR";
  } else if (hasLoading) {
    apiState = "CHECKING";
  } else if (hasActualData) {
    apiState = "GOOD";
  }

  // Update state and emit changes
  memory.state = { collections };
  socketIO.io.emit("updateState", {
    collections,
    apiState,
  });
};

const engine = async () => {
  // Create a flat list of all addresses with their collection info
  const allAddresses = [];
  for (const [collectionName, collection] of Object.entries(
    memory.db.collections
  )) {
    collection.addresses.forEach((addr) => {
      allAddresses.push({
        ...addr,
        collection: collectionName,
      });
    });
  }

  // Set API state to CHECKING when starting a new check
  socketIO.io.emit("updateState", {
    collections: memory.db.collections,
    apiState: "CHECKING",
  });

  logger.processing(
    `Starting balance check for ${allAddresses.length} addresses (${memory.db.apiParallelLimit} concurrent)`
  );

  // Process addresses in parallel with a limit
  await parallelLimit(
    allAddresses.map((addr) => async () => {
      try {
        const balance = await getAddressBalance(addr.address);
        if (balance.error) {
          logger.error(
            `Failed to fetch balance for ${addr.address}: ${balance.message}`
          );
          updateAddressAndEmit(addr, {
            actual: null,
            error: true,
            errorMessage: balance.message,
          });
          return;
        }
        updateAddressAndEmit(addr, {
          actual: balance.actual,
          error: false,
          errorMessage: null,
        });
      } catch (error) {
        logger.error(
          `Failed to fetch balance for ${addr.address}: ${error.message}`
        );
        updateAddressAndEmit(addr, {
          actual: null,
          error: true,
          errorMessage: error.message,
        });
      }
    }),
    memory.db.apiParallelLimit
  );

  // Schedule next update
  setTimeout(engine, memory.db.interval);
};

export default engine;
