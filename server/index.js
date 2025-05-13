"use strict";

import express from "express";
import cors from "cors";
import http from "http";
import engine from "./engine.js";
import socketIO from "./io/index.js";
import memory from "./memory.js";
import mempool from "./mempool.js";
import telegram from "./telegram.js";
import logger from "./logger.js";

const app = express();
const server = http.createServer(app);
app.use((req, res, next) => {
  return cors({
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    methods: "GET,PUT,POST",
    origin: req.headers.origin,
    exposedHeaders: ["Content-Type"],
  })(req, res, next);
});

// Add specific CORS headers for manifest.json
app.get("/manifest.json", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  next();
});

app.use(express.static(memory.dirUI));

// Add catch-all route for client-side routing
app.get("/{*any}", (req, res) => {
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

  engine();

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
