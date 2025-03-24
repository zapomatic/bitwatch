import mempoolJS from "@mempool/mempool.js";
import memory from "./memory.js";

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
    console.log("⚠️ Cannot update tracked addresses - no websocket connection");
    return;
  }

  if (ws.readyState !== 1) {
    console.log(
      `⚠️ Cannot update tracked addresses - websocket not open (state: ${getWebSocketState(
        ws
      )})`
    );
    return;
  }

  if (!isReady) {
    console.log("⚠️ Cannot update tracked addresses - connection not ready");
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
    try {
      console.log(
        `📡 Attempting to track ${addressesToTrack.length} new addresses`
      );
      mempoolClient.bitcoin.websocket.wsTrackAddresses(ws, addressesToTrack);
      addressesToTrack.forEach((addr) => trackedAddresses.add(addr));
      console.log(
        `✅ Successfully tracking ${addressesToTrack.length} new addresses`
      );
    } catch (error) {
      console.error("❌ Error tracking addresses:", error);
      console.error("❌ Error details:", error);
    }
  }

  if (addressesToUntrack.length > 0) {
    try {
      console.log(
        `📡 Attempting to untrack ${addressesToUntrack.length} addresses`
      );
      mempoolClient.bitcoin.websocket.wsStopTrackingAddresses(
        ws,
        addressesToUntrack
      );
      addressesToUntrack.forEach((addr) => trackedAddresses.delete(addr));
      console.log(
        `✅ Successfully untracked ${addressesToUntrack.length} addresses`
      );
    } catch (error) {
      console.error("❌ Error untracking addresses:", error);
      console.error("❌ Error details:", error);
    }
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
  for (const collection of Object.values(memory.db.collections)) {
    const addr = collection.addresses.find((a) => a.address === address);
    if (addr) {
      addr.actual = {
        ...addr.actual,
        ...balance,
      };
      // Emit update for this address
      io.emit("updateState", { collections: memory.db.collections });
      return true;
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
    console.log(
      `🔔 Found transaction affecting ${relevantAddresses.size} tracked addresses`
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

const setupWebSocket = (io) => {
  if (isConnecting) {
    console.log("⚠️ Already attempting to connect, skipping...");
    return;
  }

  isConnecting = true;
  isReady = false;
  console.log("🔄 Setting up new websocket connection...");

  try {
    console.log("🔄 Creating new mempool websocket...");
    ws = mempoolClient.bitcoin.websocket.wsInit();
    console.log(
      `✅ Websocket created, initial state: ${getWebSocketState(ws)}`
    );

    // Wait for the websocket to be fully established
    const waitForConnection = () => {
      return new Promise((resolve) => {
        if (ws.readyState === 1) {
          resolve();
        } else {
          const checkConnection = () => {
            if (ws.readyState === 1) {
              ws.removeEventListener("open", checkConnection);
              resolve();
            }
          };
          ws.addEventListener("open", checkConnection);
        }
      });
    };

    ws.addEventListener("open", async () => {
      console.log(
        `✅ Connected to mempool.space WebSocket (state: ${getWebSocketState(
          ws
        )})`
      );
      isConnecting = false;
      reconnectAttempts = 0; // Reset reconnect attempts on successful connection

      try {
        // Wait for connection to be fully established
        await waitForConnection();
        console.log(
          `✅ Websocket fully established (state: ${getWebSocketState(ws)})`
        );

        // Subscribe to data
        console.log(
          `📡 Attempting to subscribe to mempool data (state: ${getWebSocketState(
            ws
          )})`
        );

        // Wait a moment before updating tracked addresses
        setTimeout(() => {
          console.log(
            "🔄 Resubscribing to tracked addresses after reconnection..."
          );
          updateTrackedAddresses();
        }, 1000);
      } catch (error) {
        console.error(`❌ Error during websocket setup: ${error.message}`);
        console.error(`❌ Error details:`, error);
      }
    });

    ws.addEventListener("message", (event) => {
      try {
        const res = JSON.parse(event.data);
        const messageType = Object.keys(res)[0];
        console.log(
          `📥 Received websocket message: ${messageType} (state: ${getWebSocketState(
            ws
          )})`
        );

        // Handle mempoolInfo message - this indicates the connection is ready
        if (res.mempoolInfo) {
          console.log(
            `ℹ️  Received mempool info (state: ${getWebSocketState(ws)})`
          );
          isReady = true;
        }

        // Only process other messages if we're ready
        if (!isReady) {
          console.log(
            `⚠️ Ignoring message before connection is ready (state: ${getWebSocketState(
              ws
            )})`
          );
          return;
        }

        // Handle multi-address-transactions response after track-addresses
        if (res["multi-address-transactions"]) {
          const addressData = res["multi-address-transactions"];
          console.log(
            `✅ Processing transactions for ${
              Object.keys(addressData).length
            } addresses`
          );

          // Process each address's transactions
          for (const [address, data] of Object.entries(addressData)) {
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
          console.log(`📦 New block: ${JSON.stringify(res.block)}`);
          io.emit("updateState", { collections: memory.db.collections });
          return;
        }

        // Handle mempool updates
        if (res.transactions) {
          console.log(
            `📝 Processing ${res.transactions.length} new transactions`
          );
          res.transactions.forEach((tx) => processTransaction(tx, io));
          return;
        }

        // Log any unhandled message types
        // console.log(`⚠️ Unhandled message type: ${messageType}`);
      } catch (error) {
        console.error(
          `❌ Error processing websocket message: ${error.message}`
        );
        console.error(`❌ Error details:`, error);
      }
    });

    ws.addEventListener("error", (error) => {
      console.error(`❌ Mempool WebSocket error: ${error.message}`);
      console.error(`❌ Error details:`, error);
      console.error(`❌ Websocket state at error: ${getWebSocketState(ws)}`);
      isConnecting = false;
      isReady = false;
      handleDisconnect(io);
    });

    ws.addEventListener("close", (event) => {
      console.log(
        `🔌 Mempool WebSocket connection closed (code: ${event.code}, reason: ${event.reason})`
      );
      console.log(`🔌 Final websocket state: ${getWebSocketState(ws)}`);
      isConnecting = false;
      isReady = false;
      handleDisconnect(io);
    });
  } catch (error) {
    console.error("❌ Error setting up websocket:", error);
    console.error("❌ Error details:", error);
    isConnecting = false;
    isReady = false;
    handleDisconnect(io);
  }
};

const handleDisconnect = (io) => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error("❌ Max reconnection attempts reached. Giving up.");
    return;
  }

  reconnectAttempts++;
  console.log(
    `🔄 Attempting to reconnect (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
  );

  trackedAddresses.clear(); // Clear tracked addresses to force resubscription

  setTimeout(() => {
    setupWebSocket(io);
  }, RECONNECT_DELAY);
};

const init = async (io) => {
  if (!io) {
    console.error("❌ Socket.io instance not provided to mempool module");
    return null;
  }

  console.log("🔄 Initializing mempool client...");

  try {
    // Parse the API URL from the database configuration
    const apiUrl = new URL(memory.db.api);
    const hostname = apiUrl.hostname;
    const protocol = apiUrl.protocol === "https:" ? "wss" : "ws";

    console.log(`🔌 Using mempool API: ${hostname} (${protocol})`);

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
    console.error("❌ Failed to initialize mempool client:", error);
    return null;
  }
};

export default init;
