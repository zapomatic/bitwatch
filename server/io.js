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
import { deriveExtendedKeyAddresses } from "./addressDeriver.js";

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
            logger.error("Missing collection or address", cb);
            return;
          }

          logger.info(`Refreshing balance for ${data.address} in ${data.collection}`);

          // Fetch new balance
          const balance = await getAddressBalance(data.address);
          if (balance.error) {
            logger.error(balance.message, cb);
            return;
          }

          // Use centralized balance update handler
          const result = await handleBalanceUpdate(data.address, balance, data.collection);
          if (result.error) {
            logger.error(result.error, cb);
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
              logger.error("Collection already exists", cb);
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
              logger.error("Collection not found", cb);
              return;
            }
            
            // Check if address already exists
            if (collection.addresses.some(addr => addr.address === data.address)) {
              logger.error("Address already exists in this collection", cb);
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
          
          logger.error("Invalid request", cb);
          return;
        },

        saveExpected: async (data, cb) => {
          logger.processing(`Saving expected state for ${data.collection}/${data.address}`);
          const collection = memory.db.collections[data.collection];
          if (!collection) {
            logger.error("Collection not found", cb);
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
            logger.error("Address not found", cb);
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
            logger.error("Missing required fields", cb);
            return;
          }

          logger.info(`Adding descriptor ${data.name} to collection ${data.collection}`);
          
          // Validate descriptor
          const validation = validateDescriptor(data.descriptor);
          if (!validation.success) {
            logger.error(validation.error, cb);
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
            logger.error("Descriptor with this name already exists", cb);
            return;
          }

          // Derive addresses
          const result = await deriveAddresses(
            data.descriptor,
            0, // start from index 0
            data.initialAddresses || 10, // number of addresses to derive
            data.skip || 0 // skip value
          );
          if (!result.success) {
            logger.error(result.error || "Failed to derive addresses", cb);
            return;
          }

          // Add descriptor to collection
          collection.descriptors.push({
            name: data.name,
            descriptor: data.descriptor,
            gapLimit: data.gapLimit || 2,
            skip: data.skip || 0,
            initialAddresses: data.initialAddresses || 10,
            addresses: result.data.map(addr => ({
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

        addExtendedKey: async (data, cb) => {
          if (!data.collection || !data.name || !data.key) {
            logger.error("Missing required fields", cb);
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
            logger.error("Extended key with this name or key already exists", cb);
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
            logger.error("Failed to derive addresses", cb);
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
            logger.error("Missing required fields", cb);
            return;
          }

          const collection = memory.db.collections[data.collection];
          if (!collection || !collection.descriptors[data.descriptorIndex]) {
            logger.error("Descriptor not found", cb);
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
            logger.error(allAddressesResult.error || "Failed to derive addresses", cb);
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
            logger.error("Collection not specified", cb);
            return;
          }

          const targetCollection = memory.db.collections[collection];
          if (!targetCollection) {
            logger.error("Collection not found", cb);
            return;
          }

          // Handle address deletion
          if (address) {
            // If it's an extended key address
            if (extendedKey) {
              const keyIndex = targetCollection.extendedKeys.findIndex(k => k.key === extendedKey.key);
              if (keyIndex === -1) {
                logger.error("Extended key not found", cb);
                return;
              }
              const addressIndex = targetCollection.extendedKeys[keyIndex].addresses.findIndex(a => a.address === address);
              if (addressIndex === -1) {
                logger.error("Address not found in extended key", cb);
                return;
              }
              targetCollection.extendedKeys[keyIndex].addresses.splice(addressIndex, 1);
            } else if (descriptor) {
              const descIndex = targetCollection.descriptors.findIndex(d => d.descriptor === descriptor.descriptor);
              if (descIndex === -1) {
                logger.error("Descriptor not found", cb);
                return;
              }
              const addressIndex = targetCollection.descriptors[descIndex].addresses.findIndex(a => a.address === address);
              if (addressIndex === -1) {
                logger.error("Address not found in descriptor", cb);
                return;
              }
              targetCollection.descriptors[descIndex].addresses.splice(addressIndex, 1);
            } else {
              const addressIndex = targetCollection.addresses.findIndex(a => a.address === address);
              if (addressIndex === -1) {
                logger.error("Address not found", cb);
                return;
              }
              targetCollection.addresses.splice(addressIndex, 1);
            }
          } else if (extendedKey) {
            const keyIndex = targetCollection.extendedKeys.findIndex(k => k.key === extendedKey.key);
            if (keyIndex === -1) {
              logger.error("Extended key not found", cb);
              return;
            }
            targetCollection.extendedKeys.splice(keyIndex, 1);
          } else if (descriptor) {
            const descIndex = targetCollection.descriptors.findIndex(d => d.descriptor === descriptor.descriptor);
            if (descIndex === -1) {
              logger.error("Descriptor not found", cb);
              return;
            }
            targetCollection.descriptors.splice(descIndex, 1);
          } else {
            delete memory.db.collections[collection];
          }

          memory.saveDb();
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          cb && cb({ success: true });
          return true;
        },

        updateAddress: async (data, cb) => {
          const { collection, address } = data;
          
          if (!collection || !address) {
            logger.error("Missing collection or address data", cb);
            return;
          }

          const targetCollection = memory.db.collections[collection];
          if (!targetCollection) {
            logger.error("Collection not found", cb);
            return;
          }

          // Try to find the address in the collection's addresses
          let addressIndex = targetCollection.addresses.findIndex(a => a.address === address.address);
          if (addressIndex !== -1) {
            targetCollection.addresses[addressIndex] = {
              ...targetCollection.addresses[addressIndex],
              name: address.name,
              monitor: address.monitor || targetCollection.addresses[addressIndex].monitor
            };
          } else {
            // Try to find the address in extended keys
            const extendedKey = targetCollection.extendedKeys?.find(key => 
              key.addresses.some(a => a.address === address.address)
            );
            if (extendedKey) {
              addressIndex = extendedKey.addresses.findIndex(a => a.address === address.address);
              extendedKey.addresses[addressIndex] = {
                ...extendedKey.addresses[addressIndex],
                name: address.name,
                monitor: address.monitor || extendedKey.addresses[addressIndex].monitor
              };
            } else {
              // Try to find the address in descriptors
              const descriptor = targetCollection.descriptors?.find(desc => 
                desc.addresses.some(a => a.address === address.address)
              );
              if (descriptor) {
                addressIndex = descriptor.addresses.findIndex(a => a.address === address.address);
                descriptor.addresses[addressIndex] = {
                  ...descriptor.addresses[addressIndex],
                  name: address.name,
                  monitor: address.monitor || descriptor.addresses[addressIndex].monitor
                };
              } else {
                logger.error("Address not found", cb);
                return;
              }
            }
          }

          memory.saveDb();
          socketIO.io.emit("updateState", { collections: memory.db.collections });
          cb && cb({ success: true });
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

export default socketIO;
