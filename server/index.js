"use strict";

import express from "express";
import cors from "cors";
import http from "http";
import engine from "./engine.js";
import socketIO from "./io.js";
import memory from "./memory.js";
import initMempool from "./mempool.js";
import telegram from "./telegram.js";

const app = express();
const server = http.createServer(app);
app.use((req, res, next) => {
  return cors({
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    methods: "GET,PUT,POST",
    origin: req.headers.origin,
  })(req, res, next);
});
app.use(express.static(memory.dirUI));

const PORT = process.env.PORT || 3117;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
  socketIO.init(server);
  telegram.init();
  engine();

  // Initialize mempool after socket.io is set up
  console.log("🔄 Initializing mempool websocket connection...");
  initMempool(socketIO.io)
    .then((ws) => {
      console.log("✅ Mempool websocket initialized");
    })
    .catch((err) => {
      console.error("❌ Failed to initialize mempool websocket:", err);
    });
});
