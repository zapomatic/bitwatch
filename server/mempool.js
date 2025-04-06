import mempoolJS from "@mempool/mempool.js";
import memory from "./memory.js";
import logger from "./logger.js";

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
    return;
  }

  if (ws.readyState !== 1) {
    logger.warning(
      `Cannot update tracked addresses - websocket not open (state: ${getWebSocketState(
        ws
      )})`
    );
    return;
  }

  if (!isReady) {
    logger.warning("Cannot update tracked addresses - connection not ready");
    return;
  }

  const newAddresses = new Set();
  Object.values(memory.db.collections).forEach((collection) => {
    collection.addresses.forEach((addr) => {
      newAddresses.add(addr.address);
    });
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
      try {
        logger.info(`Tracking address: ${address}`);
        mempoolClient.bitcoin.websocket.wsTrackAddress(ws, address);
        trackedAddresses.add(address);
        logger.success(`Successfully tracking address: ${address}`);
      } catch (error) {
        logger.error(`Error tracking address ${address}: ${error.message}`);
      }
    });
  }

  if (addressesToUntrack.length > 0) {
    addressesToUntrack.forEach((address) => {
      try {
        logger.info(`Untracking address: ${address}`);
        mempoolClient.bitcoin.websocket.wsStopTrackingAddress(ws, address);
        trackedAddresses.delete(address);
        logger.success(`Successfully untracked address: ${address}`);
      } catch (error) {
        logger.error(`Error untracking address ${address}: ${error.message}`);
      }
    });
  }
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

