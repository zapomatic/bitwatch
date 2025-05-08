// mock mempool.space api + websocket server

import { WebSocketServer } from "ws";
import http from "http";
import { URL } from "url";

// State
let wss = null;
let httpServer = null;
let clients = new Set();
let trackedAddresses = new Set();
let addressBalances = new Map();
let addressStates = new Map(); // Track state of each address
let addressCheckCounts = new Map(); // Track number of checks per address

const ADDRESS_STATES = {
  INITIAL: "initial",
  MEMPOOL_IN: "mempool_in",
  CHAIN_IN: "chain_in",
  MEMPOOL_OUT: "mempool_out",
  CHAIN_OUT: "chain_out",
};

const log = (level, message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
};

// Helper function to get next state
const getNextState = (currentState) => {
  const states = Object.values(ADDRESS_STATES);
  const currentIndex = states.indexOf(currentState);
  // If we're at the last state, stay there instead of cycling
  if (currentIndex === states.length - 1) {
    return currentState;
  }
  return states[(currentIndex + 1) % states.length];
};

// Helper function to get balance based on state
const getBalanceForState = (state) => {
  switch (state) {
    case ADDRESS_STATES.INITIAL:
      return {
        chain_stats: {
          funded_txo_count: 0,
          funded_txo_sum: 0,
          spent_txo_count: 0,
          spent_txo_sum: 0,
        },
        mempool_stats: {
          funded_txo_count: 0,
          funded_txo_sum: 0,
          spent_txo_count: 0,
          spent_txo_sum: 0,
        },
      };
    case ADDRESS_STATES.MEMPOOL_IN:
      return {
        chain_stats: {
          funded_txo_count: 0,
          funded_txo_sum: 0,
          spent_txo_count: 0,
          spent_txo_sum: 0,
        },
        mempool_stats: {
          funded_txo_count: 1,
          funded_txo_sum: 10000,
          spent_txo_count: 0,
          spent_txo_sum: 0,
        },
      };
    case ADDRESS_STATES.CHAIN_IN:
      return {
        chain_stats: {
          funded_txo_count: 1,
          funded_txo_sum: 10000,
          spent_txo_count: 0,
          spent_txo_sum: 0,
        },
        mempool_stats: {
          funded_txo_count: 0,
          funded_txo_sum: 0,
          spent_txo_count: 0,
          spent_txo_sum: 0,
        },
      };
    case ADDRESS_STATES.MEMPOOL_OUT:
      return {
        chain_stats: {
          funded_txo_count: 1,
          funded_txo_sum: 10000,
          spent_txo_count: 0,
          spent_txo_sum: 0,
        },
        mempool_stats: {
          funded_txo_count: 0,
          funded_txo_sum: 0,
          spent_txo_count: 1,
          spent_txo_sum: 1000,
        },
      };
    case ADDRESS_STATES.CHAIN_OUT:
    default:
      return {
        chain_stats: {
          funded_txo_count: 1,
          funded_txo_sum: 10000,
          spent_txo_count: 1,
          spent_txo_sum: 1000,
        },
        mempool_stats: {
          funded_txo_count: 0,
          funded_txo_sum: 0,
          spent_txo_count: 0,
          spent_txo_sum: 0,
        },
      };
  }
};

// WebSocket handlers
const handleWebSocketConnection = (ws) => {
  clients.add(ws);
  log("info", "New client connected to mock mempool.space API");

  // Send initial mempool info
  ws.send(
    JSON.stringify({
      mempoolInfo: {
        size: 0,
        bytes: 0,
        usage: 0,
      },
    })
  );

  // Handle messages
  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data);
      handleWebSocketMessage(ws, message);
    } catch (error) {
      log("error", `Error handling message: ${error}`);
    }
  });

  // Handle client disconnect
  ws.on("close", () => {
    clients.delete(ws);
    log("info", "Client disconnected from mock mempool.space API");
  });

  // Handle errors
  ws.on("error", (error) => {
    log("error", `WebSocket error: ${error}`);
  });
};

const handleWebSocketMessage = (ws, message) => {
  // Handle track-addresses message
  if (message["track-addresses"]) {
    const addresses = message["track-addresses"];
    addresses.forEach((address) => trackedAddresses.add(address));
    log("info", `Tracking addresses: ${addresses.join(", ")}`);

    // Send initial transactions for tracked addresses
    addresses.forEach((address) => {
      ws.send(
        JSON.stringify({
          "multi-address-transactions": {
            [address]: {
              confirmed: [],
              mempool: [],
            },
          },
        })
      );
    });
  }

  // Handle untrack-addresses message
  if (message["untrack-addresses"]) {
    const addresses = message["untrack-addresses"];
    addresses.forEach((address) => trackedAddresses.delete(address));
    log("info", `Untracking addresses: ${addresses.join(", ")}`);
  }
};

