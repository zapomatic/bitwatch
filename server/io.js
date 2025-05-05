import { Server as io } from "socket.io";
import pjson from "../package.json" with { type: "json" };
import memory from "./memory.js";
import telegram from "./telegram.js";
import logger from "./logger.js";
import { BIP32Factory } from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { getAddressBalance, handleBalanceUpdate } from "./getAddressBalance.js";
import { deriveAddresses, validateDescriptor } from './descriptors.js';

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

          cb && cb({
            version: pjson.version,
            collections: memory.db.collections,
            websocketState: memory.state.websocketState,
            apiState: memory.state.apiState,
            interval: memory.db.interval
          });
          return true;
        },

        refreshBalance: async (data, cb) => {
          if (!data.collection || !data.address) {
            cb && cb({ error: "Missing collection or address" });
            return;
          }

          logger.info(`Refreshing balance for ${data.address} in ${data.collection}`);

          // Fetch new balance
          const balance = await getAddressBalance(data.address);
          if (balance.error) {
            cb && cb({ error: balance.message });
            return;
          }

          // Use centralized balance update handler
          const result = await handleBalanceUpdate(data.address, balance, data.collection);
          if (result.error) {
            cb && cb({ error: result.error });
            return;
          }

          // Emit update to all clients
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          
          cb && cb({ success: true });
          return true;
        },

        getConfig: async (cb) => {
          cb && cb({
            interval: memory.db.interval,
            api: memory.db.api,
            apiDelay: memory.db.apiDelay,
            apiParallelLimit: memory.db.apiParallelLimit,
            debugLogging: memory.db.debugLogging,
          });
          return true;
        },
        saveConfig: async (data, cb) => {
          logger.info(`Saving config ${data.api} at ${data.interval}ms, delay ${data.apiDelay}ms, parallel ${data.apiParallelLimit}, debug=${data.debugLogging}`);
          memory.db.interval = data.interval;
          memory.db.api = data.api;
          memory.db.apiDelay = data.apiDelay;
          memory.db.apiParallelLimit = data.apiParallelLimit;
          memory.db.debugLogging = data.debugLogging;
          memory.saveDb();
          cb && cb({ success: true });
          return true;
        },

        getIntegrations: async (cb) => {
          cb && cb({ telegram: memory.db.telegram || {} });
          return true;
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
            cb && cb({ success: false, error: result.error });
            return;
          }
          
          logger.success('Telegram initialized successfully');
          cb && cb({ success: true, data });
          return true;
        },

        add: async (data, cb) => {
          logger.info(`Adding ${data.name || 'collection'} to ${data.collection || 'root'}`);
          
          // Handle adding a collection
          if (data.collection && !data.name && !data.address) {
            if (memory.db.collections[data.collection]) {
              cb && cb({ error: "Collection already exists" });
              return;
            }
            
            memory.db.collections[data.collection] = {
              addresses: [],
              extendedKeys: [],
              descriptors: []
            };
            
            memory.saveDb();
            socketIO.io.emit("updateState", { collections: memory.db.collections });
            cb && cb({ status: "ok" });
            return true;
          }
          
          // Handle adding an address
          if (data.collection && data.name && data.address) {
            const collection = memory.db.collections[data.collection];
            if (!collection) {
              cb && cb({ error: "Collection not found" });
              return;
            }
            
            // Check if address already exists
            if (collection.addresses.some(addr => addr.address === data.address)) {
              cb && cb({ error: "Address already exists in this collection" });
              return;
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
            
            memory.saveDb();
            socketIO.io.emit("updateState", { collections: memory.db.collections });
            cb && cb({ status: "ok", record: true });
            return true;
          }
          
          cb && cb({ error: "Invalid request" });
          return;
        },

        saveExpected: async (data, cb) => {
          logger.processing(`Saving expected state for ${data.collection}/${data.address}`);
          const collection = memory.db.collections[data.collection];
          if (!collection) {
            cb && cb({ error: "Collection not found" });
            return;
          }
          
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
          
          if (!record) {
            cb && cb({ error: "Address not found" });
            return;
          }
          
          // Update expect values while preserving the object structure
          // Use actual values if expect values aren't available
          record.expect = {
            chain_in: data.expect?.chain_in ?? data.actual?.chain_in ?? 0,
            chain_out: data.expect?.chain_out ?? data.actual?.chain_out ?? 0,
            mempool_in: data.expect?.mempool_in ?? data.actual?.mempool_in ?? 0,
            mempool_out: data.expect?.mempool_out ?? data.actual?.mempool_out ?? 0
          };
          
          memory.saveDb();
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          cb && cb({ success: true });
          return true;
        },

        addDescriptor: async (data, cb) => {
          if (!data.collection || !data.name || !data.descriptor) {
            cb && cb({ success: false, error: "Missing required fields" });
            return;
          }

          logger.info(`Adding descriptor ${data.name} to collection ${data.collection}`);
          
          // Validate descriptor
          const validation = validateDescriptor(data.descriptor);
          if (!validation.success) {
            cb && cb({ success: false, error: validation.error });
            return;
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
            cb && cb({ success: false, error: "Descriptor with this name already exists" });
            return;
          }

          // Derive addresses
          const result = await deriveAddresses(data.descriptor, data.gapLimit, data.initialAddresses, data.skip);
          if (!result.success) {
            cb && cb({ success: false, error: result.error });
            return;
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
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          cb && cb({ success: true });
          return true;
        },

        addExtendedKey: async (data, cb) => {
          if (!data.collection || !data.name || !data.key) {
            cb && cb({ success: false, error: "Missing required fields" });
            return;
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
            cb && cb({ success: false, error: "Extended key with this name or key already exists" });
            return;
          }

          // Derive initial addresses
          const addresses = await deriveExtendedKeyAddresses(
            { key: data.key, skip: data.skip || 0 },
            0,
            data.initialAddresses || 5,
            data.derivationPath
          );

          if (!addresses) {
            cb && cb({ success: false, error: "Failed to derive addresses" });
            return;
          }

          // Add extended key to collection
          collection.extendedKeys.push({
            name: data.name,
            key: data.key,
            derivationPath: data.derivationPath,
            gapLimit: data.gapLimit || 2,
            initialAddresses: data.initialAddresses || 5,
            skip: data.skip || 0,
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
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          cb && cb({ success: true });
          return true;
        },

        editDescriptor: async (data, cb) => {
          if (!data.collection || !data.name || !data.descriptor || data.descriptorIndex === undefined) {
            cb && cb({ success: false, error: "Missing required fields" });
            return;
          }

          const collection = memory.db.collections[data.collection];
          if (!collection || !collection.descriptors[data.descriptorIndex]) {
            cb && cb({ success: false, error: "Descriptor not found" });
            return;
          }

          // Get all addresses in one batch
          const allAddressesResult = await deriveAddresses(
            data.descriptor,
            0,
            parseInt(data.initialAddresses) || 10,
            parseInt(data.skip) || 0
          );

          if (!allAddressesResult.success) {
            cb && cb({ success: false, error: allAddressesResult.error || "Failed to derive addresses" });
            return;
          }

          // Update the descriptor
          collection.descriptors[data.descriptorIndex] = {
            ...collection.descriptors[data.descriptorIndex],
            descriptor: data.descriptor,
            gapLimit: data.gapLimit,
            name: data.name,
            skip: data.skip || 0,
            initialAddresses: data.initialAddresses || 5,
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
          cb && cb({ success: true });
          return true;
        },

        delete: async (data, cb) => {
          const { address, collection, extendedKey, descriptor } = data;
          
          if (!collection) {
            cb && cb({ error: "Collection not specified" });
            return;
          }

          const targetCollection = memory.db.collections[collection];
          if (!targetCollection) {
            cb && cb({ error: "Collection not found" });
            return;
          }

          // Handle address deletion
          if (address) {
            // If it's an extended key address
            if (extendedKey) {
              const keyIndex = targetCollection.extendedKeys.findIndex(k => k.key === extendedKey.key);
              if (keyIndex === -1) {
                cb && cb({ error: "Extended key not found" });
                return;
              }
              const addressIndex = targetCollection.extendedKeys[keyIndex].addresses.findIndex(a => a.address === address);
              if (addressIndex === -1) {
                cb && cb({ error: "Address not found in extended key" });
                return;
              }
              targetCollection.extendedKeys[keyIndex].addresses.splice(addressIndex, 1);
            }
            // If it's a descriptor address
            else if (descriptor) {
              const descIndex = targetCollection.descriptors.findIndex(d => d.descriptor === descriptor.descriptor);
              if (descIndex === -1) {
                cb && cb({ error: "Descriptor not found" });
                return;
              }
              const addressIndex = targetCollection.descriptors[descIndex].addresses.findIndex(a => a.address === address);
              if (addressIndex === -1) {
                cb && cb({ error: "Address not found in descriptor" });
                return;
              }
              targetCollection.descriptors[descIndex].addresses.splice(addressIndex, 1);
            }
            // Regular address
            else {
              const addressIndex = targetCollection.addresses.findIndex(a => a.address === address);
              if (addressIndex === -1) {
                cb && cb({ error: "Address not found" });
                return;
              }
              targetCollection.addresses.splice(addressIndex, 1);
            }
          }
          // Handle extended key deletion
          else if (extendedKey) {
            const keyIndex = targetCollection.extendedKeys.findIndex(k => k.key === extendedKey.key);
            if (keyIndex === -1) {
              cb && cb({ error: "Extended key not found" });
              return;
            }
            targetCollection.extendedKeys.splice(keyIndex, 1);
          }
          // Handle descriptor deletion
          else if (descriptor) {
            const descIndex = targetCollection.descriptors.findIndex(d => d.descriptor === descriptor.descriptor);
            if (descIndex === -1) {
              cb && cb({ error: "Descriptor not found" });
              return;
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
          cb && cb({ status: "ok" });
          return true;
        }
      };

      // Register handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.on(event, async (data, cb) => {
          const result = await handler(data, cb);
          // Only call cb if it exists and we haven't already called it in the handler
          if (cb && typeof cb === 'function' && result !== undefined) {
            cb(result);
          }
        });
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

export default socketIO;
