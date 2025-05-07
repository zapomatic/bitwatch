import { Server as io } from "socket.io";
import memory from "./memory.js";
import logger from "./logger.js";
import handlers from "./ioHandlers/index.js";

const socketIO = {
  io: null,
  init: (server) => {
    if (socketIO.io) return socketIO.io;

    socketIO.io = new io(server, {
      maxHttpBufferSize: 100e6,
      cors: {
        origin: true,
        credentials: true,
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
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
        logger.debug(`Registering handler for ${event}`);
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
