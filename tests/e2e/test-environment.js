import { test as base, expect } from "@playwright/test";
import {
  createMockTelegramBot,
  createMockMempoolAPI,
  createMockWebSocket,
} from "../mocks/services.js";
import testData from "../../test-data/keys.json" with { type: 'json' };

// Create mock services
const createMockServices = () => {
  const addressBalances = new Map();
  const wsListeners = new Map();
  const telegramMessages = [];

  return {
    mempool: {
      setAddressBalance: (address, balance) => {
        addressBalances.set(address, balance);
      },
      getAddressBalance: (address) => addressBalances.get(address),
      clearBalances: () => addressBalances.clear(),
      getBalances: () => Object.fromEntries(addressBalances)
    },
    websocket: {
      emit: (event, data) => {
        const listeners = wsListeners.get(event) || [];
        listeners.forEach(listener => listener(data));
      },
      on: (event, listener) => {
        const listeners = wsListeners.get(event) || [];
        listeners.push(listener);
        wsListeners.set(event, listeners);
      },
      clearListeners: () => wsListeners.clear()
    },
    telegram: {
      token: null,
      chatId: null,
      messages: telegramMessages,
      sendMessage: (message) => {
        telegramMessages.push(message);
        return true;
      },
      clearMessages: () => {
        telegramMessages.length = 0;
      }
    }
  };
};

// Create a custom test fixture with our mocks
const test = base.extend({
  mockServices: async ({}, use) => {
    const services = createMockServices();
    await use(services);
    
    // Cleanup after each test
    services.mempool.clearBalances();
    services.websocket.clearListeners();
    services.telegram.clearMessages();
  },
  page: async ({ page }, use) => {
    // Add socket.io mock and other window-related code in page context
    await page.addInitScript(() => {
      // Mock socket.io
      window.io = () => ({
        on: (event, listener) => {},
        emit: (event, data, cb) => {
          if (event === 'client' && cb) {
            setTimeout(() => {
              cb({
                version: '1.0.0',
                collections: {},
                websocketState: 'CONNECTED',
                apiState: 'GOOD',
                interval: 60000
              });
            }, 100);
          } else if (event === 'saveIntegrations' && cb) {
            setTimeout(() => {
              cb({ success: true });
            }, 100);
          } else if (event === 'getIntegrations' && cb) {
            setTimeout(() => {
              cb({});
            }, 100);
          }
        }
      });

      // Mock fetch for mempool API
      const originalFetch = window.fetch;
      window.fetch = async (url, options) => {
        if (url.includes('mempool.space')) {
          // Get the address from the URL
          const address = url.split('/').pop();
          
          // Get the balance from the mock balances
          const balance = window.__mockBalances?.[address] || {
            chain_in: 0,
            chain_out: 0,
            mempool_in: 0,
            mempool_out: 0
          };

          // Return the mocked response
          return {
            ok: true,
            json: async () => ({
              chain_stats: {
                funded_txo_sum: balance.chain_in,
                spent_txo_sum: balance.chain_out
              },
              mempool_stats: {
                funded_txo_sum: balance.mempool_in,
                spent_txo_sum: balance.mempool_out
              }
            })
          };
        }
        return originalFetch(url, options);
      };

      // Disable webpack dev server overlay
      const style = document.createElement('style');
      style.textContent = '#webpack-dev-server-client-overlay { display: none !important; }';
      document.head.appendChild(style);

      // Handle errors to prevent overlay
      window.addEventListener('error', (event) => {
        const overlay = document.getElementById('webpack-dev-server-client-overlay');
        if (overlay) {
          overlay.style.display = 'none';
        }
      });
    });

    // Expose function to update mock balances
    await page.exposeFunction('__setMockBalances', (balances) => {
      return page.evaluate((b) => {
        window.__mockBalances = b;
      }, balances);
    });

    await use(page);
  }
});

export { test, expect };

// Helper functions for common test operations
export const addCollection = async (page, name) => {
  await page.click("text=Add Collection");
  await page.fill('[aria-label="Collection Name"]', name);
  await page.click("text=Save");
};

export const addAddress = async (page, collection, address) => {
  await page.click(`[data-testid="${collection}-add-address"]`);
  await page.fill('[aria-label="Name"]', address.name);
  await page.fill('[aria-label="Address"]', address.address);
  await page.click("text=Save");
};

export const addExtendedKey = async (page, collection, key) => {
  await page.click(`[data-testid="${collection}-add-extended-key"]`);
  await page.fill('[aria-label="Name"]', key.name);
  await page.fill('[aria-label="Extended Key"]', key.key);
  await page.fill('[aria-label="Derivation Path"]', "m/0");
  await page.click("text=Add");
};

export const addDescriptor = async (page, collection, descriptor) => {
  await page.click(`[data-testid="${collection}-add-descriptor"]`);
  await page.fill('[aria-label="Name"]', descriptor.name);
  await page.fill('[aria-label="Descriptor"]', descriptor.descriptor);
  await page.click("text=Add");
};
