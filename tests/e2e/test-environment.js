import { test as base, expect } from "@playwright/test";
import nock from "nock";

// Enable nock debugging
nock.disableNetConnect();
nock.enableNetConnect("127.0.0.1"); // Allow localhost connections for the test server

// Configure nock debugging
const debug = console.log;
nock.emitter.on("no match", (req) => {
  debug("No match for request:", {
    method: req.method,
    url: req.protocol + "//" + req.host + req.path,
    headers: req.headers,
    body: req.body,
  });
});

// Configure nock for both APIs
const setupNock = () => {
  // Debug interceptor for all unmocked requests
  const debugInterceptor = nock(/.*/)
    .persist()
    .filteringPath(/bot[^/]+\//, "bot{token}/") // Normalize bot token in paths
    .matchHeader("content-type", () => true) // Match any content-type
    .post(/.*/)
    .reply(function (uri, requestBody) {
      debug("Unmocked POST request:", {
        uri: uri,
        headers: this.req.headers,
        body: requestBody,
      });
      return [404, { ok: false, error: "Not mocked" }];
    })
    .get(/.*/)
    .reply(function (uri) {
      debug("Unmocked GET request:", {
        uri: uri,
        headers: this.req.headers,
      });
      return [404, { ok: false, error: "Not mocked" }];
    });

  // Mock mempool.space API
  const mempoolApi = nock("https://mempool.space")
    .persist()
    .get("/api/v1/ws")
    .reply(200, { status: "ok" })
    .get("/api/address/:address")
    .reply(200, {
      chain_stats: {
        funded_txo_count: 0,
        funded_txo_sum: 0,
        spent_txo_count: 0,
        spent_txo_sum: 0,
      },
      mempool_stats: {
        funded_txo_count: 0,
        funded_txo_sum: 0,
        spent_txo_count: 0,
        spent_txo_sum: 0,
      },
    });

  // Mock Telegram Bot API
  const telegramApi = nock("https://api.telegram.org")
    .persist()
    .filteringPath((path) => {
      // Extract everything after /bot{token}/ to normalize the path
      const match = path.match(/\/bot[^/]+\/(.*)/);
      return match ? `/bot{token}/${match[1]}` : path;
    })
    .post(/\/bot[^/]+\/getMe/)
    .reply(200, {
      ok: true,
      result: {
        id: 123456789,
        is_bot: true,
        first_name: "TestBot",
        username: "test_bot",
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
      },
    })
    .post(/\/bot[^/]+\/sendMessage/)
    .times(999)
    .reply(200, function (uri, requestBody) {
      debug("Telegram sendMessage:", requestBody);
      return {
        ok: true,
        result: {
          message_id: Date.now(),
          from: {
            id: 123456789,
            is_bot: true,
            first_name: "TestBot",
            username: "test_bot",
          },
          chat: {
            id: requestBody.chat_id,
            first_name: "Test",
            type: "private",
          },
          date: Math.floor(Date.now() / 1000),
          text: requestBody.text,
        },
      };
    })
    .post(/\/bot[^/]+\/setWebHook/)
    .reply(200, {
      ok: true,
      result: true,
      description: "Webhook was set",
    })
    .post(/\/bot[^/]+\/deleteWebhook/)
    .reply(200, {
      ok: true,
      result: true,
      description: "Webhook was deleted",
    });

  return { mempoolApi, telegramApi, debugInterceptor };
};

// Create a custom test fixture with our mocks
const test = base.extend({
  page: async ({ page }, use) => {
    // Add window-related code in page context
    await page.addInitScript(() => {
      // Set the server port for socket.io
      process.env.SERVER_PORT = 3119;
      window.process = { env: { SERVER_PORT: 3119 } };

      // Mock fetch for mempool API
      const originalFetch = window.fetch;
      window.fetch = async (url, options) => {
        if (url.includes("mempool.space")) {
          return {
            ok: true,
            json: () =>
              Promise.resolve({
                chain_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
                mempool_stats: { funded_txo_sum: 0, spent_txo_sum: 0 },
              }),
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
      if (typeof chunk === "string") {
        logs.push(chunk.trim());
      }
    };

    // Override console methods to capture logs
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    console.log = (...args) => {
      const message = args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
        .join(" ");
      writeLog(message);
      originalConsoleLog.apply(console, args);
    };

    console.error = (...args) => {
      const message = args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
        .join(" ");
      writeLog(message);
      originalConsoleError.apply(console, args);
    };

    await use(logs);

    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Attach logs to test info
    testInfo.attachments.push({
      name: "server-stdout",
      contentType: "text/plain",
      body: Buffer.from(logs.join("\n")),
    });
  },
  mockApis: async ({}, use) => {
    const mocks = setupNock();
    await use(mocks);
    // Log any pending mocks
    const pendingMocks = nock.pendingMocks();
    if (pendingMocks.length > 0) {
      debug("Pending mocks:", pendingMocks);
    }
    nock.cleanAll();
  },
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