const updateAddressBalance = (address, balance, io) => {
  let changesDetected = false;
  for (const [collectionName, collection] of Object.entries(
    memory.db.collections
  )) {
    const addr = collection.addresses.find((a) => a.address === address);
    if (addr) {
      const oldBalance = { ...addr.actual };
      const newBalance = { ...addr.actual, ...balance };

      // Check for changes that need alerts
      const changes = {};
      const needsAlert = (type) => {
        if (!addr.monitor) return true; // Default to alert if no monitor settings
        return addr.monitor[type] === "alert";
      };

      // Always log changes, regardless of monitor setting
      if (newBalance.chain_in !== addr.expect.chain_in) {
        changes.chain_in = newBalance.chain_in;
        if (!needsAlert("chain_in")) {
          logger.info(
            `auto-accept chain_in (${newBalance.chain_in}) for ${address} (${collectionName}/${addr.name})`
          );
          addr.expect.chain_in = newBalance.chain_in;
        }
      }
      if (newBalance.chain_out !== addr.expect.chain_out) {
        changes.chain_out = newBalance.chain_out;
        if (!needsAlert("chain_out")) {
          logger.info(
            `auto-accept chain_out (${newBalance.chain_out}) for ${address} (${collectionName}/${addr.name})`
          );
          addr.expect.chain_out = newBalance.chain_out;
        }
      }
      if (newBalance.mempool_in !== addr.expect.mempool_in) {
        changes.mempool_in = newBalance.mempool_in;
        if (!needsAlert("mempool_in")) {
          logger.info(
            `auto-accept mempool_in (${newBalance.mempool_in}) for ${address} (${collectionName}/${addr.name})`
          );
          addr.expect.mempool_in = newBalance.mempool_in;
        }
      }
      if (newBalance.mempool_out !== addr.expect.mempool_out) {
        changes.mempool_out = newBalance.mempool_out;
        if (!needsAlert("mempool_out")) {
          logger.info(
            `auto-accept mempool_out (${newBalance.mempool_out}) for ${address} (${collectionName}/${addr.name})`
          );
          addr.expect.mempool_out = newBalance.mempool_out;
        }
      }

      // Update the address with new balance
      addr.actual = newBalance;

      // If there are any changes, log them and mark for save
      if (Object.keys(changes).length > 0) {
        changesDetected = true;
        logger.info(`Balance changes detected for ${address} (${collectionName}/${addr.name}):
Expected: chain_in=${addr.expect.chain_in}, chain_out=${addr.expect.chain_out}, mempool_in=${addr.expect.mempool_in}, mempool_out=${addr.expect.mempool_out}
Actual: chain_in=${newBalance.chain_in}, chain_out=${newBalance.chain_out}, mempool_in=${newBalance.mempool_in}, mempool_out=${newBalance.mempool_out}
Previous: chain_in=${oldBalance.chain_in}, chain_out=${oldBalance.chain_out}, mempool_in=${oldBalance.mempool_in}, mempool_out=${oldBalance.mempool_out}`);
      }

      // Emit update for this address
      io.emit("updateState", { collections: memory.db.collections });
      return true;
    }
  }

  // If any changes were detected, save the database
  if (changesDetected) {
    memory.saveDb();
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
      updateAddressBalance(
        address,
        {
          mempool_in: mempoolBalance.in,
          mempool_out: mempoolBalance.out,
        },
        io
      );
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
    return;
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
      // Only remove listeners if the WebSocket exists
      try {
        ws.removeAllListeners();
      } catch (error) {
        logger.warning("Error removing WebSocket listeners:", error);
      }
    }
    isConnecting = false;
    isReady = false;
  };

  try {
    logger.info("Creating new mempool websocket...");
    ws = mempoolClient.bitcoin.websocket.wsInit();
    logger.success(
      `Websocket created, initial state: ${getWebSocketState(ws)}`
    );

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
        // Don't try to close the WebSocket here, just let the error handler deal with it
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
      try {
        const res = JSON.parse(event.data);
        const messageType = Object.keys(res)[0];
        logger.info(`Received websocket message: ${messageType}`);

        // Handle mempoolInfo message - this indicates the connection is ready
        if (res.mempoolInfo) {
          logger.info(`Received mempool info, connection is ready`);
          isReady = true;
          // Update tracked addresses now that connection is ready
          updateTrackedAddresses();
        }

        // Handle track-addresses-error message
        if (res["track-addresses-error"]) {
          logger.error(
            `Error tracking addresses: ${res["track-addresses-error"]}`
          );
          // Don't mark connection as not ready, just log the error
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
        if (res["multi-address-transactions"]) {
          const addressData = res["multi-address-transactions"];
          logger.mempool(
            `Processing transactions for ${
              Object.keys(addressData).length
            } addresses`
          );

          // Process each address's transactions
          for (const [address, data] of Object.entries(addressData)) {
            logger.mempool(`Processing transactions for address: ${address}`);
            if (!data) continue;

            // Calculate chain (confirmed) transactions
            const chainBalance = calculateAddressBalance(
              data.confirmed || [],
              address
            );

            // Calculate mempool transactions
            const mempoolBalance = calculateAddressBalance(
              data.mempool || [],
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
        if (res.block) {
          logger.block(`New block: ${JSON.stringify(res.block)}`);
          io.emit("updateState", { collections: memory.db.collections });
          return;
        }

        // Handle mempool updates
        if (res.transactions) {
          logger.mempool(
            `Processing ${res.transactions.length} new transactions`
          );
          res.transactions.forEach((tx) => processTransaction(tx, io));
          return;
        }

        // Log any unhandled message types
        logger.warning(`Unhandled message type: ${messageType}`);
      } catch (error) {
        logger.error(`Error processing websocket message: ${error.message}`);
        logger.error(`Error details:`, error);
      }
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
  } catch (error) {
    cleanup();
    logger.error("Error setting up websocket:");
    logger.error("Error details:", error);
    updateWebSocketState(io, "ERROR");
    handleDisconnect(io);
  }
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

  try {
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

    setupWebSocket(io);

    // Update tracked addresses when collections change
    io.on("updateState", () => {
      updateTrackedAddresses();
    });

    return mempoolClient;
  } catch (error) {
    logger.error("Failed to initialize mempool client:");
    logger.error("Error details:", error);
    return null;
  }
};

export default init;
