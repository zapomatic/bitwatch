import memory from "./memory.js";
import logger from "./logger.js";
import TelegramBot from "node-telegram-bot-api";
import {
  acceptChanges,
  addAddressFromCommand,
  escapeHtml,
  formatAddressLink,
  formatSats,
  getMessageOptions,
  getAddressMessage,
  getStatusMessage,
  getTelegramHelp,
  refreshAddress,
} from "./telegramActions.js";

let bot = null;
let isConnected = false;
let reconnectionTimeout = null;
let healthCheckInterval = null;
let reconnectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BACKOFF = 5000;

// Keep track of alerts we've already sent
const sentAlerts = new Map();

// Collect every chat ID that is allowed to receive notifications: the global
// default plus any per-collection / per-key / per-descriptor / per-address
// override. Used to recognize partners who DM the bot from their own chat.
const getConfiguredChatIds = () => {
  const ids = new Set();
  const add = (chatId) => {
    if (chatId) ids.add(String(chatId));
  };
  add(memory.db.telegram?.chatId);
  for (const collection of Object.values(memory.db.collections || {})) {
    add(collection.notify?.chatId);
    for (const addr of collection.addresses || []) add(addr.notify?.chatId);
    for (const key of collection.extendedKeys || []) {
      add(key.notify?.chatId);
      for (const addr of key.addresses || []) add(addr.notify?.chatId);
    }
    for (const desc of collection.descriptors || []) {
      add(desc.notify?.chatId);
      for (const addr of desc.addresses || []) add(addr.notify?.chatId);
    }
  }
  return ids;
};

const cleanup = async () => {
  if (bot) {
    logger.info("Cleaning up Telegram bot instance");
    if (bot.isPolling()) {
      await bot.stopPolling();
    }
    bot = null;
  }
  if (reconnectionTimeout) clearTimeout(reconnectionTimeout);
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  isConnected = false;
  reconnectionAttempts = 0;
  sentAlerts.clear();
  return true;
};

const reconnect = () => {
  if (reconnectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error("Max reconnection attempts reached. Giving up.");
    return;
  }
  reconnectionAttempts++;
  const delay = RECONNECT_BACKOFF * reconnectionAttempts;
  logger.info(`Attempting to reconnect in ${delay / 1000}s...`);
  if (reconnectionTimeout) clearTimeout(reconnectionTimeout);
  reconnectionTimeout = setTimeout(() => init(false), delay);
};

const healthCheck = async () => {
  if (!bot || !isConnected) {
    logger.warning(
      "Health check failed: bot not connected. Attempting to reconnect."
    );
    reconnect();
    return;
  }

  try {
    await bot.getMe();
    // logger.info("Health check passed.");
  } catch (error) {
    logger.error(`Health check failed: ${error.message}`);
    isConnected = false;
    reconnect();
  }
};

