// mock mempool.space api + websocket server

import { WebSocketServer } from "ws";
import http from "http";
import { URL } from "url";

// State
let wss = null;
let httpServer = null;
let clients = new Set();
let trackedAddresses = new Set();
let testResponses = new Map(); // Store test responses per address

const log = (level, message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] API Mock: ${message}`);
};

// Helper function to get default zero balance
const getZeroBalance = () => ({
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
});

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

      // Check for test response header
      const testResponse = req.headers["x-test-response"];
      log(
        "query",
        `balance check for ${address} with test response ${testResponse}`
      );
      if (testResponse) {
        log("testResponses", `${address}: ${testResponse}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(testResponse);
        return;
      }

      // If we have a stored test response for this address, return it
      if (testResponses.has(address)) {
        const response = testResponses.get(address);
        log("testResponses:reused", response);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(response);
        return;
      }

      log("zerobalance", address);
      // Otherwise return zero balance
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(getZeroBalance()));
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

const reset = () => {
  testResponses.clear();
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