// HTTP handlers
const handleHttpRequest = (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Handle /api/address/:address endpoint
    if (url.pathname.startsWith("/api/address/")) {
      const address = url.pathname.split("/").pop();

      // Initialize state and check count if not exists
      if (!addressStates.has(address)) {
        addressStates.set(address, ADDRESS_STATES.INITIAL);
        addressCheckCounts.set(address, 0);
      }

      // Get current state and check count
      const currentState = addressStates.get(address);
      const checkCount = addressCheckCounts.get(address) + 1;
      addressCheckCounts.set(address, checkCount);

      // Get balance for current state
      const balance = getBalanceForState(currentState);
      addressBalances.set(address, balance);

      // Send response first
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(balance));

      // Only transition state if this is a refresh request (not an initial check)
      // We can tell this by checking if the address already has a balance
      if (addressBalances.has(address) && checkCount >= 1) {
        const nextState = getNextState(currentState);
        addressStates.set(address, nextState);
        addressCheckCounts.set(address, 0); // Reset check count for next state
      }

      return;
    }

    // Handle /api/v1/ws endpoint
    if (url.pathname === "/api/v1/ws") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Handle unknown endpoints
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (error) {
    log("error", `Error handling HTTP request: ${error}`);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
};

// Server lifecycle
const start = (port = 3006) => {
  try {
    // Create HTTP server
    httpServer = http.createServer(handleHttpRequest);

    // Handle HTTP server errors
    httpServer.on("error", (error) => {
      log("error", `HTTP server error: ${error}`);
    });

    // Create WebSocket server
    wss = new WebSocketServer({ server: httpServer });
    log("info", `Mock mempool.space API server started on port ${port}`);

    wss.on("connection", handleWebSocketConnection);

    // Handle WebSocket server errors
    wss.on("error", (error) => {
      log("error", `WebSocket server error: ${error}`);
    });

    // Start the server
    httpServer.listen(port, () => {
      log("info", `Server listening on port ${port}`);
    });
  } catch (error) {
    log("error", `Error starting server: ${error}`);
    throw error;
  }
};

const stop = () => {
  try {
    if (wss) {
      wss.close();
      wss = null;
    }
    if (httpServer) {
      httpServer.close();
      httpServer = null;
    }
    clients.clear();
    log("info", "Mock mempool.space API server stopped");
  } catch (error) {
    log("error", `Error stopping server: ${error}`);
    throw error;
  }
};

// Helper functions
const simulateTransaction = (tx) => {
  try {
    const relevantAddresses = new Set();

    // Check inputs
    if (Array.isArray(tx.vin)) {
      tx.vin.forEach((input) => {
        if (
          input?.prevout?.scriptpubkey_address &&
          trackedAddresses.has(input.prevout.scriptpubkey_address)
        ) {
          relevantAddresses.add(input.prevout.scriptpubkey_address);
          // Update balance for input address
          const address = input.prevout.scriptpubkey_address;
          const balance = addressBalances.get(address) || {
            chain_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
            mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
          };
          balance.mempool_stats.spent_txo_sum += input.prevout.value;
          addressBalances.set(address, balance);
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
          // Update balance for output address
          const address = output.scriptpubkey_address;
          const balance = addressBalances.get(address) || {
            chain_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
            mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
          };
          balance.mempool_stats.funded_txo_sum += output.value;
          addressBalances.set(address, balance);
        }
      });
    }

    // If we found relevant addresses, send the transaction to all clients
    if (relevantAddresses.size > 0) {
      const message = JSON.stringify({ transactions: [tx] });
      clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(message);
        }
      });
    }
  } catch (error) {
    log("error", `Error simulating transaction: ${error}`);
    throw error;
  }
};

const setAddressBalance = (address, balance) => {
  try {
    addressBalances.set(address, balance);
  } catch (error) {
    log("error", `Error setting address balance: ${error}`);
    throw error;
  }
};

const reset = () => {
  addressStates.clear();
  addressCheckCounts.clear();
  addressBalances.clear();
  trackedAddresses.clear();
  clients.clear();
};

// Start the server immediately
start(3006);

// Handle process termination
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
