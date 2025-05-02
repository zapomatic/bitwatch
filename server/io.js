import { Server as io } from "socket.io";
import pjson from "../package.json" with { type: "json" };
import memory from "./memory.js";
import telegram from "./telegram.js";
import engine from "./engine.js";
import logger from "./logger.js";
import { BIP32Factory } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import getAddressBalance from "./getAddressBalance.js";
import { checkAddressBalance, hasAddressActivity } from "./balance.js";
import { parseDescriptor, deriveAddresses, validateDescriptor } from './descriptors.js';
// const { v4: uuidv4 } = require("uuid");

const ecpair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

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

        // Update memory state
        memory.state.apiState = apiState;

        cb({
          version: pjson.version,
          collections: memory.db.collections,
          websocketState: memory.state.websocketState,
          apiState: memory.state.apiState,
          interval: memory.db.interval
        });
      });

      socket.on("saveExpected", async (data, cb) => {
        logger.processing(`Saving expected state for ${data.collection}/${data.address}`);
        const collection = memory.db.collections[data.collection];
        if (!collection) return cb(`collection not found`);
        
        // First check main addresses
        let record = collection.addresses.find((a) => a.address === data.address);
        
        // If not found, check extended keys
        if (!record && collection.extendedKeys) {
          for (const extendedKey of collection.extendedKeys) {
            record = extendedKey.addresses.find((a) => a.address === data.address);
            if (record) break;
          }
        }

        // If not found, check descriptors
        if (!record && collection.descriptors) {
          for (const descriptor of collection.descriptors) {
            record = descriptor.addresses.find((a) => a.address === data.address);
            if (record) break;
          }
        }
        
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
          col.addresses.some(addr => addr.actual !== null) ||
          (col.extendedKeys && col.extendedKeys.some(key => key.addresses.some(addr => addr.actual !== null))) ||
          (col.descriptors && col.descriptors.some(desc => desc.addresses.some(addr => addr.actual !== null)))
        );
        const hasErrors = Object.values(memory.db.collections).some(col => 
          col.addresses.some(addr => addr.error) ||
          (col.extendedKeys && col.extendedKeys.some(key => key.addresses.some(addr => addr.error))) ||
          (col.descriptors && col.descriptors.some(desc => desc.addresses.some(addr => addr.error)))
        );
        const hasLoading = Object.values(memory.db.collections).some(col => 
          col.addresses.some(addr => addr.actual === null && !addr.error) ||
          (col.extendedKeys && col.extendedKeys.some(key => key.addresses.some(addr => addr.actual === null && !addr.error))) ||
          (col.descriptors && col.descriptors.some(desc => desc.addresses.some(addr => addr.actual === null && !addr.error)))
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

      socket.on("add", async ({ collection, name, address, extendedKeys, addresses }, cb) => {
        logger.info(`Adding ${address} to collection ${collection}`);
        // Create collection if it doesn't exist
        if (!memory.db.collections[collection]) {
          memory.db.collections[collection] = { 
            addresses: addresses || [], 
            extendedKeys: extendedKeys || [] 
          };
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
          monitor: {
            chain_in: "auto-accept",
            chain_out: "alert",
            mempool_in: "auto-accept",
            mempool_out: "alert"
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
          apiState: "GOOD",
          interval: memory.db.interval
        });
        cb({ status: "ok", record });

        // Trigger a refresh to fetch the balance
        engine();
      });

      socket.on("delete", async ({ collection, address, extendedKey, descriptor }, cb) => {
        logger.info(`Deleting ${address ? `address ${address} from` : extendedKey ? `extended key from` : descriptor ? `descriptor from` : 'entire'} collection: ${collection}`);
        
        // Validate inputs
        if (!collection || !memory.db.collections[collection]) {
          cb({ error: `collection not found` });
          return;
        }
        const col = memory.db.collections[collection];

        // If no specific item to delete, delete entire collection
        if (!address && !extendedKey && !descriptor) {
          delete memory.db.collections[collection];
          memory.saveDb();
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          cb({ status: "ok" });
          return;
        }

        // Handle address deletion
        if (address) {
          const index = col.addresses.findIndex((a) => a.address === address);
          if (index !== -1) {
            col.addresses.splice(index, 1);
          }
        }

        // Handle extended key deletion
        if (extendedKey) {
          const index = col.extendedKeys?.findIndex((k) => k.key === extendedKey.key);
          if (index !== -1) {
            const addressesToRemove = col.extendedKeys[index].addresses.map(addr => addr.address);
            col.addresses = col.addresses.filter(addr => !addressesToRemove.includes(addr.address));
            col.extendedKeys.splice(index, 1);
            logger.info(`Removed extended key and ${addressesToRemove.length} associated addresses`);
          }
        }

        // Handle descriptor deletion
        if (descriptor) {
          const index = col.descriptors?.findIndex((d) => d.descriptor === descriptor.descriptor);
          if (index !== -1) {
            const addressesToRemove = col.descriptors[index].addresses.map(addr => addr.address);
            col.addresses = col.addresses.filter(addr => !addressesToRemove.includes(addr.address));
            col.descriptors.splice(index, 1);
            logger.info(`Removed descriptor and ${addressesToRemove.length} associated addresses`);
          }
        }
        
        memory.saveDb();
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
          api: memory.db.api,
          apiDelay: memory.db.apiDelay,
          apiParallelLimit: memory.db.apiParallelLimit, 
          interval: memory.db.interval, 
        });
      });

      socket.on('saveConfig', async(data, cb)=>{
        logger.processing(`Saving configuration: ${JSON.stringify(data)}`);
        const oldInterval = memory.db.interval;
        memory.db.interval = data.interval || memory.db.interval;
        memory.db.apiParallelLimit = data.apiParallelLimit || memory.db.apiParallelLimit;
        memory.db.api = data.api || memory.db.api;
        memory.db.debugLogging = data.debugLogging !== undefined ? data.debugLogging : memory.db.debugLogging;
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
        memory.db.telegram = data.telegram;
        const saveResult = memory.saveDb();
        if (!saveResult) {
          logger.error('Failed to save integrations to database');
          cb({ success: false, error: 'Failed to save integrations' });
          return;
        }

        const initResult = telegram.init(true); // Pass true to send test message when saving
        if (!initResult) {
          logger.error('Failed to initialize telegram integration');
          cb({ success: false, error: 'Failed to initialize telegram' });
          return;
        }

        cb({ success: true, data });
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

      socket.on('importCollections', async(data, cb) => {
        logger.info(`Importing collections from file`);
        if (!data.collections || typeof data.collections !== "object") {
          return cb({ error: "Invalid collections data" });
        }

        // Validate the structure of each collection
        for (const [name, collection] of Object.entries(data.collections)) {
          if (!collection.addresses || !Array.isArray(collection.addresses)) {
            return cb({ error: `Invalid collection structure for ${name}` });
          }
          for (const addr of collection.addresses) {
            if (!addr.address || !addr.name || !addr.expect) {
              return cb({ error: `Invalid address structure in collection ${name}` });
            }
          }
        }

        // Update the collections in memory
        memory.db.collections = data.collections;
        memory.saveDb();

        // Emit state update to ALL clients
        socketIO.io.emit("updateState", { collections: memory.db.collections });
        cb({ status: "ok" });
      });

      socket.on('updateAddress', async ({ collection, address }, cb) => {
        logger.info(`Updating address ${address.address} in collection ${collection}`);
        const col = memory.db.collections[collection];
        if (!col) return cb({ error: `collection not found` });
        
        // First try to find the address in the regular addresses array
        let addressToUpdate = null;
        let addressIndex = col.addresses.findIndex((a) => a.address === address.address);
        
        if (addressIndex !== -1) {
          // Address found in regular addresses
          col.addresses[addressIndex] = {
            ...col.addresses[addressIndex],
            ...address,
            // Ensure monitor settings are properly set
            monitor: {
              chain_in: address.monitor?.chain_in || "auto-accept",
              chain_out: address.monitor?.chain_out || "alert",
              mempool_in: address.monitor?.mempool_in || "auto-accept",
              mempool_out: address.monitor?.mempool_out || "alert"
            }
          };
        } else {
          // If not found in regular addresses, look in extended keys
          let found = false;
          for (const extendedKey of col.extendedKeys || []) {
            addressIndex = extendedKey.addresses.findIndex((a) => a.address === address.address);
            if (addressIndex !== -1) {
              // Address found in this extended key
              extendedKey.addresses[addressIndex] = {
                ...extendedKey.addresses[addressIndex],
                ...address,
                // Ensure monitor settings are properly set
                monitor: {
                  chain_in: address.monitor?.chain_in || "auto-accept",
                  chain_out: address.monitor?.chain_out || "alert",
                  mempool_in: address.monitor?.mempool_in || "auto-accept",
                  mempool_out: address.monitor?.mempool_out || "alert"
                }
              };
              found = true;
              break;
            }
          }
          
          if (!found) {
            return cb({ error: `address not found` });
          }
        }
        
        memory.saveDb();
        socketIO.io.emit("updateState", { collections: memory.db.collections });
        cb({ status: "ok" });
      });

      socket.on('addExtendedKey', async (data, callback) => {
        const { collection, name, key, gapLimit, initialAddresses, derivationPath, skip } = data;
        
        if (!collection || !name || !key || !derivationPath) {
          callback({ error: "Missing required fields" });
          return;
        }

        // Validate derivation path format
        if (!derivationPath.match(/^m(\/\d+'?)*$/)) {
          callback({ error: "Invalid derivation path format" });
          return;
        }

        // Check for hardened derivation
        if (derivationPath.includes("'")) {
          callback({ error: "Cannot use hardened derivation with extended public keys" });
          return;
        }
        
        logger.info(`Adding extended key ${key} to collection ${collection} with path ${derivationPath}, skip ${skip || 0}, and initial addresses ${initialAddresses || 10}`);
        
        // Get initial batch of addresses
        const initialAddressesList = await deriveExtendedKeyAddresses(
          { 
            key,
            skip: parseInt(skip) || 0 
          },
          0,
          parseInt(initialAddresses) || 10,
          derivationPath
        );

        if (!initialAddressesList) {
          callback({ error: "Invalid extended key - unable to derive addresses" });
          return;
        }
        
        // Create new extended key object
        const newExtendedKey = {
          key,
          gapLimit: parseInt(gapLimit) || 20,
          derivationPath,
          name,
          skip: parseInt(skip) || 0,
          initialAddresses: parseInt(initialAddresses) || 10,
          addresses: initialAddressesList.map(addr => ({
            address: addr.address,
            name: `${name} ${addr.index}`,
            index: addr.index,
            expect: {
              chain_in: 0,
              chain_out: 0,
              mempool_in: 0,
              mempool_out: 0
            },
            monitor: {
              chain_in: "auto-accept",
              chain_out: "alert",
              mempool_in: "auto-accept",
              mempool_out: "alert"
            },
            actual: null,
            error: false,
            errorMessage: null
          }))
        };
        
        // Initialize collections if needed
        if (!memory.db.collections[collection]) {
          memory.db.collections[collection] = { addresses: [], extendedKeys: [] };
        }
        
        // Initialize extendedKeys array if needed
        if (!memory.db.collections[collection].extendedKeys) {
          memory.db.collections[collection].extendedKeys = [];
        }
        
        // Add the new extended key
        memory.db.collections[collection].extendedKeys.push(newExtendedKey);
        
        // Save state
        const saveResult = memory.saveDb();
        if (!saveResult) {
          callback({ error: "Failed to save database" });
          return;
        }
        
        // Emit update
        socketIO.io.emit("updateState", { 
          collections: memory.db.collections,
          apiState: "CHECKING"
        });
        
        callback({ success: true });

        // Check gap limit and derive more addresses if needed
        const gapLimitResult = await checkGapLimit(newExtendedKey);
        if (!gapLimitResult) {
          logger.error("Failed to check gap limit");
        }
        
        // Save state again after gap limit check
        memory.saveDb();
        socketIO.io.emit("updateState", { collections: memory.db.collections });
        
        // Trigger a refresh to fetch the balances
        engine();
      });

      socket.on('editExtendedKey', async (data, callback) => {
        const { collection, name, key, gapLimit, initialAddresses, derivationPath, extendedKeyIndex, skip } = data;
        
        if (!collection || !name || !key || !derivationPath || extendedKeyIndex === undefined) {
          callback({ error: "Missing required fields" });
          return;
        }
        
        // Validate extended key format
        if (!key.match(/^[xyz]pub[a-zA-Z0-9]+$/)) {
          callback({ error: "Invalid extended key format" });
          return;
        }

        // Validate derivation path format
        if (!derivationPath.match(/^m(\/\d+'?)*$/)) {
          callback({ error: "Invalid derivation path format" });
          return;
        }

        // Check for hardened derivation
        if (derivationPath.includes("'")) {
          callback({ error: "Cannot use hardened derivation with extended public keys" });
          return;
        }
        
        logger.info(`Editing extended key in collection ${collection} with path ${derivationPath}, skip ${skip || 0}, gap limit ${gapLimit || 2}, and initial addresses ${initialAddresses || 10}`);
        
        // Get initial batch of addresses
        const initialAddressesList = await deriveExtendedKeyAddresses(
          { 
            key,
            skip: parseInt(skip) || 0 
          },
          0,
          parseInt(initialAddresses) || 10,
          derivationPath
        );

        if (!initialAddressesList) {
          callback({ error: "Failed to derive addresses" });
          return;
        }
        
        // Update the extended key with all provided values
        memory.db.collections[collection].extendedKeys[extendedKeyIndex] = {
          ...memory.db.collections[collection].extendedKeys[extendedKeyIndex],
          key,
          gapLimit: parseInt(gapLimit) || 2,
          derivationPath,
          name,
          skip: parseInt(skip) || 0,
          initialAddresses: parseInt(initialAddresses) || 10,
          addresses: initialAddressesList.map(addr => ({
            address: addr.address,
            name: `${name} ${addr.index}`,
            index: addr.index,
            expect: {
              chain_in: 0,
              chain_out: 0,
              mempool_in: 0,
              mempool_out: 0
            },
            monitor: {
              chain_in: "auto-accept",
              chain_out: "alert",
              mempool_in: "auto-accept",
              mempool_out: "alert"
            },
            actual: null,
            error: false,
            errorMessage: null
          }))
        };
        
        // Save state
        const saveResult = memory.saveDb();
        if (!saveResult) {
          callback({ error: "Failed to save database" });
          return;
        }
        
        // Emit initial update
        socketIO.io.emit("updateState", { 
          collections: memory.db.collections,
          apiState: "CHECKING"
        });
        
        callback({ success: true });

        // Perform new initialization scan with updated config
        const extendedKey = memory.db.collections[collection].extendedKeys[extendedKeyIndex];
        
        logger.scan(`Initializing extended key ${extendedKey.name} : ${extendedKey.addresses.length} addresses with gap limit ${extendedKey.gapLimit}`);
        
        // First check the initial addresses
        for (const addr of extendedKey.addresses) {
          logger.scan(`Checking balance for address ${addr.address}`);
          const balance = await getAddressBalance(addr.address);
          if (balance.error) {
            addr.error = true;
            addr.errorMessage = balance.error;
            logger.error(`Error checking balance for ${addr.address}: ${balance.error}`);
          } else {
            addr.actual = {
              chain_in: balance.actual.chain_in || 0,
              chain_out: balance.actual.chain_out || 0,
              mempool_in: balance.actual.mempool_in || 0,
              mempool_out: balance.actual.mempool_out || 0
            };
            logger.scan(`Balance for ${addr.address}: chain_in=${addr.actual.chain_in}, mempool_in=${addr.actual.mempool_in}`);
          }
          
          // Save and emit update after each address
          memory.saveDb();
          socketIO.io.emit("updateState", { 
            collections: memory.db.collections,
            apiState: "CHECKING"
          });
          
          // Respect API delay
          logger.scan(`Waiting ${memory.db.config?.apiDelay || 1000}ms before next request`);
          await new Promise(resolve => setTimeout(resolve, memory.db.config?.apiDelay || 1000));
        }

        // Then check gap limit and derive more addresses if needed
        const gapLimitResult = await checkGapLimit(extendedKey);
        if (!gapLimitResult) {
          logger.error("Failed to check gap limit");
        }
        
        // Save state again after initialization scan
        memory.saveDb();
        socketIO.io.emit("updateState", { 
          collections: memory.db.collections,
          apiState: "GOOD"
        });
        
        // Trigger a refresh to fetch the balances
        engine();
      });

      socket.on('addDescriptor', async (data, callback) => {
        const { collection, name, descriptor, gapLimit, initialAddresses, skip } = data;
        
        if (!collection || !name || !descriptor) {
          callback({ error: "Missing required fields" });
          return;
        }
        
        logger.info(`Processing descriptor add request:`);
        logger.info(`Collection: ${collection}`);
        logger.info(`Name: ${name}`);
        logger.info(`Descriptor: ${descriptor}`);
        logger.info(`Gap Limit: ${gapLimit}`);
        logger.info(`Initial Addresses: ${initialAddresses}`);
        logger.info(`Skip: ${skip}`);
        
        // Validate descriptor
        const validation = validateDescriptor(descriptor);
        if (!validation.valid) {
          logger.error(`Descriptor validation failed: ${validation.error}`);
          callback({ error: `Invalid descriptor: ${validation.error}` });
          return;
        }
        
        logger.info(`Descriptor validated successfully`);
        logger.info(`Type: ${validation.type}`);
        logger.info(`Script Type: ${validation.scriptType}`);
        logger.info(`Required Signatures: ${validation.requiredSignatures}`);
        logger.info(`Total Signatures: ${validation.totalSignatures}`);
        
        // Get initial batch of addresses plus gap limit
        const totalInitialAddresses = Math.max(parseInt(initialAddresses) || 10, parseInt(gapLimit) || 20);
        const initialAddressesList = await deriveAddresses(
          descriptor,
          0,
          totalInitialAddresses,
          parseInt(skip) || 0
        );

        if (!initialAddressesList) {
          logger.error("Failed to derive addresses");
          callback({ error: "Failed to derive addresses" });
          return;
        }
        
        logger.info(`Successfully derived ${initialAddressesList.length} addresses`);
        
        // Create new descriptor object
        const newDescriptor = {
          descriptor,
          gapLimit: parseInt(gapLimit) || 20,
          name,
          skip: parseInt(skip) || 0,
          initialAddresses: parseInt(initialAddresses) || 10,
          type: validation.type,
          scriptType: validation.scriptType,
          requiredSignatures: validation.requiredSignatures,
          totalSignatures: validation.totalSignatures,
          addresses: initialAddressesList.map(addr => ({
            address: addr.address,
            name: `${name} ${addr.index}`,
            index: addr.index,
            expect: {
              chain_in: 0,
              chain_out: 0,
              mempool_in: 0,
              mempool_out: 0
            },
            monitor: {
              chain_in: "auto-accept",
              chain_out: "alert",
              mempool_in: "auto-accept",
              mempool_out: "alert"
            },
            actual: null,
            error: false,
            errorMessage: null
          }))
        };
        
        // Initialize collections if needed
        if (!memory.db.collections[collection]) {
          memory.db.collections[collection] = { addresses: [], extendedKeys: [], descriptors: [] };
        }
        
        // Initialize descriptors array if needed
        if (!memory.db.collections[collection].descriptors) {
          memory.db.collections[collection].descriptors = [];
        }
        
        // Add the new descriptor
        memory.db.collections[collection].descriptors.push(newDescriptor);
        
        // Save state
        const saveResult = memory.saveDb();
        if (!saveResult) {
          callback({ error: "Failed to save database" });
          return;
        }
        
        // Emit update
        socketIO.io.emit("updateState", { 
          collections: memory.db.collections,
          apiState: "CHECKING"
        });
        
        callback({ success: true });

        // Check gap limit and derive more addresses if needed
        const gapLimitResult = await checkGapLimit(newDescriptor);
        if (!gapLimitResult) {
          logger.error("Failed to check gap limit");
        }
        
        // Save state again after gap limit check
        memory.saveDb();
        socketIO.io.emit("updateState", { collections: memory.db.collections });
        
        // Trigger a refresh to fetch the balances
        engine();
      });

      socket.on('editDescriptor', async (data, callback) => {
        const { collection, name, descriptor, gapLimit, initialAddresses, descriptorIndex, skip } = data;
        
        if (!collection || !name || !descriptor || descriptorIndex === undefined) {
          callback({ error: "Missing required fields" });
          return;
        }
        
        const skipValue = parseInt(skip) || 0;
        const initialAddressesValue = parseInt(initialAddresses) || 10;
        const gapLimitValue = parseInt(gapLimit) || 20;
        
        logger.info(`Editing descriptor in collection ${collection} with gap limit ${gapLimitValue}, skip ${skipValue}, and initial addresses ${initialAddressesValue}`);
        
        // Get the existing descriptor to preserve its data
        const existingDescriptor = memory.db.collections[collection].descriptors[descriptorIndex];
        if (!existingDescriptor) {
          callback({ error: "Descriptor not found" });
          return;
        }

        // Validate descriptor
        const validation = validateDescriptor(descriptor);
        if (!validation.valid) {
          logger.error(`Descriptor validation failed: ${validation.error}`);
          callback({ error: `Invalid descriptor: ${validation.error}` });
          return;
        }
        
        // Calculate total number of addresses needed based on gap limit and initial addresses
        const totalAddressesToDerive = Math.max(initialAddressesValue, gapLimitValue) + skipValue;
        
        // Get all addresses in one batch
        logger.info(`Deriving ${totalAddressesToDerive} addresses starting from index ${skipValue}`);
        const allAddressesList = await deriveAddresses(
          descriptor,
          0,
          totalAddressesToDerive,
          skipValue
        );

        if (!allAddressesList) {
          logger.error("Failed to derive addresses");
          callback({ error: "Failed to derive addresses" });
          return;
        }
        
        logger.info(`Successfully derived ${allAddressesList.length} addresses`);
        
        // Create address records with initial state
        const addressRecords = allAddressesList.map(addr => ({
          address: addr.address,
          name: `${name} ${addr.index}`,
          index: addr.index,
          expect: {
            chain_in: 0,
            chain_out: 0,
            mempool_in: 0,
            mempool_out: 0
          },
          monitor: {
            chain_in: "auto-accept",
            chain_out: "alert",
            mempool_in: "auto-accept",
            mempool_out: "alert"
          },
          actual: null,
          error: false,
          errorMessage: null
        }));
        
        // Update the descriptor while preserving existing data
        memory.db.collections[collection].descriptors[descriptorIndex] = {
          ...existingDescriptor,  // Preserve existing data
          descriptor,
          gapLimit: gapLimitValue,
          name,
          skip: skipValue,
          initialAddresses: initialAddressesValue,
          type: validation.type,
          scriptType: validation.scriptType,
          requiredSignatures: validation.requiredSignatures,
          totalSignatures: validation.totalSignatures,
          addresses: addressRecords
        };
        
        // Save state
        const saveResult = memory.saveDb();
        if (!saveResult) {
          callback({ error: "Failed to save database" });
          return;
        }
        
        // Emit initial update
        socketIO.io.emit("updateState", { 
          collections: memory.db.collections,
          apiState: "CHECKING"
        });
        
        callback({ success: true });

        // Get the updated descriptor
        const updatedDescriptor = memory.db.collections[collection].descriptors[descriptorIndex];
        
        logger.scan(`Checking balances for ${updatedDescriptor.addresses.length} addresses`);
        
        // Check balances for all addresses
        for (const addr of updatedDescriptor.addresses) {
          logger.scan(`Checking balance for address ${addr.address} (index ${addr.index})`);
          const balance = await getAddressBalance(addr.address);
          if (balance.error) {
            addr.error = true;
            addr.errorMessage = balance.error;
            logger.error(`Error checking balance for ${addr.address}: ${balance.error}`);
          } else {
            addr.actual = {
              chain_in: balance.actual.chain_in || 0,
              chain_out: balance.actual.chain_out || 0,
              mempool_in: balance.actual.mempool_in || 0,
              mempool_out: balance.actual.mempool_out || 0
            };
            logger.scan(`Balance for ${addr.address}: chain_in=${addr.actual.chain_in}, mempool_in=${addr.actual.mempool_in}`);
          }
          
          // Save and emit update after each address
          memory.saveDb();
          socketIO.io.emit("updateState", { 
            collections: memory.db.collections,
            apiState: "CHECKING"
          });
          
          // Respect API delay
          logger.scan(`Waiting ${memory.db.config?.apiDelay || 1000}ms before next request`);
          await new Promise(resolve => setTimeout(resolve, memory.db.config?.apiDelay || 1000));
        }

        // Analyze addresses to see if we need more based on gap limit
        let lastUsedIndex = -1;
        let emptyCount = 0;
        
        for (const addr of updatedDescriptor.addresses) {
          if (addr.actual && (addr.actual.chain_in > 0 || addr.actual.mempool_in > 0)) {
            lastUsedIndex = addr.index;
            emptyCount = 0;
          } else {
            emptyCount++;
          }
        }

        // If we need more addresses based on gap limit
        if (lastUsedIndex !== -1 && emptyCount < gapLimitValue) {
          const additionalNeeded = gapLimitValue - emptyCount;
          logger.info(`Need ${additionalNeeded} more addresses to maintain gap limit after index ${lastUsedIndex}`);
          
          const additionalAddresses = await deriveAddresses(
            descriptor,
            updatedDescriptor.addresses.length,
            additionalNeeded,
            skipValue
          );

          if (!additionalAddresses) {
            logger.error("Failed to derive additional addresses");
            return;
          }

          // Add the new addresses
          const newAddressRecords = additionalAddresses.map(addr => ({
            address: addr.address,
            name: `${name} ${addr.index}`,
            index: addr.index,
            expect: {
              chain_in: 0,
              chain_out: 0,
              mempool_in: 0,
              mempool_out: 0
            },
            monitor: {
              chain_in: "auto-accept",
              chain_out: "alert",
              mempool_in: "auto-accept",
              mempool_out: "alert"
            },
            actual: null,
            error: false,
            errorMessage: null
          }));

          updatedDescriptor.addresses.push(...newAddressRecords);

          // Check balances for new addresses
          for (const addr of newAddressRecords) {
            logger.scan(`Checking balance for additional address ${addr.address} (index ${addr.index})`);
            const balance = await getAddressBalance(addr.address);
            if (balance.error) {
              addr.error = true;
              addr.errorMessage = balance.error;
              logger.error(`Error checking balance for ${addr.address}: ${balance.error}`);
            } else {
              addr.actual = {
                chain_in: balance.actual.chain_in || 0,
                chain_out: balance.actual.chain_out || 0,
                mempool_in: balance.actual.mempool_in || 0,
                mempool_out: balance.actual.mempool_out || 0
              };
              logger.scan(`Balance for ${addr.address}: chain_in=${addr.actual.chain_in}, mempool_in=${addr.actual.mempool_in}`);
            }
            
            // Save and emit update after each address
            memory.saveDb();
            socketIO.io.emit("updateState", { 
              collections: memory.db.collections,
              apiState: "CHECKING"
            });
            
            // Respect API delay
            logger.scan(`Waiting ${memory.db.config?.apiDelay || 1000}ms before next request`);
            await new Promise(resolve => setTimeout(resolve, memory.db.config?.apiDelay || 1000));
          }
        }
        
        // Save state again after all updates
        memory.saveDb();
        socketIO.io.emit("updateState", { 
          collections: memory.db.collections,
          apiState: "GOOD"
        });
        
        // Trigger a refresh to fetch the balances
        engine();
      });
    });

    return socketIO.io;
  },
};

const deriveExtendedKeyAddresses = async (extendedKey, startIndex, count, derivationPath) => {
  const addresses = [];
  
  // Extract key from extendedKey object if needed
  const keyString = typeof extendedKey === 'object' ? extendedKey.key : extendedKey;
  const skipValue = typeof extendedKey === 'object' ? (extendedKey.skip || 0) : 0;
  
  logger.scan(`Deriving ${count} addresses starting from index ${startIndex} with skip ${skipValue}`);

  // Create networks for different key types
  const networks = {
    xpub: {
      ...bitcoin.networks.bitcoin,
      bip32: {
        public: 0x0488b21e,  // xpub
        private: 0x0488ade4  // xprv
      }
    },
    ypub: {
      ...bitcoin.networks.bitcoin,
      bip32: {
        public: 0x049d7cb2,  // ypub
        private: 0x049d7878  // yprv
      }
    },
    zpub: {
      ...bitcoin.networks.bitcoin,
      bip32: {
        public: 0x04b24746, // zpub
        private: 0x04b2430c  // zprv
      }
    }
  };

  // Determine which network to use based on key prefix
  const keyLower = keyString.toLowerCase();
  let network;
  if (keyLower.startsWith('zpub')) {
    network = networks.zpub;
  } else if (keyLower.startsWith('ypub')) {
    network = networks.ypub;
  } else {
    network = networks.xpub;
  }
  
  // Decode the extended key
  let node;
  // fromBase58 will throw if invalid, we'll let it return undefined
  node = bip32.fromBase58(keyString, network);
  if (!node) {
    logger.error('Failed to decode extended key');
    return null;
  }
  
  // Parse derivation path and get the base node
  const pathParts = derivationPath.split('/').slice(1); // Remove 'm'
  let baseNode = node;
  for (const part of pathParts) {
    const isHardened = part.endsWith("'") || part.endsWith('h');
    if (isHardened) {
      logger.error('Cannot derive hardened keys from extended public keys');
      return null;
    }
    const index = parseInt(part.replace(/['h]/g, ''));
    if (isNaN(index)) {
      logger.error('Invalid derivation path index');
      return null;
    }
    baseNode = baseNode.derive(index);
    if (!baseNode) {
      logger.error('Failed to derive path');
      return null;
    }
  }
  
  // Calculate the actual start index including skip
  const actualStartIndex = startIndex + skipValue;
  
  // Derive addresses starting from the actual start index
  for (let i = 0; i < count; i++) {
    const derivationIndex = actualStartIndex + i;
    const child = baseNode.derive(derivationIndex);
    if (!child) {
      logger.error(`Failed to derive child at index ${derivationIndex}`);
      return null;
    }
    
    // Use appropriate address type based on key prefix
    let address;
    if (keyLower.startsWith('zpub')) {
      // Native segwit (P2WPKH)
      address = bitcoin.payments.p2wpkh({ pubkey: child.publicKey, network }).address;
    } else if (keyLower.startsWith('ypub')) {
      // P2SH-wrapped segwit (P2SH-P2WPKH)
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: child.publicKey, network });
      address = bitcoin.payments.p2sh({ redeem: p2wpkh, network }).address;
    } else {
      // Legacy (P2PKH)
      address = bitcoin.payments.p2pkh({ pubkey: child.publicKey, network }).address;
    }
    
    if (!address) {
      logger.error(`Failed to generate address at index ${derivationIndex}`);
      return null;
    }
    
    addresses.push({
      name: `Address ${derivationIndex}`,
      address,
      index: derivationIndex
    });
  }
  
  return addresses;
};

const checkGapLimit = async (item) => {
  const { gapLimit, initialAddresses } = item;
  let lastUsedIndex = -1;
  let emptyCount = 0;
  
  logger.scan(`Starting gap limit check for ${item.name}`);
  
  // First check all existing addresses to find the last used one
  for (const addr of item.addresses) {
    if (hasAddressActivity(addr)) {
      logger.scan(`Found used address at index ${addr.index}`);
      lastUsedIndex = addr.index;
      emptyCount = 0;
    } else {
      emptyCount++;
      logger.scan(`Empty address at index ${addr.index}, empty count: ${emptyCount}`);
    }
  }
  
  // If we haven't found any used addresses and we've checked at least initialAddresses + gapLimit
  if (lastUsedIndex === -1 && item.addresses.length >= (initialAddresses || 10) + gapLimit) {
    logger.scan(`No used addresses found after checking ${item.addresses.length} addresses. Stopping scan.`);
    return { lastUsedIndex, emptyCount };
  }
  
  // If we haven't found enough empty addresses after the last used one, keep checking
  while (lastUsedIndex === -1 || emptyCount < gapLimit) {
    const currentIndex = item.addresses.length;
    logger.scan(`Checking index ${currentIndex}, empty count: ${emptyCount}, gap limit: ${gapLimit}`);
    
    // If we've checked initialAddresses + gapLimit addresses and found nothing, stop
    if (lastUsedIndex === -1 && currentIndex >= (initialAddresses || 10) + gapLimit) {
      logger.scan(`No used addresses found after checking ${currentIndex} addresses. Stopping scan.`);
      break;
    }
    
    let newAddresses;
    if ('descriptor' in item) {
      // This is a descriptor
      newAddresses = await deriveAddresses(
        item.descriptor,
        currentIndex,
        1,
        item.skip || 0
      );
    } else {
      // This is an extended key
      newAddresses = await deriveExtendedKeyAddresses(
        { key: item.key, skip: item.skip || 0 },
        currentIndex,
        1,
        item.derivationPath
      );
    }
    
    if (newAddresses.length === 0) break;
    
    const newAddr = newAddresses[0];
    const balance = await getAddressBalance(newAddr.address);
    
    // Add delay between API calls
    logger.scan(`Waiting ${memory.db.config?.apiDelay || 1000}ms before next request`);
    await new Promise(resolve => setTimeout(resolve, memory.db.config?.apiDelay || 1000));
    
    if (balance.error) {
      logger.error(`Error checking balance for ${newAddr.address}: ${balance.message}`);
      break;
    }

    // Create new address record
    const addressRecord = {
      address: newAddr.address,
      name: `${item.name} ${newAddr.index}`,
      index: newAddr.index,
      expect: {
        chain_in: 0,
        chain_out: 0,
        mempool_in: 0,
        mempool_out: 0
      },
      monitor: {
        chain_in: "auto-accept",
        chain_out: "alert",
        mempool_in: "auto-accept",
        mempool_out: "alert"
      },
      actual: null,
      error: false,
      errorMessage: null
    };

    // Update balance using shared function
    await checkAddressBalance(addressRecord, balance.actual);
    
    if (hasAddressActivity(addressRecord)) {
      logger.scan(`Found used address at index ${newAddr.index}`);
      lastUsedIndex = newAddr.index;
      emptyCount = 0;
    } else {
      emptyCount++;
      logger.scan(`Empty address at index ${newAddr.index}, empty count: ${emptyCount}`);
    }
    
    // Add the new address to the list
    item.addresses.push(addressRecord);

    // Save and emit update after each new address
    memory.saveDb();
    socketIO.io.emit("updateState", { 
      collections: memory.db.collections,
      apiState: "CHECKING"
    });
  }
  
  logger.scan(`${item.name} scan complete. Last used index: ${lastUsedIndex}, Empty count: ${emptyCount}`);
  return {
    lastUsedIndex,
    emptyCount
  };
};

// Modify the checkBalances function to handle gap limit monitoring
const checkBalances = async () => {
  for (const [collectionName, collection] of Object.entries(memory.db.collections)) {
    // Check extended keys
    if (collection.extendedKeys) {
      for (const extendedKey of collection.extendedKeys) {
        const { needsMore, lastUsedIndex } = checkGapLimit(extendedKey);
        
        if (needsMore) {
          // Derive more addresses
          const newAddresses = deriveExtendedKeyAddresses(
            extendedKey.key,
            lastUsedIndex + 1,
            extendedKey.gapLimit,
            extendedKey.derivationPath
          );
          
          // Add new addresses to extended key
          extendedKey.addresses = [
            ...extendedKey.addresses,
            ...newAddresses.map(addr => ({
              address: addr.address,
              name: `${extendedKey.name} ${addr.index}`,
              expect: {
                chain_in: 0,
                chain_out: 0,
                mempool_in: 0,
                mempool_out: 0
              },
              monitor: {
                chain_in: "auto-accept",
                chain_out: "alert",
                mempool_in: "auto-accept",
                mempool_out: "alert"
              },
              actual: null,
              error: false,
              errorMessage: null
            }))
          ];
          
          // Save state
          memory.saveDb();
          
          // Emit update
          socketIO.io.emit("updateState", { collections: memory.db.collections });
        }
      }
    }
    
    // Check balances for all addresses in the collection
    for (const address of collection.addresses) {
      const balance = await getAddressBalance(address.address);
      if (balance.error) {
        address.error = true;
        address.errorMessage = balance.message;
      } else {
        address.actual = balance.actual;
        address.error = false;
        address.errorMessage = null;
      }
    }

    // Check balances for all extended key addresses
    if (collection.extendedKeys) {
      for (const extendedKey of collection.extendedKeys) {
        for (const address of extendedKey.addresses) {
          const balance = await getAddressBalance(address.address);
          if (balance.error) {
            address.error = true;
            address.errorMessage = balance.message;
          } else {
            address.actual = balance.actual;
            address.error = false;
            address.errorMessage = null;
          }
        }
      }
    }
  }
  
  // Save state after all balances are checked
  memory.saveDb();
  
  // Emit update
  socketIO.io.emit("updateState", { collections: memory.db.collections });
};

export default socketIO;
