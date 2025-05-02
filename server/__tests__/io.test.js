const ioClient = require("socket.io-client");
const { createTestServer } = require("./setup");

describe("Socket Handlers", () => {
  let socket;
  let testServer;

  beforeAll(async () => {
    testServer = await createTestServer();
  }, 30000);

  afterAll(async () => {
    if (testServer) {
      await testServer.close();
    }
  }, 30000);

  beforeEach((done) => {
    // Create a new socket connection for each test
    socket = ioClient(testServer.url, {
      forceNew: true,
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      done();
    });

    socket.on("error", (error) => {
      done(error);
    });
  });

  afterEach((done) => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    done();
  });

  describe("addDescriptor", () => {
    test("should add a new descriptor to a collection", (done) => {
      const testData = {
        collection: "test-collection",
        name: "test-descriptor",
        descriptor: "wpkh([fingerprint/84h/1h/0h]xpub.../0/*)",
        gapLimit: 20,
      };

      socket.emit("addDescriptor", testData, (response) => {
        expect(response.success).toBe(true);
        done();
      });
    });

    test("should handle missing required fields", (done) => {
      const testData = {
        collection: "test-collection",
        // Missing name and descriptor
      };

      socket.emit("addDescriptor", testData, (response) => {
        expect(response.success).toBe(false);
        expect(response.error).toBe("Missing required fields");
        done();
      });
    });
  });

  describe("editDescriptor", () => {
    test("should edit an existing descriptor", (done) => {
      const testData = {
        collection: "test-collection",
        name: "updated-descriptor",
        descriptor: "wpkh([fingerprint/84h/1h/0h]xpub.../0/*)",
        descriptorIndex: 0,
        gapLimit: 30,
        skip: 0,
        initialAddresses: 20,
      };

      socket.emit("editDescriptor", testData, (response) => {
        expect(response.success).toBe(true);
        done();
      });
    });

    test("should handle missing required fields", (done) => {
      const testData = {
        collection: "test-collection",
        // Missing name, descriptor, and descriptorIndex
      };

      socket.emit("editDescriptor", testData, (response) => {
        expect(response.success).toBe(false);
        expect(response.error).toBe("Missing required fields");
        done();
      });
    });
  });

  describe("checkGapLimit", () => {
    test("should return gap limit information", (done) => {
      const testData = {
        collection: "test-collection",
        descriptorIndex: 0,
      };

      socket.emit("checkGapLimit", testData, (response) => {
        expect(response.lastUsedIndex).toBeDefined();
        expect(response.emptyCount).toBeDefined();
        done();
      });
    });

    test("should handle failed address derivation for gap limit check", (done) => {
      const testData = {
        collection: "test-collection",
        descriptorIndex: 0,
      };

      socket.emit("checkGapLimit", testData, (response) => {
        expect(response.lastUsedIndex).toBe(0);
        expect(response.emptyCount).toBe(1);
        done();
      });
    });
  });
});
