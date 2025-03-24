import { Server as io } from "socket.io";
import pjson from "../package.json" with { type: "json" };
import memory from "./memory.js";
import getAddressBalance from "./getAddressBalance.js";
import telegram from "./telegram.js";
import engine from "./engine.js";
import fs from "fs";
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
      console.log(`🔌 Socket connected from ${ip} (ID: ${socketID})`);

      // Send initial state on connection
      socket.emit("updateState", { collections: memory.db.collections });

      socket.on("client", async (data, cb) => {
        console.log(`👤 Client connected (ID: ${socketID})`);
        cb({
          version: pjson.version,
          collections: memory.db.collections,
        });
      });

      socket.on("saveExpected", async (data, cb) => {
        console.log(`💾 Saving expected state for ${data.collection}/${data.address}`);
        const collection = memory.db.collections[data.collection];
        if (!collection) return cb(`collection not found`);
        const record = collection.addresses.find((a) => a.address === data.address);
        if (!record) return cb(`address not found`);
        record.expect = data.actual;
        memory.saveDb();
        // Emit state update to ALL clients
        socketIO.io.emit("updateState", { collections: memory.db.collections });
        cb();
      });

      socket.on("add", async ({ collection, name, address }, cb) => {
        console.log(`➕ Adding ${address} to collection ${collection}`);
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

        try {
          const balance = await getAddressBalance(address);
          console.log(`📊 Balance fetched for ${address}: ${JSON.stringify(balance.actual)}`);
          
          // Initialize the record with both expect and actual values
          const record = {
            address,
            name,
            expect: balance.error ? {
              chain_in: 0,
              chain_out: 0,
              mempool_in: 0,
              mempool_out: 0
            } : balance.actual,
            actual: balance.error ? null : balance.actual,
            error: balance.error || false,
            errorMessage: balance.error ? balance.message : null
          };

          memory.db.collections[collection].addresses.push(record);
          memory.saveDb();
          // Emit state update to ALL clients
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          cb({ status: "ok", record });
        } catch (error) {
          console.error(`❌ Error adding address ${address}: ${error.message}`);
          cb({ error: `Failed to add address: ${error.message}` });
        }
      });

      socket.on("delete", async ({ collection, address }, cb) => {
        console.log(`🗑️ Deleting ${address} from collection ${collection}`);
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
        console.log(`📡 State requested by client ${socketID}`);
        cb({ collections: memory.db.collections });
      });

      socket.on('getConfig', async(data, cb) => {
        console.log(`⚙️ Config requested by client ${socketID}`);
        cb({ 
          interval: memory.db.interval, 
          apiParallelLimit: memory.db.apiParallelLimit, 
          api: memory.db.api 
        });
      });

      socket.on('saveConfig', async(data, cb)=>{
        console.log(`💾 Saving configuration: ${JSON.stringify(data)}`);
        memory.db.interval = data.interval || memory.db.interval;
        memory.db.apiParallelLimit = data.apiParallelLimit || memory.db.apiParallelLimit;
        memory.db.api = data.api || memory.db.api;
        memory.saveDb();
        cb(data)
      });

      socket.on('getIntegrations', async(data, cb) => {
        console.log(`🔌 Integrations requested by client ${socketID}`);
        cb({ telegram: memory.db.telegram || {} });
      });

      socket.on('saveIntegrations', async(data, cb) => {
        console.log(`💾 Saving integrations configuration`);
        try {
          memory.db.telegram = data.telegram;
          memory.saveDb();
          telegram.init(true); // Pass true to send test message when saving
          cb({ success: true, data });
        } catch (error) {
          console.error(`❌ Error saving integrations: ${error.message}`);
          cb({ success: false, error: error.message });
        }
      });

      socket.on('renameCollection', async({ oldName, newName }, cb) => {
        console.log(`🔄 Renaming collection from ${oldName} to ${newName}`);
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
        console.log(`🔄 Manual refresh requested by client ${socketID}`);
        engine(); // Trigger immediate refresh
        cb({ status: "ok" });
      });
    });

    return socketIO.io;
  },
};
export default socketIO;
