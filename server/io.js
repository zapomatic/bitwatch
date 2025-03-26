import { Server as io } from "socket.io";
import pjson from "../package.json" with { type: "json" };
import memory from "./memory.js";
import getAddressBalance from "./getAddressBalance.js";
import telegram from "./telegram.js";
import engine from "./engine.js";
import fs from "fs";
import logger from "./logger.js";
// const { v4: uuidv4 } = require("uuid");

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

      socket.on("client", async (data, cb) => {
        logger.info(`Client connected (ID: ${socketID})`);
        
        // Determine initial API state based on address data
        const hasActualData = Object.values(memory.db.collections).some(col => 
          col.addresses.some(addr => addr.actual !== null)
        );
        const hasErrors = Object.values(memory.db.collections).some(col => 
          col.addresses.some(addr => addr.error)
        );
        const hasLoading = Object.values(memory.db.collections).some(col => 
          col.addresses.some(addr => addr.actual === null && !addr.error)
        );

        let apiState = "?";
        if (hasErrors) {
          apiState = "ERROR";
        } else if (hasLoading) {
          apiState = "CHECKING";
        } else if (hasActualData) {
          apiState = "GOOD";
        }

        cb({
          version: pjson.version,
          collections: memory.db.collections,
          websocketState: memory.db.websocketState || "DISCONNECTED",
          apiState: apiState,
          interval: memory.db.interval
        });
      });

      socket.on("saveExpected", async (data, cb) => {
        logger.processing(`Saving expected state for ${data.collection}/${data.address}`);
        const collection = memory.db.collections[data.collection];
        if (!collection) return cb(`collection not found`);
        const record = collection.addresses.find((a) => a.address === data.address);
        if (!record) return cb(`address not found`);
        
        // Update expect values while preserving the object structure
        // Use actual values if expect values aren't available
        record.expect = {
          chain_in: data.expect?.chain_in ?? data.actual?.chain_in ?? 0,
          chain_out: data.expect?.chain_out ?? data.actual?.chain_out ?? 0,
          mempool_in: data.expect?.mempool_in ?? data.actual?.mempool_in ?? 0,
          mempool_out: data.expect?.mempool_out ?? data.actual?.mempool_out ?? 0
        };
        
        memory.saveDb();

        // Determine API state based on address data
        const hasActualData = Object.values(memory.db.collections).some(col => 
          col.addresses.some(addr => addr.actual !== null)
        );
        const hasErrors = Object.values(memory.db.collections).some(col => 
          col.addresses.some(addr => addr.error)
        );
        const hasLoading = Object.values(memory.db.collections).some(col => 
          col.addresses.some(addr => addr.actual === null && !addr.error)
        );

        let apiState = "?";
        if (hasErrors) {
          apiState = "ERROR";
        } else if (hasLoading) {
          apiState = "CHECKING";
        } else if (hasActualData) {
          apiState = "GOOD";
        }

        // Emit state update to ALL clients
        socketIO.io.emit("updateState", {
          collections: memory.db.collections,
          apiState,
          interval: memory.db.interval
        });
        cb();
      });

      socket.on("add", async ({ collection, name, address }, cb) => {
        logger.info(`Adding ${address} to collection ${collection}`);
        // Create collection if it doesn't exist
        if (!memory.db.collections[collection]) {
          memory.db.collections[collection] = { addresses: [] };
          memory.saveDb();
          // Emit state update to ALL clients
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          return cb({ status: "ok", collection });
        }
        
        // If no address provided, just return (collection was created)
        if (!address) {
          return cb({ status: "ok" });
        }

        // Check if address exists in any collection
        for (const col of Object.values(memory.db.collections)) {
          const existing = col.addresses.find((a) => a.address === address);
          if (existing) return cb({ error: `address already exists` });
        }

        // Add the address immediately with a loading state
        const record = {
          address,
          name,
          expect: {
            chain_in: 0,
            chain_out: 0,
            mempool_in: 0,
            mempool_out: 0
          },
          actual: null,
          error: false,
          errorMessage: null
        };

        memory.db.collections[collection].addresses.push(record);
        memory.saveDb();
        // Emit state update to ALL clients
        socketIO.io.emit("updateState", {
          collections: memory.db.collections,
          apiState: "CHECKING",
          interval: memory.db.interval
        });
        cb({ status: "ok", record });

        try {
          const balance = await getAddressBalance(address);
          logger.data(`${address}: chain (in=${balance.actual.chain_in}, out=${balance.actual.chain_out}), mempool (in=${balance.actual.mempool_in}, out=${balance.actual.mempool_out})`);
          
          // Update the record with the fetched balance
          const index = memory.db.collections[collection].addresses.findIndex(a => a.address === address);
          if (index !== -1) {
            memory.db.collections[collection].addresses[index] = {
              ...record,
              actual: balance.error ? null : balance.actual,
              error: balance.error || false,
              errorMessage: balance.error ? balance.message : null
            };
            memory.saveDb();
            // Emit state update to ALL clients
            socketIO.io.emit("updateState", {
              collections: memory.db.collections,
              apiState,
              interval: memory.db.interval
            });
          }
        } catch (error) {
          logger.error(`Error adding address ${address}: ${error.message}`);
          // Update the record with the error state
          const index = memory.db.collections[collection].addresses.findIndex(a => a.address === address);
          if (index !== -1) {
            memory.db.collections[collection].addresses[index] = {
              ...record,
              actual: null,
              error: true,
              errorMessage: error.message
            };
            memory.saveDb();
            // Emit state update to ALL clients
            socketIO.io.emit("updateState", {
              collections: memory.db.collections,
              apiState: "ERROR",
              interval: memory.db.interval
            });
          }
        }
      });

      socket.on("delete", async ({ collection, address }, cb) => {
        logger.info(`Deleting ${address} from collection ${collection}`);
        const col = memory.db.collections[collection];
        if (!col) return cb({ error: `collection not found` });
        const index = col.addresses.findIndex((a) => a.address === address);
        if (index === -1) return cb({ error: `address not found` });
        col.addresses.splice(index, 1);
        // If collection is empty and not the default "Satoshi" collection, remove it
        if (col.addresses.length === 0 && collection !== "Satoshi") {
          delete memory.db.collections[collection];
        }
        memory.saveDb();
        // Emit state update to ALL clients
        socketIO.io.emit("updateState", { collections: memory.db.collections });
        cb({ status: "ok" });
      });

      socket.on('getState', async(data, cb) => {
        logger.info(`State requested by client ${socketID}`);
        cb({ 
          collections: memory.db.collections,
          interval: memory.db.interval
        });
      });

      socket.on('getConfig', async(data, cb) => {
        logger.info(`Config requested by client ${socketID}`);
        cb({ 
          interval: memory.db.interval, 
          apiParallelLimit: memory.db.apiParallelLimit, 
          api: memory.db.api 
        });
      });

      socket.on('saveConfig', async(data, cb)=>{
        logger.processing(`Saving configuration: ${JSON.stringify(data)}`);
        const oldInterval = memory.db.interval;
        memory.db.interval = data.interval || memory.db.interval;
        memory.db.apiParallelLimit = data.apiParallelLimit || memory.db.apiParallelLimit;
        memory.db.api = data.api || memory.db.api;
        memory.saveDb();

        // If interval changed, restart the engine
        if (oldInterval !== memory.db.interval) {
          logger.info(`Interval changed from ${oldInterval}ms to ${memory.db.interval}ms, restarting engine`);
          engine(); // This will start a new cycle with the new interval
        }

        // Emit state update to ALL clients
        socketIO.io.emit("updateState", {
          collections: memory.db.collections,
          interval: memory.db.interval
        });
        cb(data);
      });

      socket.on('getIntegrations', async(data, cb) => {
        logger.info(`Integrations requested by client ${socketID}`);
        cb({ telegram: memory.db.telegram || {} });
      });

      socket.on('saveIntegrations', async(data, cb) => {
        logger.processing(`Saving integrations configuration`);
        try {
          memory.db.telegram = data.telegram;
          memory.saveDb();
          telegram.init(true); // Pass true to send test message when saving
          cb({ success: true, data });
        } catch (error) {
          logger.error(`Error saving integrations: ${error.message}`);
          cb({ success: false, error: error.message });
        }
      });

      socket.on('renameCollection', async({ oldName, newName }, cb) => {
        logger.info(`Renaming collection from ${oldName} to ${newName}`);
        if (!memory.db.collections[oldName]) {
          return cb({ error: `collection not found` });
        }
        if (memory.db.collections[newName]) {
          return cb({ error: `collection with new name already exists` });
        }
        
        // Move the collection to the new name
        memory.db.collections[newName] = memory.db.collections[oldName];
        delete memory.db.collections[oldName];
        
        // Update collection name in all addresses
        memory.db.collections[newName].addresses.forEach(addr => {
          addr.collection = newName;
        });
        
        memory.saveDb();
        // Emit state update to ALL clients
        socketIO.io.emit("updateState", { collections: memory.db.collections });
        cb({ status: "ok" });
      });

      socket.on('refresh', async(data, cb) => {
        logger.info(`Manual refresh requested by client ${socketID}`);
        engine(); // Trigger immediate refresh
        cb({ status: "ok" });
      });
    });

    return socketIO.io;
  },
};
export default socketIO;
