const { createServer } = require("http");
const { Server: SocketServer } = require("socket.io");
const socketIO = require("../io.js");

// Mock dependencies
jest.mock("../memory.js", () => ({
  default: {
    db: {
      collections: {},
      saveDb: jest.fn(),
    },
    saveDb: jest.fn(),
  },
}));

// Mock logger with all required methods
jest.mock("../logger.js", () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    websocket: jest.fn(),
    processing: jest.fn(),
    scan: jest.fn(),
  };
  return {
    default: mockLogger,
  };
});

// Test server configuration
const TEST_PORT = 0; // Using 0 lets the OS assign an available port

// Create test server instance
const createTestServer = () => {
  const httpServer = createServer();
  const io = new SocketServer(httpServer, {
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

  io.on("connection", function (socket) {
    const socketID = socket.id;
    const ip = socket.handshake.address.replace("::ffff:", "");
    console.log(`Socket connected from ${ip} (ID: ${socketID})`);

    // Send initial state on connection
    socket.emit("updateState", { collections: {} });

    const handlers = {
      client: async (data, cb) => {
        cb({
          version: "1.6.0",
          collections: {},
          websocketState: "CONNECTED",
          apiState: "GOOD",
          interval: 60000,
        });
      },

      addDescriptor: async (data, cb) => {
        if (!data.collection || !data.name || !data.descriptor) {
          return cb({ success: false, error: "Missing required fields" });
        }

        // Create collection if it doesn't exist
        const memory = require("../memory.js").default;
        if (!memory.db.collections[data.collection]) {
          memory.db.collections[data.collection] = {
            addresses: [],
            extendedKeys: [],
            descriptors: [],
          };
        }

        // Check if descriptor already exists
        const collection = memory.db.collections[data.collection];
        if (collection.descriptors.some((d) => d.name === data.name)) {
          return cb({
            success: false,
            error: "Descriptor with this name already exists",
          });
        }

        // Add descriptor to collection
        collection.descriptors.push({
          name: data.name,
          descriptor: data.descriptor,
          gapLimit: data.gapLimit,
          addresses: [],
        });

        memory.saveDb();
        io.emit("updateState", { collections: memory.db.collections });
        return cb({ success: true });
      },

      editDescriptor: async (data, cb) => {
        if (
          !data.collection ||
          !data.name ||
          !data.descriptor ||
          data.descriptorIndex === undefined
        ) {
          return cb({ success: false, error: "Missing required fields" });
        }

        const memory = require("../memory.js").default;
        const collection = memory.db.collections[data.collection];
        if (!collection || !collection.descriptors[data.descriptorIndex]) {
          return cb({ success: false, error: "Descriptor not found" });
        }

        // Update the descriptor
        collection.descriptors[data.descriptorIndex] = {
          ...collection.descriptors[data.descriptorIndex],
          descriptor: data.descriptor,
          gapLimit: parseInt(data.gapLimit),
          name: data.name,
          skip: parseInt(data.skip),
          initialAddresses: parseInt(data.initialAddresses),
          addresses: [],
        };

        memory.saveDb();
        io.emit("updateState", { collections: memory.db.collections });
        return cb({ success: true });
      },

      checkGapLimit: async (data, cb) => {
        return cb({
          lastUsedIndex: 0,
          emptyCount: 1,
        });
      },
    };

    // Register handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });
  });

  return new Promise((resolve) => {
    const server = httpServer.listen(TEST_PORT, () => {
      const { port } = server.address();
      resolve({
        server,
        io,
        port,
        url: `http://localhost:${port}`,
        close: () => {
          return new Promise((resolve) => {
            server.close(() => {
              resolve();
            });
          });
        },
      });
    });
  });
};

module.exports = {
  createTestServer,
};
