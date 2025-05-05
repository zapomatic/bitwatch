import memory from "./memory.js";
import logger from "./logger.js";
import {
  detectBalanceChanges,
  checkAddressBalance,
  checkAndUpdateGapLimit,
} from "./balance.js";
import telegram from "./telegram.js";
import mempoolJS from "@mempool/mempool.js";
import {
  deriveExtendedKeyAddresses,
  deriveAddresses,
} from "./addressDeriver.js";

let mempoolClient = null;
let trackedAddresses = new Set();
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds
let isConnecting = false;
let isReady = false;

const getWebSocketState = (ws) => {
  if (!ws) return "NO_WEBSOCKET";
  switch (ws.readyState) {
    case 0:
      return "CONNECTING";
    case 1:
      return "OPEN";
    case 2:
      return "CLOSING";
    case 3:
      return "CLOSED";
    default:
      return "UNKNOWN";
  }
};

const updateTrackedAddresses = () => {
  if (!mempoolClient || !ws) {
    logger.warning("Cannot update tracked addresses - no websocket connection");
    return false;
  }

  if (ws.readyState !== 1) {
    logger.warning(
      `Cannot update tracked addresses - websocket not open (state: ${getWebSocketState(
        ws
      )})`
    );
    return false;
  }

  if (!isReady) {
    logger.warning("Cannot update tracked addresses - connection not ready");
    return false;
  }

  const newAddresses = new Set();
  Object.values(memory.db.collections).forEach((collection) => {
    // Add regular addresses
    collection.addresses.forEach((addr) => {
      newAddresses.add(addr.address);
    });

    // Add extended key addresses
    if (collection.extendedKeys) {
      collection.extendedKeys.forEach((extendedKey) => {
        extendedKey.addresses.forEach((addr) => {
          newAddresses.add(addr.address);
        });
      });
    }
  });

  // Get addresses to track
  const addressesToTrack = [...newAddresses].filter(
    (addr) => !trackedAddresses.has(addr)
  );

  // Get addresses to untrack
  const addressesToUntrack = [...trackedAddresses].filter(
    (addr) => !newAddresses.has(addr)
  );

  // Update tracking
  if (addressesToTrack.length > 0) {
    addressesToTrack.forEach((address) => {
      logger.info(`Tracking address: ${address}`);
      const result = mempoolClient.bitcoin.websocket.wsTrackAddress(
        ws,
        address
      );
      if (result) {
        trackedAddresses.add(address);
        logger.success(`Successfully tracking address: ${address}`);
      } else {
        logger.error(`Failed to track address ${address}`);
      }
    });
  }

  if (addressesToUntrack.length > 0) {
    addressesToUntrack.forEach((address) => {
      logger.info(`Untracking address: ${address}`);
      const result = mempoolClient.bitcoin.websocket.wsStopTrackingAddress(
        ws,
        address
      );
      if (result) {
        trackedAddresses.delete(address);
        logger.success(`Successfully untracked address: ${address}`);
      } else {
        logger.error(`Failed to untrack address ${address}`);
      }
    });
  }

  return true;
};

const calculateAddressBalance = (transactions, address) => {
  const inAmount = transactions.reduce((sum, tx) => {
    return (
      sum +
      (tx.vout?.reduce((voutSum, output) => {
        return (
          voutSum + (output.scriptpubkey_address === address ? output.value : 0)
        );
      }, 0) || 0)
    );
  }, 0);

  const outAmount = transactions.reduce((sum, tx) => {
    return (
      sum +
      (tx.vin?.reduce((vinSum, input) => {
        return (
          vinSum +
          (input.prevout?.scriptpubkey_address === address
            ? input.prevout.value
            : 0)
        );
      }, 0) || 0)
    );
  }, 0);

  return { in: inAmount, out: outAmount };
};

