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

      const handlers = {
        client: async (data, cb) => {
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
        },

        getConfig: async (cb) => {
          cb({
            interval: memory.db.interval,
            api: memory.db.api,
            apiDelay: memory.db.apiDelay,
            apiParallelLimit: memory.db.apiParallelLimit,
            debugLogging: memory.db.debugLogging,
          });
        },
        saveConfig: async (data, cb) => {
          logger.info(`Saving config ${data.api} at ${data.interval}ms, delay ${data.apiDelay}ms, parallel ${data.apiParallelLimit}, debug=${data.debugLogging}`);
          memory.db.interval = data.interval;
          memory.db.api = data.api;
          memory.db.apiDelay = data.apiDelay;
          memory.db.apiParallelLimit = data.apiParallelLimit;
          memory.db.debugLogging = data.debugLogging;
          memory.saveDb();
          cb({ success: true });
        },

        getIntegrations: async (cb) => {
          cb({ telegram: memory.db.telegram || {} });
        },

        saveIntegrations: async (data, cb) => {
          logger.processing(`Saving integrations configuration`);
          memory.db.telegram = data.telegram;
          memory.saveDb();
          
          // Initialize telegram and wait for test message
          logger.info('Initializing Telegram with test message');
          const result = await telegram.init(true);
          logger.info('Telegram initialization result:', result);
          
          if (!result.success) {
            logger.error('Telegram initialization failed:', result.error);
            return cb({ success: false, error: result.error });
          }
          
          logger.success('Telegram initialized successfully');
          cb({ success: true, data });
        },

        add: async (data, cb) => {
          logger.info(`Adding ${data.name || 'collection'} to ${data.collection || 'root'}`);
          
          // Handle adding a collection
          if (data.collection && !data.name && !data.address) {
            if (memory.db.collections[data.collection]) {
              return cb({ error: "Collection already exists" });
            }
            
            memory.db.collections[data.collection] = {
              addresses: [],
              extendedKeys: [],
              descriptors: []
            };
            
            memory.saveDb();
            socketIO.io.emit("updateState", { collections: memory.db.collections });
            return cb({ status: "ok" });
          }
          
          // Handle adding an address
          if (data.collection && data.name && data.address) {
            const collection = memory.db.collections[data.collection];
            if (!collection) {
              return cb({ error: "Collection not found" });
            }
            
            // Check if address already exists
            if (collection.addresses.some(addr => addr.address === data.address)) {
              return cb({ error: "Address already exists in this collection" });
            }
            
            // Add the new address
            collection.addresses.push({
              address: data.address,
              name: data.name,
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
            });
            
            // Log the collection state after adding the address
            logger.info(`Collection state after adding address: ${JSON.stringify(memory.db.collections[data.collection], null, 2)}`);
            
            memory.saveDb();
            socketIO.io.emit("updateState", { collections: memory.db.collections });

            // rather than do this, we will allow the engine to check
            // as it should be adding this address and checking it on our regular interval
            // this allows us to not eat up rate limits out of band
            // 
            // Force an immediate balance check for the new address
            // const balance = await getAddressBalance(data.address);
            // if (!balance.error) {
            //   const changes = detectBalanceChanges(
            //     data.address,
            //     balance.actual,
            //     data.collection,
            //     data.name
            //   );
            //   if (changes) {
            //     telegram.notifyBalanceChange(
            //       data.address,
            //       changes,
            //       data.collection,
            //       data.name
            //     );
            //   }
            // }

            return cb({ status: "ok", record: true });
          }
          
          return cb({ error: "Invalid request" });
        },

        saveExpected: async (data, cb) => {
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
        },

        addDescriptor: async (data, cb) => {
          if (!data.collection || !data.name || !data.descriptor) {
            return cb({ success: false, error: "Missing required fields" });
          }

          logger.info(`Adding descriptor ${data.name} to collection ${data.collection}`);
          
          // Validate descriptor
          const validation = validateDescriptor(data.descriptor);
          if (!validation.success) {
            return cb({ success: false, error: validation.error });
          }

          // Create collection if it doesn't exist
          if (!memory.db.collections[data.collection]) {
            memory.db.collections[data.collection] = { 
              addresses: [], 
              extendedKeys: [],
              descriptors: []
            };
          }

          // Check if descriptor already exists
          const collection = memory.db.collections[data.collection];
          if (collection.descriptors.some(d => d.name === data.name)) {
            return cb({ success: false, error: "Descriptor with this name already exists" });
          }

          // Derive addresses
          const result = await deriveAddresses(data.descriptor, data.gapLimit, data.initialAddresses, data.skip);
          if (!result.success) {
            return cb({ success: false, error: result.error });
          }

          // Add descriptor to collection
          collection.descriptors.push({
            name: data.name,
            descriptor: data.descriptor,
            gapLimit: data.gapLimit,
            addresses: result.data.map(addr => ({
              address: addr.address,
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
          });

          memory.saveDb();
          
          // Emit state update to ALL clients
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          
          return cb({ success: true });
        },

        addExtendedKey: async (data, cb) => {
          if (!data.collection || !data.name || !data.key) {
            return cb({ success: false, error: "Missing required fields" });
          }

          logger.info(`Adding extended key ${data.name} to collection ${data.collection}`);

          // Create collection if it doesn't exist
          if (!memory.db.collections[data.collection]) {
            memory.db.collections[data.collection] = { 
              addresses: [], 
              extendedKeys: [],
              descriptors: []
            };
          }

          // Check if extended key already exists
          const collection = memory.db.collections[data.collection];
          if (collection.extendedKeys.some(k => k.name === data.name || k.key === data.key)) {
            return cb({ success: false, error: "Extended key with this name or key already exists" });
          }

          // Derive initial addresses
          const addresses = await deriveExtendedKeyAddresses(
            { key: data.key, skip: data.skip || 0 },
            0,
            parseInt(data.initialAddresses) || 10,
            data.derivationPath
          );

          if (!addresses) {
            return cb({ success: false, error: "Failed to derive addresses" });
          }

          // Add extended key to collection
          collection.extendedKeys.push({
            name: data.name,
            key: data.key,
            derivationPath: data.derivationPath,
            gapLimit: parseInt(data.gapLimit) || 2,
            initialAddresses: parseInt(data.initialAddresses) || 10,
            skip: parseInt(data.skip) || 0,
            addresses: addresses.map(addr => ({
              address: addr.address,
              name: `${data.name} ${addr.index}`,
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
          });

          memory.saveDb();
          
          // Emit state update to ALL clients
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          
          return cb({ success: true });
        },

        editDescriptor: async (data, cb) => {
          if (!data.collection || !data.name || !data.descriptor || data.descriptorIndex === undefined) {
            return cb({ success: false, error: "Missing required fields" });
          }

          const collection = memory.db.collections[data.collection];
          if (!collection || !collection.descriptors[data.descriptorIndex]) {
            return cb({ success: false, error: "Descriptor not found" });
          }

          // Get all addresses in one batch
          const allAddressesResult = await deriveAddresses(
            data.descriptor,
            0,
            parseInt(data.initialAddresses) || 10,
            parseInt(data.skip) || 0
          );

          if (!allAddressesResult.success) {
            return cb({ success: false, error: allAddressesResult.error || "Failed to derive addresses" });
          }

          // Update the descriptor
          collection.descriptors[data.descriptorIndex] = {
            ...collection.descriptors[data.descriptorIndex],
            descriptor: data.descriptor,
            gapLimit: parseInt(data.gapLimit),
            name: data.name,
            skip: parseInt(data.skip),
            initialAddresses: parseInt(data.initialAddresses),
            addresses: allAddressesResult.data.map(addr => ({
              address: addr.address,
              name: `${data.name} ${addr.index}`,
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

          memory.saveDb();
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          return cb({ success: true });
        },

        checkGapLimit: async (data, cb) => {
          const result = await checkGapLimit(data);
          return cb(result);
        },

        delete: async (data, cb) => {
          const { address, collection, extendedKey, descriptor } = data;
          
          if (!collection) {
            return cb({ error: "Collection not specified" });
          }

          const targetCollection = memory.db.collections[collection];
          if (!targetCollection) {
            return cb({ error: "Collection not found" });
          }

          // Handle address deletion
          if (address) {
            // If it's an extended key address
            if (extendedKey) {
              const keyIndex = targetCollection.extendedKeys.findIndex(k => k.key === extendedKey.key);
              if (keyIndex === -1) {
                return cb({ error: "Extended key not found" });
              }
              const addressIndex = targetCollection.extendedKeys[keyIndex].addresses.findIndex(a => a.address === address);
              if (addressIndex === -1) {
                return cb({ error: "Address not found in extended key" });
              }
              targetCollection.extendedKeys[keyIndex].addresses.splice(addressIndex, 1);
            }
            // If it's a descriptor address
            else if (descriptor) {
              const descIndex = targetCollection.descriptors.findIndex(d => d.descriptor === descriptor.descriptor);
              if (descIndex === -1) {
                return cb({ error: "Descriptor not found" });
              }
              const addressIndex = targetCollection.descriptors[descIndex].addresses.findIndex(a => a.address === address);
              if (addressIndex === -1) {
                return cb({ error: "Address not found in descriptor" });
              }
              targetCollection.descriptors[descIndex].addresses.splice(addressIndex, 1);
            }
            // Regular address
            else {
              const addressIndex = targetCollection.addresses.findIndex(a => a.address === address);
              if (addressIndex === -1) {
                return cb({ error: "Address not found" });
              }
              targetCollection.addresses.splice(addressIndex, 1);
            }
          }
          // Handle extended key deletion
          else if (extendedKey) {
            const keyIndex = targetCollection.extendedKeys.findIndex(k => k.key === extendedKey.key);
            if (keyIndex === -1) {
              return cb({ error: "Extended key not found" });
            }
            targetCollection.extendedKeys.splice(keyIndex, 1);
          }
          // Handle descriptor deletion
          else if (descriptor) {
            const descIndex = targetCollection.descriptors.findIndex(d => d.descriptor === descriptor.descriptor);
            if (descIndex === -1) {
              return cb({ error: "Descriptor not found" });
            }
            targetCollection.descriptors.splice(descIndex, 1);
          }
          // Handle collection deletion
          else {
            delete memory.db.collections[collection];
          }

          // Save changes and emit update
          memory.saveDb();
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          return cb({ status: "ok" });
        }
      };

      // Register handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.on(event, handler);
      });

      return handlers;
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
      const result = await deriveAddresses(
        item.descriptor,
        currentIndex,
        1,
        item.skip || 0
      );
      if (!result.success) {
        logger.error(`Failed to derive additional addresses: ${result.error}`);
        return { lastUsedIndex, emptyCount };
      }
      newAddresses = result.data;
    } else {
      // This is an extended key
      newAddresses = await deriveExtendedKeyAddresses(
        { key: item.key, skip: item.skip || 0 },
        currentIndex,
        1,
        item.derivationPath
      );
    }
    
    if (!newAddresses || newAddresses.length === 0) {
      logger.error('Failed to derive new addresses');
      break;
    }
    
    const newAddr = newAddresses[0];
    const balance = await getAddressBalance(newAddr.address);
    
    // Add delay between API calls
    logger.scan(`Waiting ${memory.db.apiDelay || 100}ms before next request`);
    await new Promise(resolve => setTimeout(resolve, memory.db.apiDelay || 100));
    
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
      actual: balance.actual,
      error: false,
      errorMessage: null
    };
    
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
