import { jest } from "@jest/globals";
import socketIO from "../io.js";
import memory from "../memory.js";
import logger from "../logger.js";

// Mock dependencies
jest.mock("../memory.js", () => ({
  db: {
    collections: {},
    saveDb: jest.fn(),
  },
  state: {
    apiState: "?",
    websocketState: "CONNECTED",
  },
}));

jest.mock("../logger.js", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  success: jest.fn(),
  debug: jest.fn(),
}));

describe("Socket.IO Handlers", () => {
  let mockSocket;
  let mockIO;

  beforeEach(() => {
    // Reset memory state
    memory.db.collections = {};
    memory.state.apiState = "?";
    memory.state.websocketState = "CONNECTED";

    // Create mock socket and io
    mockSocket = {
      id: "test-socket-id",
      handshake: {
        address: "127.0.0.1",
      },
      emit: jest.fn(),
      on: jest.fn(),
    };

    mockIO = {
      emit: jest.fn(),
    };

    // Initialize socketIO
    socketIO.io = mockIO;
  });

  describe("add handler", () => {
    it("should add a new collection", (done) => {
      const cb = (response) => {
        expect(response.status).toBe("ok");
        expect(memory.db.collections["test-collection"]).toBeDefined();
        expect(memory.db.collections["test-collection"].addresses).toEqual([]);
        expect(memory.db.collections["test-collection"].extendedKeys).toEqual(
          []
        );
        expect(memory.db.collections["test-collection"].descriptors).toEqual(
          []
        );
        expect(memory.saveDb).toHaveBeenCalled();
        expect(mockIO.emit).toHaveBeenCalledWith("updateState", {
          collections: memory.db.collections,
        });
        done();
      };

      const handlers = socketIO.io.on("connection", mockSocket);
      handlers.add({ collection: "test-collection" }, cb);
    });

    it("should not add a duplicate collection", (done) => {
      memory.db.collections["test-collection"] = {
        addresses: [],
        extendedKeys: [],
        descriptors: [],
      };

      const cb = (response) => {
        expect(response.error).toBe("Collection already exists");
        expect(memory.saveDb).not.toHaveBeenCalled();
        expect(mockIO.emit).not.toHaveBeenCalled();
        done();
      };

      const handlers = socketIO.io.on("connection", mockSocket);
      handlers.add({ collection: "test-collection" }, cb);
    });

    it("should add a new address to a collection", (done) => {
      memory.db.collections["test-collection"] = {
        addresses: [],
        extendedKeys: [],
        descriptors: [],
      };

      const cb = (response) => {
        expect(response.status).toBe("ok");
        expect(response.record).toBe(true);
        expect(memory.db.collections["test-collection"].addresses).toHaveLength(
          1
        );
        expect(memory.db.collections["test-collection"].addresses[0]).toEqual({
          address: "bc1test",
          name: "Test Address",
          expect: {
            chain_in: 0,
            chain_out: 0,
            mempool_in: 0,
            mempool_out: 0,
          },
          monitor: {
            chain_in: "auto-accept",
            chain_out: "alert",
            mempool_in: "auto-accept",
            mempool_out: "alert",
          },
          actual: null,
          error: false,
          errorMessage: null,
        });
        expect(memory.saveDb).toHaveBeenCalled();
        expect(mockIO.emit).toHaveBeenCalledWith("updateState", {
          collections: memory.db.collections,
        });
        done();
      };

      const handlers = socketIO.io.on("connection", mockSocket);
      handlers.add(
        {
          collection: "test-collection",
          name: "Test Address",
          address: "bc1test",
        },
        cb
      );
    });

    it("should not add a duplicate address", (done) => {
      memory.db.collections["test-collection"] = {
        addresses: [
          {
            address: "bc1test",
            name: "Test Address",
            expect: {
              chain_in: 0,
              chain_out: 0,
              mempool_in: 0,
              mempool_out: 0,
            },
            monitor: {
              chain_in: "auto-accept",
              chain_out: "alert",
              mempool_in: "auto-accept",
              mempool_out: "alert",
            },
            actual: null,
            error: false,
            errorMessage: null,
          },
        ],
        extendedKeys: [],
        descriptors: [],
      };

      const cb = (response) => {
        expect(response.error).toBe(
          "Address already exists in this collection"
        );
        expect(memory.saveDb).not.toHaveBeenCalled();
        expect(mockIO.emit).not.toHaveBeenCalled();
        done();
      };

      const handlers = socketIO.io.on("connection", mockSocket);
      handlers.add(
        {
          collection: "test-collection",
          name: "Test Address",
          address: "bc1test",
        },
        cb
      );
    });

    it("should not add an address to a non-existent collection", (done) => {
      const cb = (response) => {
        expect(response.error).toBe("Collection not found");
        expect(memory.saveDb).not.toHaveBeenCalled();
        expect(mockIO.emit).not.toHaveBeenCalled();
        done();
      };

      const handlers = socketIO.io.on("connection", mockSocket);
      handlers.add(
        {
          collection: "test-collection",
          name: "Test Address",
          address: "bc1test",
        },
        cb
      );
    });
  });
});