const init = async (sendTestMessage = false) => {
  await cleanup();

  if (!memory.db.telegram?.token || !memory.db.telegram?.chatId) {
    logger.warning("Telegram not configured - missing token or chat ID");
    return { success: false, error: "Missing token or chat ID" };
  }

  logger.info(
    `Environment: ${
      process.env.NODE_ENV
    }, Bot exists: ${!!bot}, Token exists: ${!!memory.db.telegram.token}`
  );

  if (process.env.NODE_ENV === "test") {
    logger.info("Test mode: creating test bot instance");
    bot = {
      stopPolling: () => logger.info("Test bot: stopPolling called"),
      isPolling: () => true,
      startPolling: () => logger.info("Test bot: startPolling called"),
      onText: (_pattern, _callback) =>
        logger.info("Test bot: onText handler registered"),
      on: (_event, _callback) =>
        logger.info(`Test bot: ${_event} handler registered`),
      sendMessage: (_chatId, _message, _options) => Promise.resolve(true),
      sendDocument: (_chatId, _document, _options) => Promise.resolve(true),
      getMe: () => Promise.resolve(true),
    };
    isConnected = true;
    reconnectionAttempts = 0;
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    healthCheckInterval = setInterval(healthCheck, 30000);
    return { success: true };
  }

  const createBot = async () => {
    try {
      logger.info("Creating new Telegram bot instance");
      const newBot = new TelegramBot(memory.db.telegram.token, {
        polling: false,
      });

      await newBot.getMe();
      logger.info("Bot token validated successfully");
      await newBot.startPolling();
      isConnected = true;
      reconnectionAttempts = 0;
      if (healthCheckInterval) clearInterval(healthCheckInterval);
      healthCheckInterval = setInterval(healthCheck, 30000);
      return newBot;
    } catch (error) {
      logger.error(`Failed to create/validate Telegram bot: ${error.message}`);
      isConnected = false;
      return null;
    }
  };

  bot = await createBot();
  if (!bot) {
    reconnect();
    return { success: false, error: "Invalid Telegram token" };
  }

  bot.onText(/^\/start(?:@\w+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    const message = `👋 Welcome to Bitwatch!\n\nYour chat ID is: <code>${chatId}</code>\n\nTo receive notifications:\n1. Copy this chat ID\n2. Paste it in the Bitwatch Telegram configuration (globally, or on a specific collection/address)\n3. Click Save to test the connection\n\nCurrent status: ${
      getConfiguredChatIds().has(String(chatId))
        ? "✅ Configured"
        : "❌ Not configured"
    }`;
    await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
  });

  // Management commands (accept, add, backup...) act on the whole database, so
  // they are limited to the global chat ID. Per-collection/address override
  // chats only receive alerts.
  const isAdminChat = (msg) =>
    !!memory.db.telegram?.chatId &&
    String(msg.chat.id) === String(memory.db.telegram.chatId);

  const onAdminCommand = (name, handler) =>
    bot.onText(
      new RegExp(`^\\/${name}(?:@\\w+)?(?:\\s+(.+))?$`),
      (msg, match) =>
        // Listener rejections are not handled by the bot library; catch so a
        // failed send cannot crash the process.
        runAdminCommand(name, handler, msg, match).catch((error) =>
          logger.error(`Telegram /${name} failed: ${error.message}`)
        )
    );

  const runAdminCommand = async (name, handler, msg, match) => {
    const chatId = msg.chat.id;
    if (!isAdminChat(msg)) {
      logger.warning(`🚫 Telegram /${name} rejected from chat ${chatId}`);
      await bot.sendMessage(
        chatId,
        "❌ Commands are only available from the main Bitwatch chat ID.",
        { parse_mode: "HTML" }
      );
      return;
    }
    logger.telegram(`Telegram /${name} from chat ${chatId}`);
    const result = await handler(match?.[1]?.trim(), chatId);
    if (!result) return;
    await bot.sendMessage(
      chatId,
      result.error ? `❌ ${escapeHtml(result.error)}` : result.message,
      getMessageOptions()
    );
  };

  onAdminCommand("help", () => ({ message: getTelegramHelp() }));
  onAdminCommand("status", () => ({ message: getStatusMessage() }));
  onAdminCommand("address", (query) =>
    query
      ? getAddressMessage(query)
      : { error: "Usage: /address <name|address|path>" }
  );
  onAdminCommand("accept", acceptChanges);
  onAdminCommand("addaddress", addAddressFromCommand);
  onAdminCommand("refresh", (query) =>
    query
      ? refreshAddress(query)
      : { error: "Usage: /refresh <name|address|path>" }
  );
  onAdminCommand("backup", async (_query, chatId) => {
    await bot.sendDocument(chatId, memory.dbFile, {
      caption: "Bitwatch database backup",
    });
  });

  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    const chatId = msg.chat.id;
    if (!getConfiguredChatIds().has(String(chatId))) {
      await bot.sendMessage(
        chatId,
        "❌ This chat is not configured to receive notifications.\nUse /start to get your chat ID and configure it in Bitwatch.",
        { parse_mode: "HTML" }
      );
    }
  });

  bot.on("polling_error", (error) => {
    logger.error(`[polling_error] ${error.code} - ${error.message}`);
    isConnected = false;
    reconnect();
  });

  if (sendTestMessage) {
    const success = await sendMessage(
      "✅ Bitwatch Telegram notifications configured successfully!\n\nYou will receive notifications here when address balances change."
    );
    if (success) {
      logger.success("Telegram bot initialized and test message sent");
      return { success: true };
    } else {
      logger.error("Failed to send test message");
      await cleanup();
      return { success: false, error: "Failed to send test message" };
    }
  } else {
    logger.success("Telegram bot initialized");
    return { success: true };
  }
};

const sendMessage = async (message, chatId) => {
  const targetChatId = chatId || memory.db.telegram?.chatId;
  if (!bot || !isConnected || !targetChatId) {
    logger.warning("sendMessage called but bot not ready.");
    return false;
  }

  try {
    const result = await bot.sendMessage(
      targetChatId,
      message,
      getMessageOptions()
    );
    return !!result;
  } catch (error) {
    logger.error(`Failed to send Telegram message: ${error.message}`);
    if (error.code === "ETELEGRAM" && error.response && error.response.body) {
      logger.error(`Telegram API error: ${error.response.body.description}`);
    }
    isConnected = false;
    reconnect();
    return false;
  }
};

const getAlertKey = (collection, name, address, type, value) => {
  return `${collection}/${name}/${address}/${type}:${value}`;
};

const notifyBalanceChange = async (
  address,
  changes,
  collection,
  name,
  chatId
) => {
  const targetChatId = chatId || memory.db.telegram?.chatId;
  if (!bot || !isConnected || !targetChatId) {
    logger.warning(
      `Balance changed on ${collection}/${name} (${address}) but Telegram not configured - ${
        !bot ? "bot not initialized" : "not connected or missing chat ID"
      }`
    );
    return false;
  }

  const changeMessages = [];

  const processChange = (type, value) => {
    const key = getAlertKey(collection, name, address, type, value);
    if (!sentAlerts.has(key)) {
      let label = "";
      switch (type) {
        case "chain_in":
          label = "Chain In";
          break;
        case "chain_out":
          label = "Chain Out";
          break;
        case "mempool_in":
          label = "Mempool In";
          break;
        case "mempool_out":
          label = "Mempool Out";
          break;
      }
      changeMessages.push(`${label}: ${formatSats(value)}`);
      sentAlerts.set(key, true);
    }
  };

  if (typeof changes.chain_in === "number")
    processChange("chain_in", changes.chain_in);
  if (typeof changes.chain_out === "number")
    processChange("chain_out", changes.chain_out);
  if (typeof changes.mempool_in === "number")
    processChange("mempool_in", changes.mempool_in);
  if (typeof changes.mempool_out === "number")
    processChange("mempool_out", changes.mempool_out);

  if (changeMessages.length === 0) return true;

  const msg = changeMessages.join("\n");
  const message = `\n🔔 <b>Balance Change Detected</b>\n${escapeHtml(collection)}/${escapeHtml(name)} (${formatAddressLink(
    address
  )})\n${msg}\n`;

  logger.telegram(
    `Telegram Alert Send: ${collection}/${name} (${address}) -> chat ${targetChatId}, msg: ${msg}`
  );
  return await sendMessage(message, targetChatId);
};

export default {
  init,
  sendMessage,
  notifyBalanceChange,
  cleanup,
};