const updateAddressBalance = async (address, balance, io) => {
  // Find the address in our collections
  for (const [collectionName, collection] of Object.entries(
    memory.db.collections
  )) {
    // Check regular addresses
    const addr = collection.addresses.find((a) => a.address === address);
    if (addr) {
      const balanceChanged = await checkAddressBalance(addr, balance);
      if (balanceChanged) {
        const changes = detectBalanceChanges(
          address,
          balance,
          collectionName,
          addr.name
        );
        if (changes) {
          // Emit update for this address
          io.emit("updateState", { collections: memory.db.collections });
          // Notify via telegram if needed
          telegram.notifyBalanceChange(
            address,
            changes,
            collectionName,
            addr.name
          );
        }
      }
      return true;
    }

    // Check extended key addresses
    if (collection.extendedKeys) {
      for (const extendedKey of collection.extendedKeys) {
        const addr = extendedKey.addresses.find((a) => a.address === address);
        if (addr) {
          const balanceChanged = await checkAddressBalance(addr, balance);
          if (balanceChanged) {
            const changes = detectBalanceChanges(
              address,
              balance,
              collectionName,
              addr.name
            );
            if (changes) {
              // Check gap limit if balance changed
              const needsMoreAddresses = await checkAndUpdateGapLimit(
                extendedKey
              );
              if (needsMoreAddresses) {
                // Derive more addresses
                const newAddresses = await deriveExtendedKeyAddresses(
                  extendedKey.key,
                  extendedKey.addresses.length,
                  extendedKey.gapLimit,
                  extendedKey.derivationPath
                );

                if (newAddresses) {
                  // Add new addresses to extended key
                  extendedKey.addresses = [
                    ...extendedKey.addresses,
                    ...newAddresses.map((addr) => ({
                      address: addr.address,
                      name: `${extendedKey.name} ${addr.index}`,
                      index: addr.index,
                      expect: {
                        chain_in: 0,
                        chain_out: 0,
                        mempool_in: 0,
                        mempool_out: 0,
                      },
                      monitor: {
                        chain_in: "auto-accept",
                        chain_out: "alert",
                        mempool_in: "auto-accept",
                        mempool_out: "alert",
                      },
                      actual: null,
                      error: false,
                      errorMessage: null,
                    })),
                  ];

                  // Update tracked addresses with new ones
                  updateTrackedAddresses();
                }
              }

              // Emit update for this address
              io.emit("updateState", { collections: memory.db.collections });
              // Notify via telegram if needed
              telegram.notifyBalanceChange(
                address,
                changes,
                collectionName,
                addr.name
              );
            }
          }
          return true;
        }
      }
    }

    // Check descriptor addresses
    if (collection.descriptors) {
      for (const descriptor of collection.descriptors) {
        const addr = descriptor.addresses.find((a) => a.address === address);
        if (addr) {
          const balanceChanged = await checkAddressBalance(addr, balance);
          if (balanceChanged) {
            const changes = detectBalanceChanges(
              address,
              balance,
              collectionName,
              addr.name
            );
            if (changes) {
              // Check gap limit if balance changed
              const needsMoreAddresses = await checkAndUpdateGapLimit(
                descriptor
              );
              if (needsMoreAddresses) {
                // Derive more addresses
                const result = await deriveAddresses(
                  descriptor.descriptor,
                  descriptor.addresses.length,
                  descriptor.gapLimit,
                  descriptor.skip || 0
                );

                if (result.success) {
                  // Add new addresses to descriptor
                  descriptor.addresses = [
                    ...descriptor.addresses,
                    ...result.data.map((addr) => ({
                      address: addr.address,
                      name: `${descriptor.name} ${addr.index}`,
                      index: addr.index,
                      expect: {
                        chain_in: 0,
                        chain_out: 0,
                        mempool_in: 0,
                        mempool_out: 0,
                      },
                      monitor: {
                        chain_in: "auto-accept",
                        chain_out: "alert",
                        mempool_in: "auto-accept",
                        mempool_out: "alert",
                      },
                      actual: null,
                      error: false,
                      errorMessage: null,
                    })),
                  ];

                  // Update tracked addresses with new ones
                  updateTrackedAddresses();
                }
              }

              // Emit update for this address
              io.emit("updateState", { collections: memory.db.collections });
              // Notify via telegram if needed
              telegram.notifyBalanceChange(
                address,
                changes,
                collectionName,
                addr.name
              );
            }
          }
          return true;
        }
      }
    }
  }
  return false;
};

