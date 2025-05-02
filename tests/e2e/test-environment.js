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
  let failNextInit = false;

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
      failNextInit: false,
      sendMessage: (message) => {
        console.log('Mock Telegram: Sending message:', message);
        telegramMessages.push(message);
        return true;
      },
      clearMessages: () => {
        telegramMessages.length = 0;
      },
      init: async (sendTestMessage = false) => {
        console.log('Mock Telegram: Initializing with sendTestMessage:', sendTestMessage);
        if (failNextInit) {
          console.log('Mock Telegram: Failing initialization as requested');
          failNextInit = false;
          return { success: false, error: "Failed to create telegram bot" };
        }
        console.log('Mock Telegram: Initialization successful');
        return { success: true };
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
    // Add window-related code in page context
    await page.addInitScript(() => {
      // Set the server port for socket.io
      process.env.SERVER_PORT = 3119;
      window.process = { env: { SERVER_PORT: 3119 } };
      
      // Mock fetch for mempool API
      const originalFetch = window.fetch;
      window.fetch = async (url, options) => {
        if (url.includes('mempool.space')) {
          return {
            ok: true,
            json: () => Promise.resolve({
              chain_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
              mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 }
            })
          };
        }
        return originalFetch(url, options);
      };
    });

    await use(page);
  },
  // Add server log capture
  serverLogs: async ({}, use, testInfo) => {
    const logs = [];
    
    // Create a custom write function to capture logs
    const writeLog = (chunk) => {
      if (typeof chunk === 'string') {
        logs.push(chunk.trim());
      }
    };

    // Override console methods to capture logs
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    console.log = (...args) => {
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
      writeLog(message);
      originalConsoleLog.apply(console, args);
    };

    console.error = (...args) => {
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
      writeLog(message);
      originalConsoleError.apply(console, args);
    };

    await use(logs);

    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Attach logs to test info
    testInfo.attachments.push({
      name: 'server-stdout',
      contentType: 'text/plain',
      body: Buffer.from(logs.join('\n'))
    });
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
