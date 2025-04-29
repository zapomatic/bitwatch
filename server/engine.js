import getAddressBalance from "./getAddressBalance.js";
import { parallelLimit } from "async";
import socketIO from "./io.js";
import memory from "./memory.js";
import telegram from "./telegram.js";
import logger from "./logger.js";
import { detectBalanceChanges } from "./balance.js";

const updateAddressAndEmit = (addr, balance) => {
  const collections = { ...memory.db.collections };
  const collection = collections[addr.collection];
  if (!collection) return;

  // Try to find the address in regular addresses first
  let index = collection.addresses.findIndex((a) => a.address === addr.address);
  let addressArray = collection.addresses;
  let isExtendedKeyAddress = false;
  let isDescriptorAddress = false;

  // If not found in regular addresses, check extended keys
  if (index === -1 && collection.extendedKeys) {
    for (let i = 0; i < collection.extendedKeys.length; i++) {
      const extendedKey = collection.extendedKeys[i];
      index = extendedKey.addresses.findIndex(
        (a) => a.address === addr.address
      );
      if (index !== -1) {
        addressArray = extendedKey.addresses;
        isExtendedKeyAddress = true;
        break;
      }
    }
  }

  // If not found in extended keys, check descriptors
  if (index === -1 && collection.descriptors) {
    for (let i = 0; i < collection.descriptors.length; i++) {
      const descriptor = collection.descriptors[i];
      index = descriptor.addresses.findIndex((a) => a.address === addr.address);
      if (index !== -1) {
        addressArray = descriptor.addresses;
        isDescriptorAddress = true;
        break;
      }
    }
  }

  if (index === -1) return;

  // Update the address with new balance
  addressArray[index] = {
    ...addressArray[index],
    actual: balance.actual,
    error: balance.error,
    errorMessage: balance.errorMessage,
    expect: addressArray[index].expect || {
      chain_in: 0,
      chain_out: 0,
      mempool_in: 0,
      mempool_out: 0,
    },
  };

  // Check for changes and notify
  const changes = detectBalanceChanges(
    addr.address,
    balance.actual,
    addr.collection,
    addressArray[index].name
  );
  if (changes) {
    telegram.notifyBalanceChange(
      addr.address,
      changes,
      addr.collection,
      addressArray[index].name
    );
  }

  // Determine API state based on address data
  const hasActualData = Object.values(collections).some(
    (col) =>
      col.addresses.some((addr) => addr.actual !== null) ||
      (col.extendedKeys &&
        col.extendedKeys.some((extKey) =>
          extKey.addresses.some((addr) => addr.actual !== null)
        )) ||
      (col.descriptors &&
        col.descriptors.some((desc) =>
          desc.addresses.some((addr) => addr.actual !== null)
        ))
  );
  const hasErrors = Object.values(collections).some(
    (col) =>
      col.addresses.some((addr) => addr.error) ||
      (col.extendedKeys &&
        col.extendedKeys.some((extKey) =>
          extKey.addresses.some((addr) => addr.error)
        )) ||
      (col.descriptors &&
        col.descriptors.some((desc) =>
          desc.addresses.some((addr) => addr.error)
        ))
  );
  const hasLoading = Object.values(collections).some(
    (col) =>
      col.addresses.some((addr) => addr.actual === null && !addr.error) ||
      (col.extendedKeys &&
        col.extendedKeys.some((extKey) =>
          extKey.addresses.some((addr) => addr.actual === null && !addr.error)
        )) ||
      (col.descriptors &&
        col.descriptors.some((desc) =>
          desc.addresses.some((addr) => addr.actual === null && !addr.error)
        ))
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
  memory.state = {
    collections,
    websocketState: memory.state.websocketState,
    apiState,
  };
  socketIO.io.emit("updateState", {
    collections,
    apiState: memory.state.apiState,
  });
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

  // Process addresses in parallel with a limit and delay
  const queue = allAddresses.map((addr) => async () => {
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

    // Add delay between API calls
    await new Promise((resolve) => setTimeout(resolve, memory.db.apiDelay));
  });

  // Process the queue with parallelLimit
  await parallelLimit(queue, memory.db.apiParallelLimit);

  // Schedule next update
  setTimeout(engine, memory.db.interval);
};

export default engine;