const processTransaction = (tx, io) => {
  if (!tx || typeof tx !== "object") return;

  // Check inputs and outputs for tracked addresses
  const relevantAddresses = new Set();

  // Check inputs
  if (Array.isArray(tx.vin)) {
    tx.vin.forEach((input) => {
      if (
        input?.prevout?.scriptpubkey_address &&
        trackedAddresses.has(input.prevout.scriptpubkey_address)
      ) {
        relevantAddresses.add(input.prevout.scriptpubkey_address);
      }
    });
  }

  // Check outputs
  if (Array.isArray(tx.vout)) {
    tx.vout.forEach((output) => {
      if (
        output?.scriptpubkey_address &&
        trackedAddresses.has(output.scriptpubkey_address)
      ) {
        relevantAddresses.add(output.scriptpubkey_address);
      }
    });
  }

  // If we found relevant addresses, update their balances
  if (relevantAddresses.size > 0) {
    logger.info(
      `Found transaction affecting ${relevantAddresses.size} tracked addresses`
    );

    // Update each affected address
    for (const address of relevantAddresses) {
      const mempoolBalance = calculateAddressBalance([tx], address);
      const changes = updateAddressBalance(
        address,
        {
          mempool_in: mempoolBalance.in,
          mempool_out: mempoolBalance.out,
        },
        io
      );

      // If changes were detected and require alerting, notify via Telegram
      if (changes) {
        // Find the address in our collections to get its name and collection
        for (const [collectionName, collection] of Object.entries(
          memory.db.collections
        )) {
          const addr = collection.addresses.find((a) => a.address === address);
          if (addr) {
            telegram.notifyBalanceChange(
              address,
              changes,
              collectionName,
              addr.name
            );
            break;
          }
        }
      }
    }
  }
};

const updateWebSocketState = (io, state) => {
  logger.info(`Updating WebSocket state to: ${state}`);
  memory.state.websocketState = state;
  // Emit to all connected clients immediately
  io.emit("updateState", {
    collections: memory.db.collections,
    websocketState: state,
  });
};

