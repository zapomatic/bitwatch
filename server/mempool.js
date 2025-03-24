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
        // Log just the message type instead of full payload
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
          const { addresses, transactions } = res["multi-address-transactions"];
          console.log(
            `✅ Successfully initiated tracking for ${addresses.length} addresses`
          );
          if (transactions?.length > 0) {
            console.log(
              `📝 Found ${transactions.length} existing transactions for tracked addresses`
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
          console.log(`📝 Found ${res.transactions.length} transactions`);
          // Check if any of our tracked addresses are involved
          const relevantTxs = res.transactions.filter((tx) => {
            // Skip invalid transactions
            if (!tx || typeof tx !== "object") return false;

            // Check inputs
            if (Array.isArray(tx.vin)) {
              const hasRelevantInput = tx.vin.some((input) => {
                if (!input || !input.prevout) return false;
                return trackedAddresses.has(input.prevout.scriptpubkey_address);
              });
              if (hasRelevantInput) return true;
            }

            // Check outputs
            if (Array.isArray(tx.vout)) {
              const hasRelevantOutput = tx.vout.some((output) => {
                if (!output) return false;
                return trackedAddresses.has(output.scriptpubkey_address);
              });
              if (hasRelevantOutput) return true;
            }

            return false;
          });

          if (relevantTxs.length > 0) {
            console.log(`🔔 Found ${relevantTxs.length} relevant transactions`);
            io.emit("updateState", { collections: memory.db.collections });
          }
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

  // Store current tracked addresses before disconnecting
  const currentTrackedAddresses = [...trackedAddresses];
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
