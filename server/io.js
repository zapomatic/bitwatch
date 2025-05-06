import { Server as io } from "socket.io";
import memory from "./memory.js";
import logger from "./logger.js";
import handlers from "./ioHandlers/index.js";

const socketIO = {
  io: null,
  init: (server) => {
    if (socketIO.io) return socketIO.io;

    socketIO.io = new io(server, {
      forceNew: true,
      maxHttpBufferSize: 100e6,
      rememberUpgrade: true,
      handlePreflightRequest: function (req, res) {
        var headers = {
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Origin": req.headers.origin,
          "Access-Control-Allow-Credentials": true,
        };
        res.writeHead(200, headers);
        res.end();
      },
    });

    socketIO.io.on("connection", function (socket) {
      const socketID = socket.id;
      const ip = socket.handshake.address.replace("::ffff:", "");
      logger.websocket(`Socket connected from ${ip} (ID: ${socketID})`);

      // Send initial state on connection
      socket.emit("updateState", { collections: memory.db.collections });

      // Register handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        logger.info(`Registering handler for ${event}`);
        socket.on(event, async (data = {}, cb) => {
          const handlerData = {
            ...(data || {}),
            socketID,
            io: socketIO.io,
          };
          const result = await handler(handlerData);
          cb && cb(result);
        });
      });
    });
  },
};

export default socketIO;