const setupWebSocket = (io) => {
  if (isConnecting) {
    logger.warning("Already attempting to connect, skipping...");
    return false;
  }

  isConnecting = true;
  isReady = false;
  logger.info("Setting up new websocket connection...");
  updateWebSocketState(io, "CONNECTING");

  let connectionTimeout;
  let cleanup = () => {
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
    }
    if (ws) {
      ws.removeAllListeners();
    }
    isConnecting = false;
    isReady = false;
  };

  logger.info("Creating new mempool websocket...");
  ws = mempoolClient.bitcoin.websocket.wsInit();
  if (!ws) {
    logger.error("Failed to create websocket");
    cleanup();
    updateWebSocketState(io, "ERROR");
    handleDisconnect(io);
    return false;
  }

  logger.success(`Websocket created, initial state: ${getWebSocketState(ws)}`);

  // Add error handler before any other operations
  ws.on("error", (error) => {
    logger.error(`WebSocket error during setup: ${error.message}`);
    cleanup();
    updateWebSocketState(io, "ERROR");
    handleDisconnect(io);
  });

  // Add connection timeout
  connectionTimeout = setTimeout(() => {
    if (ws && ws.readyState !== 1) {
      // 1 = OPEN
      logger.error("WebSocket connection timeout - no open event received");
      cleanup();
      handleDisconnect(io);
    }
  }, 10000); // 10 second timeout

  ws.addEventListener("open", async () => {
    clearTimeout(connectionTimeout);
    logger.success(
      `Connected to mempool.space WebSocket (state: ${getWebSocketState(ws)})`
    );
    isConnecting = false;
    reconnectAttempts = 0;
    updateWebSocketState(io, "CONNECTED");
  });

  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (!data) {
      logger.error("Failed to parse websocket message");
      return;
    }

    const messageType = Object.keys(data)[0];
    logger.info(`Received websocket message: ${messageType}`);

    // Handle mempoolInfo message - this indicates the connection is ready
    if (data.mempoolInfo) {
      logger.info(`Received mempool info, connection is ready`);
      isReady = true;
      // Update tracked addresses now that connection is ready
      updateTrackedAddresses();
      return;
    }

    // Handle track-addresses-error message
    if (data["track-addresses-error"]) {
      logger.error(
        `Error tracking addresses: ${data["track-addresses-error"]}`
      );
      return;
    }

    // Only process other messages if we're ready
    if (!isReady) {
      logger.warning(
        `Ignoring message before connection is ready (state: ${getWebSocketState(
          ws
        )})`
      );
      return;
    }

    // Handle multi-address-transactions response after track-addresses
    if (data["multi-address-transactions"]) {
      const addressData = data["multi-address-transactions"];
      logger.mempool(
        `Processing transactions for ${
          Object.keys(addressData).length
        } addresses`
      );

      // Process each address's transactions
      for (const [address, txData] of Object.entries(addressData)) {
        if (!txData) continue;
        logger.mempool(`Processing transactions for address: ${address}`);

        // Calculate chain (confirmed) transactions
        const chainBalance = calculateAddressBalance(
          txData.confirmed || [],
          address
        );

        // Calculate mempool transactions
        const mempoolBalance = calculateAddressBalance(
          txData.mempool || [],
          address
        );

        // Update the address with both chain and mempool values
        updateAddressBalance(
          address,
          {
            chain_in: chainBalance.in,
            chain_out: chainBalance.out,
            mempool_in: mempoolBalance.in,
            mempool_out: mempoolBalance.out,
          },
          io
        );
      }
      return;
    }

    // Handle block updates
    if (data.block) {
      logger.block(`New block: ${JSON.stringify(data.block)}`);
      io.emit("updateState", { collections: memory.db.collections });
      return;
    }

    // Handle mempool updates
    if (data.transactions) {
      logger.mempool(`Processing ${data.transactions.length} new transactions`);
      data.transactions.forEach((tx) => processTransaction(tx, io));
      return;
    }

    // Log any unhandled message types
    logger.debug(`ignoring message type: ${messageType}`);
  });

  ws.addEventListener("error", (error) => {
    cleanup();
    logger.error(`Mempool WebSocket error: ${error.message}`);
    logger.error(`Error details:`, error);
    logger.error(`Websocket state at error: ${getWebSocketState(ws)}`);
    updateWebSocketState(io, "ERROR");
    handleDisconnect(io);
  });

  ws.addEventListener("close", (event) => {
    cleanup();
    logger.websocket(
      `Mempool WebSocket connection closed (code: ${event.code}, reason: ${event.reason})`
    );
    logger.websocket(`Final websocket state: ${getWebSocketState(ws)}`);
    updateWebSocketState(io, "DISCONNECTED");
    handleDisconnect(io);
  });

  return true;
};

const handleDisconnect = (io) => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error("Max reconnection attempts reached. Giving up.");
    return;
  }

  // Only increment reconnect attempts if we're not already connecting
  if (!isConnecting) {
    reconnectAttempts++;
    logger.info(
      `Attempting to reconnect (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
    );
  }

  trackedAddresses.clear(); // Clear tracked addresses to force resubscription

  // Only schedule a new connection if we're not already connecting
  if (!isConnecting) {
    setTimeout(() => {
      setupWebSocket(io);
    }, RECONNECT_DELAY);
  }
};

const init = async (io) => {
  if (!io) {
    logger.error("Socket.io instance not provided to mempool module");
    return null;
  }

  logger.info("Initializing mempool client...");

  // Parse the API URL from the database configuration
  const apiUrl = new URL(memory.db.api);
  const hostname = apiUrl.hostname + (apiUrl.port ? `:${apiUrl.port}` : "");
  const protocol = apiUrl.protocol === "https:" ? "wss" : "ws";

  // Construct and log the full WebSocket URL
  const wsUrl = `${protocol}://${hostname}/api/v1/ws`;
  logger.network(`Mempool websocket: ${wsUrl}`);

  mempoolClient = mempoolJS({
    hostname,
    network: "bitcoin",
    protocol,
  });

  if (!mempoolClient) {
    logger.error("Failed to initialize mempool client");
    return null;
  }

  const wsSetupResult = setupWebSocket(io);
  if (!wsSetupResult) {
    logger.error("Failed to setup websocket");
    return null;
  }

  // Update tracked addresses when collections change
  io.on("updateState", () => {
    updateTrackedAddresses();
  });

  return mempoolClient;
};

export default init;
