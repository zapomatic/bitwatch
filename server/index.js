"use strict";

import express from "express";
import cors from "cors";
import http from "http";
import socketIO from "./io/index.js";
import memory from "./lib/memory.js";
import mempool from "./lib/mempool.js";
import telegram from "./lib/telegram.js";
import logger from "./lib/logger.js";
import runQueue from "./lib/queue/run.js";

const app = express();
const server = http.createServer(app);

// Configure CORS with more permissive settings for Umbrel
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    // Also allow all origins for Umbrel compatibility
    callback(null, true);
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  exposedHeaders: ["Content-Type"],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Add CORS headers for all static files to handle Umbrel proxy redirects
app.use((req, res, next) => {
  // Set CORS headers for all requests to handle Umbrel proxy scenarios
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.static(memory.dirUI));

// Add catch-all route for client-side routing
app.use((req, res) => {
  res.sendFile("index.html", { root: memory.dirUI });
});

const PORT = process.env.PORT || 3117;
server.listen(PORT, () => {
  logger.system(`Server listening on port ${PORT}`);
  socketIO.init(server);

  // Only initialize Telegram if not in test mode
  if (process.env.NODE_ENV !== "test") {
    telegram.init();
  }

  runQueue();

  // Initialize mempool after socket.io is set up
  logger.info("Initializing mempool websocket connection...");
  mempool
    .init(socketIO.io)
    .then((__ws) => {
      logger.success("Mempool websocket initialized");
    })
    .catch((err) => {
      logger.error("Failed to initialize mempool websocket: " + err);
    });
});
