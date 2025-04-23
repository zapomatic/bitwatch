import { Server as io } from "socket.io";
import pjson from "../package.json" with { type: "json" };
import memory from "./memory.js";
import telegram from "./telegram.js";
import engine from "./engine.js";
import logger from "./logger.js";
import { BIP32Factory } from 'bip32';
// import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import getAddressBalance from "./getAddressBalance.js";
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

      socket.on("delete", async ({ collection, address, extendedKey }, cb) => {
        logger.info(`Deleting ${address ? `address ${address} from` : extendedKey ? `extended key from` : ''} collection ${collection}`);
        const col = memory.db.collections[collection];
        if (!col) return cb({ error: `collection not found` });
        
        // If no address or extended key provided, delete the entire collection
        if (!address && !extendedKey) {
          delete memory.db.collections[collection];
          memory.saveDb();
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          return cb({ status: "ok" });
        }

        // Remove the address if it exists
        if (address) {
          const index = col.addresses.findIndex((a) => a.address === address);
          if (index !== -1) {
            col.addresses.splice(index, 1);
          }
        }

        // Remove the extended key and its addresses if it exists
        if (extendedKey) {
          const index = col.extendedKeys.findIndex((k) => k.key === extendedKey.key);
          if (index !== -1) {
            // Get all addresses from this extended key for cleanup
            const addressesToRemove = col.extendedKeys[index].addresses.map(addr => addr.address);
            
            // Remove the addresses from the collection's addresses array
            col.addresses = col.addresses.filter(addr => !addressesToRemove.includes(addr.address));
            
            // Remove the extended key
            col.extendedKeys.splice(index, 1);
            
            logger.info(`Removed extended key and ${addressesToRemove.length} associated addresses`);
          }
        }
        
        // Only remove the collection if it's empty AND not the default "Satoshi" collection
        if (col.addresses.length === 0 && col.extendedKeys.length === 0 && collection !== "Satoshi") {
          delete memory.db.collections[collection];
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
        
        // Validate extended key format
        if (!key.match(/^[xyz]pub[a-zA-Z0-9]{107,108}$/)) {
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
        
        logger.info(`Adding extended key to collection ${collection} with path ${derivationPath}`);
        
        try {
          // Get initial batch of addresses
          const initialAddressesList = await deriveAddresses(
            { 
              key,
              skip: parseInt(skip) || 0 
            },
            0,
            parseInt(initialAddresses) || 10,
            derivationPath
          );
          
          // Create new extended key object
          const newExtendedKey = {
            key,
            gapLimit: parseInt(gapLimit) || 20,
            derivationPath,
            name,
            skip: parseInt(skip) || 0,
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
          memory.saveDb();
          
          // Emit update
          socketIO.io.emit("updateState", { 
            collections: memory.db.collections,
            apiState: "CHECKING"
          });
          
          callback({ success: true });

          // Check gap limit and derive more addresses if needed
          await checkGapLimit(newExtendedKey);
          
          // Save state again after gap limit check
          memory.saveDb();
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          
          // Trigger a refresh to fetch the balances
          engine();
        } catch (error) {
          callback({ error: error.message });
        }
      });

      socket.on('editExtendedKey', async (data, callback) => {
        const { collection, name, key, gapLimit, initialAddresses, derivationPath, extendedKeyIndex, skip } = data;
        
        if (!collection || !name || !key || !derivationPath || extendedKeyIndex === undefined) {
          callback({ error: "Missing required fields" });
          return;
        }
        
        // Validate extended key format
        if (!key.match(/^[xyz]pub[a-zA-Z0-9]{107,108}$/)) {
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
        
        logger.info(`Editing extended key in collection ${collection} with path ${derivationPath}`);
        
        try {
          // Get initial batch of addresses
          const initialAddressesList = await deriveAddresses(
            { 
              key,
              skip: parseInt(skip) || 0 
            },
            0,
            parseInt(initialAddresses) || 10,
            derivationPath
          );
          
          // Update the extended key
          memory.db.collections[collection].extendedKeys[extendedKeyIndex] = {
            key,
            gapLimit: parseInt(gapLimit) || 20,
            derivationPath,
            name,
            skip: parseInt(skip) || 0,
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
          memory.saveDb();
          
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
          await checkGapLimit(extendedKey);
          
          // Save state again after initialization scan
          memory.saveDb();
          socketIO.io.emit("updateState", { 
            collections: memory.db.collections,
            apiState: "GOOD"
          });
          
          // Trigger a refresh to fetch the balances
          engine();
        } catch (error) {
          logger.error(`Error in editExtendedKey: ${error.message}`);
          callback({ error: error.message });
        }
      });
    });

    return socketIO.io;
  },
};

const deriveAddresses = async (extendedKey, startIndex, count, derivationPath) => {
  const addresses = [];
  
  // Create a custom network for zpub
  const zpubNetwork = {
    ...bitcoin.networks.bitcoin,
    bip32: {
      public: 0x04b24746, // zpub prefix
      private: 0x04b2430c  // zprv prefix
    },
    bech32: 'bc',
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80
  };
  
  // Extract key from extendedKey object if needed
  const keyString = typeof extendedKey === 'object' ? extendedKey.key : extendedKey;
  const skipValue = typeof extendedKey === 'object' ? (extendedKey.skip || 0) : 0;
  
  logger.scan(`Deriving ${count} addresses starting from index ${startIndex} with skip ${skipValue}`);
  
  const node = bip32.fromBase58(keyString, zpubNetwork);
  
  // Parse derivation path and get the base node
  const pathParts = derivationPath.split('/').slice(1); // Remove 'm'
  let baseNode = node;
  for (const part of pathParts) {
    const isHardened = part.endsWith("'") || part.endsWith('h');
    if (isHardened) {
      throw new Error("Cannot derive hardened keys from extended public keys");
    }
    const index = parseInt(part.replace(/['h]/g, ''));
    baseNode = baseNode.derive(index);
  }
  
  // Calculate the actual start index including skip
  const actualStartIndex = startIndex + skipValue;
  
  // Derive addresses starting from the actual start index
  for (let i = 0; i < count; i++) {
    const derivationIndex = actualStartIndex + i;
    const child = baseNode.derive(derivationIndex);
    const { address } = bitcoin.payments.p2wpkh({ 
      pubkey: child.publicKey,
      network: zpubNetwork
    });
    addresses.push({
      name: `Address ${derivationIndex}`,
      address,
      index: derivationIndex
    });
  }
  
  return addresses;
};

const checkGapLimit = async (extendedKey) => {
  const { key, gapLimit, derivationPath } = extendedKey;
  let lastUsedIndex = -1;
  let emptyCount = 0;
  let currentIndex = extendedKey.addresses.length - 1; // Start after initial addresses
  
  logger.scan(`Starting gap limit check for ${extendedKey.name} from index ${currentIndex + 1}`);
  
  const handleRateLimit = (delay, attempt, maxAttempts) => {
    socketIO.io.emit("updateState", { 
      collections: memory.db.collections,
      apiState: "CHECKING"
    });
  };

  // First check all existing addresses to find the last used one
  for (const addr of extendedKey.addresses) {
    const balance = await getAddressBalance(addr.address, handleRateLimit);
    if (balance.error) {
      logger.error(`Error checking balance for ${addr.address}: ${balance.message}`);
      continue;
    }
    
    const totalBalance = (balance.actual.chain_in || 0) + (balance.actual.mempool_in || 0);
    if (totalBalance > 0) {
      logger.scan(`Found used address at index ${addr.index} with balance ${totalBalance}`);
      lastUsedIndex = addr.index;
      emptyCount = 0;
    } else {
      emptyCount++;
      logger.scan(`Empty address at index ${addr.index}, empty count: ${emptyCount}`);
    }
  }
  
  // If we haven't found enough empty addresses after the last used one, keep checking
  while (lastUsedIndex === -1 || emptyCount < gapLimit) {
    currentIndex++;
    logger.scan(`Checking index ${currentIndex}, empty count: ${emptyCount}, gap limit: ${gapLimit}`);
    
    const newAddresses = await deriveAddresses(
      { key, skip: extendedKey.skip || 0 },
      currentIndex,
      1,
      derivationPath
    );
    if (newAddresses.length === 0) break;
    
    const newAddr = newAddresses[0];
    const balance = await getAddressBalance(newAddr.address);
    
    // Add delay between API calls
    logger.scan(`Waiting ${memory.db.apiDelay}ms before next request`);
    await new Promise(resolve => setTimeout(resolve, memory.db.apiDelay));
    
    if (balance.error) {
      logger.error(`Error checking balance for ${newAddr.address}: ${balance.message}`);
      break;
    }
    
    const totalBalance = (balance.actual.chain_in || 0) + (balance.actual.mempool_in || 0);
    if (totalBalance > 0) {
      logger.scan(`Found used address at index ${newAddr.index} with balance ${totalBalance}`);
      lastUsedIndex = newAddr.index;
      emptyCount = 0;
    } else {
      emptyCount++;
      logger.scan(`Empty address at index ${newAddr.index}, empty count: ${emptyCount}`);
    }
    
    // Add the new address to the list
    extendedKey.addresses.push({
      address: newAddr.address,
      name: `${extendedKey.name} ${newAddr.index}`,
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
      actual: {
        chain_in: balance.actual.chain_in || 0,
        chain_out: balance.actual.chain_out || 0,
        mempool_in: balance.actual.mempool_in || 0,
        mempool_out: balance.actual.mempool_out || 0
      },
      error: false,
      errorMessage: null
    });

    // Save and emit update after each new address
    memory.saveDb();
    socketIO.io.emit("updateState", { 
      collections: memory.db.collections,
      apiState: "CHECKING"
    });
  }
  
  logger.scan(`Extended key ${extendedKey.name} scan complete. Last used index: ${lastUsedIndex}, Empty count: ${emptyCount}`);
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
          const newAddresses = deriveAddresses(
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
      try {
        const balance = await getAddressBalance(address.address);
        if (balance.error) {
          address.error = true;
          address.errorMessage = balance.message;
        } else {
          address.actual = balance.actual;
          address.error = false;
          address.errorMessage = null;
        }
      } catch (error) {
        address.error = true;
        address.errorMessage = error.message;
      }
    }

    // Check balances for all extended key addresses
    if (collection.extendedKeys) {
      for (const extendedKey of collection.extendedKeys) {
        for (const address of extendedKey.addresses) {
          try {
            const balance = await getAddressBalance(address.address);
            if (balance.error) {
              address.error = true;
              address.errorMessage = balance.message;
            } else {
              address.actual = balance.actual;
              address.error = false;
              address.errorMessage = null;
            }
          } catch (error) {
            address.error = true;
            address.errorMessage = error.message;
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
